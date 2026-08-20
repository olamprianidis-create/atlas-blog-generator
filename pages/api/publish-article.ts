import type { NextApiRequest, NextApiResponse } from "next";
import { publishArticleById } from "../../utils/publish";

interface PublishArticleResponse {
  success: boolean;
  articleId: string;
  status: "published";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublishArticleResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { article_id: articleId } = req.body as { article_id?: unknown };

  if (typeof articleId !== "string" || !articleId) {
    return res.status(400).json({ error: "Missing article_id" });
  }

  const result = await publishArticleById(articleId);

  if (!result.success) {
    return res.status(502).json({ error: result.error ?? "Publish failed" });
  }

  return res.status(200).json({ success: true, articleId, status: "published" });
}
