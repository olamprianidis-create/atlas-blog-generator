import type { NextApiRequest, NextApiResponse } from "next";
import { listOnboardingSurveyResponses, type OnboardingSurveyResponse } from "../../../utils/websiteDb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OnboardingSurveyResponse[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const responses = await listOnboardingSurveyResponses();
    return res.status(200).json(responses);
  } catch (error) {
    console.error("list onboarding survey responses failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load survey responses: ${message}` });
  }
}
