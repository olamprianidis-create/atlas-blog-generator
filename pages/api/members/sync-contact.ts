import type { NextApiRequest, NextApiResponse } from "next";
import { syncMemberContactChanges } from "../../../utils/memberSync";
import { errorMessage } from "../../../utils/errorMessage";

// Called by the ATLAS Website right after a member edits their email or
// phone in the Profile Editor, so Contacts updates immediately instead of
// on the next ~10-minute cron run. Public on purpose (like
// /api/email/newsletter-signup): it only takes a member id and re-reads
// that member from the Website database, so the request can't change
// anything by itself — at worst it triggers a no-op sync.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { userId } = req.body as { userId?: unknown };
  if (typeof userId !== "string" || !/^[a-z0-9]{10,40}$/i.test(userId)) {
    return res.status(400).json({ error: "Invalid userId" });
  }
  try {
    const { updated } = await syncMemberContactChanges(userId);
    return res.status(200).json({ updated: updated.length > 0 });
  } catch (error) {
    console.error("member contact sync failed:", error);
    return res.status(502).json({ error: `Sync failed: ${errorMessage(error)}` });
  }
}
