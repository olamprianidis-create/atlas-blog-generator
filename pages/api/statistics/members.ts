import type { NextApiRequest, NextApiResponse } from "next";
import { listMembersForStatistics, type MemberStatisticsRow } from "../../../utils/websiteDb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MemberStatisticsRow[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const members = await listMembersForStatistics();
    return res.status(200).json(members);
  } catch (error) {
    console.error("list members for statistics failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load members: ${message}` });
  }
}
