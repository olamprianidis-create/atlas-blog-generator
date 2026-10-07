import type { NextApiRequest, NextApiResponse } from "next";
import { AudienceOptions, AudienceStats } from "../../../utils/emailCampaigns";
import { getAudienceOptions, resolveAudience } from "../../../utils/emailAudience";
import { errorMessage } from "../../../utils/errorMessage";

// GET: counts for each audience checkbox. POST: the combined, de-duplicated
// recipient count for a selection (unsubscribes removed).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AudienceOptions | AudienceStats | { error: string }>
) {
  try {
    if (req.method === "GET") return res.status(200).json(await getAudienceOptions());

    if (req.method === "POST") {
      const body = req.body ?? {};
      const stringArray = (value: unknown): string[] =>
        Array.isArray(value) ? value.filter((v: unknown): v is string => typeof v === "string") : [];
      const { stats } = await resolveAudience({
        audience_list_ids: stringArray(body.audience_list_ids),
        audience_contact_ids: stringArray(body.audience_contact_ids),
        include_all_members: body.include_all_members === true,
        include_all_contacts: body.include_all_contacts === true,
      });
      return res.status(200).json(stats);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("audience request failed:", error);
    const message = errorMessage(error);
    return res.status(502).json({ error: `Failed to load audience: ${message}` });
  }
}
