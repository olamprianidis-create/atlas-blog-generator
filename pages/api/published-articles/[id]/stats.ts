import type { NextApiRequest, NextApiResponse } from "next";
import { getArticleStats, type ArticleStats } from "../../../../utils/articleAnalytics";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleStats | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Missing article id." });
  }

  try {
    const stats = await getArticleStats(id);
    return res.status(200).json(stats);
  } catch (error) {
    console.error("published-articles stats failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load article stats: ${message}` });
  }
}
