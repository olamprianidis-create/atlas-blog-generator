import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { getServiceClient } from "../../../utils/supabase";

// Resend's webhook (Resend dashboard → Webhooks, all email.* events) for
// campaign analytics. Verifies the Svix signature, stores each event in
// email_events (svix_id unique → a delivered retry is a no-op), and stamps the
// matching email_sends row (stamps first, event row last — see below). Events for emails that aren't campaign sends
// (test sends, the ATLAS Website's password resets on the same Resend
// account) are acknowledged and ignored.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

interface EmailEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    tags?: Record<string, string>;
    click?: { link?: string };
    bounce?: { type?: string; subType?: string; message?: string };
    failed?: { reason?: string };
    suppressed?: { type?: string; message?: string };
  };
}

function header(req: NextApiRequest, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value ?? "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "RESEND_WEBHOOK_SECRET is not set" });

  const payload = await readRawBody(req);
  const svixId = header(req, "svix-id");
  let event: EmailEvent;
  try {
    // verify() is pure signature checking; the API key isn't used.
    event = new Resend(process.env.RESEND_API_KEY || "re_unused").webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: header(req, "svix-timestamp"), signature: header(req, "svix-signature") },
      webhookSecret: secret,
    }) as unknown as EmailEvent;
  } catch {
    return res.status(401).json({ error: "Invalid signature" });
  }

  if (!event.type?.startsWith("email.")) return res.status(200).json({ ignored: true });

  const supabase = getServiceClient();
  try {
    // Find the campaign send: by our tag first, then by Resend's email id.
    const taggedId = event.data.tags?.send_id;
    let query = supabase.from("email_sends").select("id, campaign_id, email");
    query = taggedId ? query.eq("id", taggedId) : query.eq("resend_id", event.data.email_id ?? "");
    const { data: send, error: sendError } = await query.maybeSingle();
    if (sendError) throw sendError;
    if (!send) return res.status(200).json({ ignored: true });

    const occurredAt = event.created_at || new Date().toISOString();
    if (svixId) {
      const { data: seen, error: seenError } = await supabase
        .from("email_events")
        .select("id")
        .eq("svix_id", svixId)
        .maybeSingle();
      if (seenError) throw seenError;
      if (seen) return res.status(200).json({ duplicate: true });
    }

    // Stamp a timestamp only the first time it happens.
    const stampOnce = async (column: string, extra: Record<string, unknown> = {}) => {
      const { error } = await supabase
        .from("email_sends")
        .update({ [column]: occurredAt, ...extra })
        .eq("id", send.id)
        .is(column, null);
      if (error) throw error;
    };
    // Bounced/complained addresses are never mailed again (resolveAudience
    // skips everything in email_unsubscribes).
    const suppress = async (reason: "bounced" | "complained") => {
      const { error } = await supabase
        .from("email_unsubscribes")
        .upsert(
          { email: (send.email as string).toLowerCase(), campaign_id: send.campaign_id, reason },
          { onConflict: "email", ignoreDuplicates: true }
        );
      if (error) throw error;
    };

    switch (event.type) {
      case "email.sent":
        await stampOnce("sent_at");
        break;
      case "email.delivered":
        await stampOnce("delivered_at");
        break;
      case "email.opened":
        await stampOnce("opened_at");
        break;
      case "email.clicked":
        // A click proves an open (images may have been blocked).
        await stampOnce("opened_at");
        await stampOnce("clicked_at");
        break;
      case "email.bounced": {
        const permanent = (event.data.bounce?.type ?? "").toLowerCase() === "permanent";
        await stampOnce("bounced_at", { status: "bounced", bounce_type: event.data.bounce?.type ?? null });
        if (permanent) await suppress("bounced");
        break;
      }
      case "email.complained":
        await stampOnce("complained_at", { status: "complained" });
        await suppress("complained");
        await supabase
          .from("contacts")
          .update({ subscribed: false, updated_at: new Date().toISOString() })
          .eq("email", (send.email as string).toLowerCase());
        break;
      case "email.failed":
      case "email.suppressed": {
        const reason =
          event.type === "email.failed"
            ? event.data.failed?.reason
            : `Suppressed by Resend: ${event.data.suppressed?.message ?? event.data.suppressed?.type ?? ""}`;
        const { error } = await supabase
          .from("email_sends")
          .update({ status: "failed", error: reason ?? event.type })
          .eq("id", send.id);
        if (error) throw error;
        break;
      }
    }

    // Recorded last: every update above is safe to repeat, so if anything
    // failed, Resend's retry re-applies it instead of being skipped as a
    // duplicate.
    const { error: insertError } = await supabase.from("email_events").upsert(
      {
        svix_id: svixId || null,
        send_id: send.id,
        campaign_id: send.campaign_id,
        type: event.type,
        link: event.data.click?.link ?? null,
        occurred_at: occurredAt,
        data: event.data,
      },
      { onConflict: "svix_id", ignoreDuplicates: true }
    );
    if (insertError) throw insertError;
    return res.status(200).json({ ok: true });
  } catch (error) {
    // 500 → Resend retries later, and the svix_id dedupe keeps that safe.
    console.error("[email webhook] failed:", error);
    return res.status(500).json({ error: "Failed to process event" });
  }
}
