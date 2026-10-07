// Server-only: actually sends Email campaigns through Resend.
//
// A campaign moves scheduled → sending → sent (or failed). On the first
// run the audience is resolved and frozen into email_sends (one "queued"
// row per recipient; unique (campaign_id, email) means nobody is queued
// twice). Each run then sends queued rows in Resend batches of up to 100
// until a time budget runs out — anything left is picked up by the next
// cron tick (pages/api/cron/publish-scheduled.ts), so a large audience
// can't hit the serverless time limit.
import { createHash } from "crypto";
import { Resend } from "resend";
import { getServiceClient } from "./supabase";
import { resolveAudience } from "./emailAudience";
import { renderCampaignEmail } from "./emailTemplate";
import { getSenderSettings } from "./emailSettings";
import {
  CAMPAIGN_COLUMNS,
  DEFAULT_BODY_STYLE,
  DEFAULT_HEADER_STYLE,
  EmailCampaign,
  withSectionDefaults,
} from "./emailCampaigns";

const BATCH_SIZE = 100; // Resend's batch API maximum
const TIME_BUDGET_MS = 40_000;

export function isEmailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  return new Resend(process.env.RESEND_API_KEY);
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

// The email_sends row id is the unsubscribe token: unguessable, and it
// identifies exactly which address to opt out.
export function unsubscribeUrl(sendId: string | null): string {
  return sendId ? `${appUrl()}/unsubscribe?id=${sendId}` : `${appUrl()}/unsubscribe?test=1`;
}

// Plain-text alternative (better deliverability than HTML-only).
function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/h2|\/li|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildMessage(campaign: EmailCampaign, to: string, sendId: string | null, subjectPrefix = "") {
  const sender = getSenderSettings();
  const unsubscribe = unsubscribeUrl(sendId);
  const html = renderCampaignEmail({
    headerHtml: campaign.header_html,
    headerStyle: withSectionDefaults(campaign.header_style, DEFAULT_HEADER_STYLE),
    bodyHtml: campaign.body_html,
    bodyStyle: withSectionDefaults(campaign.body_style, DEFAULT_BODY_STYLE),
    previewText: campaign.preview_text,
    mailingAddress: sender.mailingAddress,
    unsubscribeUrl: unsubscribe,
  });
  const text = [
    htmlToText(campaign.header_html),
    htmlToText(campaign.body_html),
    `—\n${sender.mailingAddress}\nUnsubscribe: ${unsubscribe}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    from: `${campaign.from_name.replace(/[<>"]/g, "")} <${sender.fromAddress}>`,
    to,
    replyTo: sender.replyTo,
    subject: `${subjectPrefix}${campaign.subject}`,
    html,
    text,
    // One-click unsubscribe (RFC 8058) — Gmail/Yahoo require it for bulk
    // senders. Mail clients POST to this URL; see pages/api/email/unsubscribe.ts.
    headers: sendId
      ? {
          "List-Unsubscribe": `<${appUrl()}/api/email/unsubscribe?id=${sendId}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  };
}

async function loadCampaign(id: string): Promise<EmailCampaign | null> {
  const { data, error } = await getServiceClient().from("email_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as EmailCampaign | null;
}

// Sends one copy of a campaign (saved state) to a single address, with
// "[Test] " on the subject. Doesn't touch the campaign or email_sends.
export async function sendTestEmail(campaignId: string, to: string): Promise<void> {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const { error } = await getResend().emails.send(buildMessage(campaign, to, null, "[Test] "));
  if (error) throw new Error(error.message);
}

// scheduled → sending, freezing the recipient list into email_sends.
// Returns false if someone else already claimed it (or it was unscheduled).
async function claimCampaign(campaign: EmailCampaign): Promise<boolean> {
  const supabase = getServiceClient();
  // Resolved before claiming, so a lookup failure leaves it "scheduled"
  // for the next tick rather than stuck in "sending".
  const { recipients } = await resolveAudience(campaign);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("email_campaigns")
    .update({ status: "sending", started_at: now, updated_at: now, recipient_count: recipients.length })
    .eq("id", campaign.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  if (recipients.length > 0) {
    const { error: insertError } = await supabase.from("email_sends").upsert(
      recipients.map((r) => ({
        campaign_id: campaign.id,
        email: r.email,
        first_name: r.firstName || null,
        last_name: r.lastName || null,
        contact_id: r.contactId,
        status: "queued",
      })),
      { onConflict: "campaign_id,email", ignoreDuplicates: true }
    );
    if (insertError) {
      await supabase.from("email_campaigns").update({ status: "scheduled", started_at: null }).eq("id", campaign.id);
      throw insertError;
    }
  }
  return true;
}

// Sends queued rows until none are left or the time budget runs out.
async function sendQueued(campaign: EmailCampaign, deadline: number): Promise<void> {
  const supabase = getServiceClient();
  const resend = getResend();

  while (Date.now() < deadline) {
    const { data: rows, error } = await supabase
      .from("email_sends")
      .select("id, email")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("id")
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    // Same rows → same key, so if Resend accepted a batch but we crashed
    // before recording it, the retry is deduplicated by Resend (24h window).
    const idempotencyKey = `campaign-${campaign.id}-${createHash("sha256")
      .update(rows.map((r) => r.id).join(","))
      .digest("hex")
      .slice(0, 32)}`;
    const messages = rows.map((r) => buildMessage(campaign, r.email as string, r.id as string));
    const { data, error: sendError } = await resend.batch.send(messages, { idempotencyKey });
    const now = new Date().toISOString();

    if (sendError || !data) {
      const message = sendError?.message ?? "Unknown Resend error";
      await supabase
        .from("email_sends")
        .update({ status: "failed", error: message })
        .in(
          "id",
          rows.map((r) => r.id)
        );
      await supabase.from("email_campaigns").update({ last_error: message }).eq("id", campaign.id);
      continue;
    }

    // Batch results come back in the same order as the request.
    await Promise.all(
      rows.map((r, i) =>
        supabase
          .from("email_sends")
          .update({ status: "sent", resend_id: data.data[i]?.id ?? null, sent_at: now })
          .eq("id", r.id)
      )
    );
  }
}

// Marks the campaign sent/failed once nothing is queued; otherwise just
// refreshes the counts so the Campaigns page shows progress.
async function finishIfDone(campaignId: string): Promise<void> {
  const supabase = getServiceClient();
  const count = async (statuses: string[]) => {
    const { count: n, error } = await supabase
      .from("email_sends")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", statuses);
    if (error) throw error;
    return n ?? 0;
  };
  const [queued, failed, sent] = await Promise.all([
    count(["queued"]),
    count(["failed"]),
    count(["sent", "delivered", "opened", "clicked", "bounced", "complained"]),
  ]);
  const now = new Date().toISOString();
  const done = queued === 0;
  await supabase
    .from("email_campaigns")
    .update({
      sent_count: sent,
      failed_count: failed,
      updated_at: now,
      ...(done ? { status: sent === 0 && failed > 0 ? "failed" : "sent", completed_at: now } : {}),
    })
    .eq("id", campaignId)
    .eq("status", "sending");
}

export interface CampaignSendResult {
  campaignId: string;
  error?: string;
}

// Starts or continues one campaign. Safe to call concurrently / repeatedly.
export async function processCampaign(campaignId: string, deadline = Date.now() + TIME_BUDGET_MS): Promise<CampaignSendResult> {
  try {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) return { campaignId, error: "Campaign not found" };
    if (campaign.status === "scheduled") {
      if (!campaign.send_at || new Date(campaign.send_at).getTime() > Date.now()) return { campaignId };
      if (!(await claimCampaign(campaign))) return { campaignId };
    } else if (campaign.status !== "sending") {
      return { campaignId };
    }
    await sendQueued(campaign, deadline);
    await finishIfDone(campaignId);
    return { campaignId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[emailSend] campaign ${campaignId} failed:`, error);
    await getServiceClient().from("email_campaigns").update({ last_error: message }).eq("id", campaignId);
    return { campaignId, error: message };
  }
}

// Cron entry point: every due scheduled campaign, plus any still sending.
export async function processDueCampaigns(): Promise<CampaignSendResult[]> {
  if (!isEmailSendingConfigured()) {
    console.warn("[emailSend] RESEND_API_KEY not set — leaving due campaigns scheduled.");
    return [];
  }
  const { data, error } = await getServiceClient()
    .from("email_campaigns")
    .select("id")
    .or(`and(status.eq.scheduled,send_at.lte.${new Date().toISOString()}),status.eq.sending`)
    .order("send_at");
  if (error) throw error;

  const deadline = Date.now() + TIME_BUDGET_MS;
  const results: CampaignSendResult[] = [];
  for (const row of data ?? []) {
    if (Date.now() >= deadline) break;
    results.push(await processCampaign(row.id as string, deadline));
  }
  return results;
}
