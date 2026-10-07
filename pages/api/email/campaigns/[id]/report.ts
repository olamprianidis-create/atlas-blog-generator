import type { NextApiRequest, NextApiResponse } from "next";
import { getCampaignReport } from "../../../../../utils/emailAnalytics";
import { CampaignReport } from "../../../../../utils/emailAnalyticsShared";

export default async function handler(req: NextApiRequest, res: NextApiResponse<CampaignReport | { error: string }>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing campaign id" });
  try {
    const report = await getCampaignReport(id);
    if (!report) return res.status(404).json({ error: "Campaign not found" });
    return res.status(200).json(report);
  } catch (error) {
    console.error("campaign report failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load report: ${message}` });
  }
}
