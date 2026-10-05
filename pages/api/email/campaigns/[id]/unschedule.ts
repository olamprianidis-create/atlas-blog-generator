import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../../utils/supabase";
import { CAMPAIGN_COLUMNS, EmailCampaign } from "../../../../../utils/emailCampaigns";

// Moves a scheduled campaign back to draft so it can be edited. Only works
// before sending has started — the status filter makes that atomic.
export default async function handler(req: NextApiRequest, res: NextApiResponse<EmailCampaign | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing campaign id" });

  try {
    const { data, error } = await getServiceClient()
      .from("email_campaigns")
      .update({ status: "draft", scheduled_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "scheduled")
      .select(CAMPAIGN_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: "Only a scheduled campaign that hasn't started sending can be unscheduled." });
    return res.status(200).json(data as EmailCampaign);
  } catch (error) {
    console.error("unschedule campaign failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to unschedule: ${message}` });
  }
}
