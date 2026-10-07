import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";

// Opts an address out of every future campaign. `id` is the email_sends
// row the link came from (see unsubscribeUrl() in utils/emailSend.ts).
// POST only: the /unsubscribe page's button, and mail clients' one-click
// List-Unsubscribe (RFC 8058). Never on GET, so link scanners that
// pre-fetch URLs in emails can't unsubscribe anyone by accident.
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true } | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const id = typeof req.query.id === "string" ? req.query.id : typeof req.body?.id === "string" ? req.body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid unsubscribe link" });

  const supabase = getServiceClient();
  try {
    const { data: send, error } = await supabase
      .from("email_sends")
      .select("email, campaign_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!send) return res.status(404).json({ error: "This unsubscribe link isn't valid" });

    const email = (send.email as string).toLowerCase();
    const { error: upsertError } = await supabase
      .from("email_unsubscribes")
      .upsert({ email, campaign_id: send.campaign_id }, { onConflict: "email", ignoreDuplicates: true });
    if (upsertError) throw upsertError;
    const { error: contactError } = await supabase
      .from("contacts")
      .update({ subscribed: false, updated_at: new Date().toISOString() })
      .eq("email", email); // contacts store emails lowercased
    if (contactError) throw contactError;
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("unsubscribe failed:", error);
    return res.status(502).json({ error: "Something went wrong — please try again." });
  }
}
