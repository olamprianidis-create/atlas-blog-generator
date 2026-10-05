import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { CAMPAIGN_COLUMNS, EmailCampaign } from "../../../../utils/emailCampaigns";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EmailCampaign[] | { id: string } | { error: string }>
) {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select(CAMPAIGN_COLUMNS)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json((data ?? []) as EmailCampaign[]);
    } catch (error) {
      console.error("list campaigns failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load campaigns: ${message}` });
    }
  }

  // Creates an empty draft; the wizard fills it in step by step.
  if (req.method === "POST") {
    try {
      const { data, error } = await supabase.from("email_campaigns").insert({}).select("id").single();
      if (error) throw error;
      return res.status(201).json({ id: data.id as string });
    } catch (error) {
      console.error("create campaign failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to create campaign: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
