import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../../utils/supabase";
import { CAMPAIGN_COLUMNS, EmailCampaign, campaignProblems } from "../../../../../utils/emailCampaigns";
import { resolveAudience } from "../../../../../utils/emailAudience";
import { isEmailSendingConfigured, processCampaign } from "../../../../../utils/emailSend";
import { errorMessage } from "../../../../../utils/errorMessage";

export const config = { maxDuration: 60 };

// Confirms a draft: re-validates everything, snapshots the recipient count
// (the real list is rebuilt at send time, so later additions are included),
// and moves it to "scheduled". "Send immediately" schedules it for now and
// starts sending right away (the cron finishes anything left over).
export default async function handler(req: NextApiRequest, res: NextApiResponse<EmailCampaign | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing campaign id" });

  const supabase = getServiceClient();
  try {
    const { data: existing, error: loadError } = await supabase
      .from("email_campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return res.status(404).json({ error: "Campaign not found" });
    const campaign = existing as EmailCampaign;
    if (campaign.status !== "draft") return res.status(409).json({ error: "This campaign is already scheduled." });

    if (!isEmailSendingConfigured()) {
      return res.status(503).json({ error: "Email sending isn't set up — RESEND_API_KEY is missing." });
    }

    const problems = campaignProblems(campaign);
    if (problems.length) return res.status(400).json({ error: problems.join(" ") });

    const { stats } = await resolveAudience(campaign);
    if (stats.recipients === 0) return res.status(400).json({ error: "This audience has no one to send to." });

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("email_campaigns")
      .update({
        status: "scheduled",
        send_at: campaign.send_immediately ? now : campaign.send_at,
        recipient_count: stats.recipients,
        scheduled_at: now,
        current_step: 5,
        updated_at: now,
      })
      .eq("id", id)
      .eq("status", "draft")
      .select(CAMPAIGN_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: "This campaign was already scheduled." });
    if (!campaign.send_immediately) return res.status(200).json(data as EmailCampaign);

    await processCampaign(id);
    const { data: sent, error: reloadError } = await supabase
      .from("email_campaigns")
      .select(CAMPAIGN_COLUMNS)
      .eq("id", id)
      .single();
    if (reloadError) throw reloadError;
    return res.status(200).json(sent as EmailCampaign);
  } catch (error) {
    console.error("schedule campaign failed:", error);
    const message = errorMessage(error);
    return res.status(502).json({ error: `Failed to schedule: ${message}` });
  }
}
