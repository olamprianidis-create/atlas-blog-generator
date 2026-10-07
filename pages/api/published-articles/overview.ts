import type { NextApiRequest, NextApiResponse } from "next";
import { ArticlesOverview, getArticlesOverview } from "../../../utils/articleAnalytics";
import { errorMessage } from "../../../utils/errorMessage";

// All-articles views/engagement summary for the top of the Published page.
export default async function handler(req: NextApiRequest, res: NextApiResponse<ArticlesOverview | { error: string }>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    return res.status(200).json(await getArticlesOverview());
  } catch (error) {
    console.error("articles overview failed:", error);
    return res.status(502).json({ error: `Failed to load article analytics: ${errorMessage(error)}` });
  }
}
