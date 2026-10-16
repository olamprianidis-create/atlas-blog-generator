import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../../utils/supabase";
import { CAMPAIGN_COLUMNS, EmailCampaign } from "../../../../../utils/emailCampaigns";
import { buildPublishDate } from "../../../../../utils/timezones";
import { errorMessage } from "../../../../../utils/errorMessage";

// Content Calendar drag-and-drop: moves a scheduled (not yet sending)
// campaign to another day, keeping its send time and time zone. Only the
// date changes — everything else stays locked, as it is for any scheduled
// campaign. The status filter makes it atomic with the sender cron.
export default async function handler(req: NextApiRequest, res: NextApiResponse<EmailCampaign | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing campaign id" });
  const { sendDate } = req.body as { sendDate?: unknown };
  if (typeof sendDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sendDate)) {
    return res.status(400).json({ error: "Invalid sendDate" });
  }

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
    if (campaign.status !== "scheduled") {
      return res.status(409).json({ error: "Only a scheduled campaign that hasn't started sending can be moved." });
    }
    const sendTime = campaign.send_time ?? campaign.send_at?.slice(11, 16) ?? "09:00";

    const { data, error } = await supabase
      .from("email_campaigns")
      .update({
        send_date: sendDate,
        send_time: sendTime,
        send_at: buildPublishDate(sendDate, sendTime, campaign.timezone).toISOString(),
        send_immediately: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "scheduled")
      .select(CAMPAIGN_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: "This campaign started sending — it can't be moved now." });
    return res.status(200).json(data as EmailCampaign);
  } catch (error) {
    console.error("reschedule campaign failed:", error);
    return res.status(502).json({ error: `Failed to move campaign: ${errorMessage(error)}` });
  }
}
