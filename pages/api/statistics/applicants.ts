import type { NextApiRequest, NextApiResponse } from "next";
import { listMembershipRequests, type MembershipRequest } from "../../../utils/websiteDb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MembershipRequest[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const requests = await listMembershipRequests();
    return res.status(200).json(requests);
  } catch (error) {
    console.error("list membership requests failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load applicants: ${message}` });
  }
}
