import type { NextApiRequest, NextApiResponse } from "next";
import { getCampaignOverview } from "../../../../utils/emailAnalytics";
import { CampaignOverview } from "../../../../utils/emailAnalyticsShared";

// All-campaign totals + per-campaign rates for the Campaigns page strip.
export default async function handler(req: NextApiRequest, res: NextApiResponse<CampaignOverview | { error: string }>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    return res.status(200).json(await getCampaignOverview());
  } catch (error) {
    console.error("campaign overview failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load analytics: ${message}` });
  }
}
