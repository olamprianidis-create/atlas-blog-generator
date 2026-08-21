import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";

interface ScheduledArticleDetail {
  id: string;
  title: string;
  content_markdown: string;
  content_html: string | null;
  keywords: string[];
  meta_description: string;
  category: string;
  publish_date: string | null;
  image_url: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScheduledArticleDetail | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing article id" });
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, content_markdown, content_html, keywords, meta_description, category, publish_date, image_url")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Article not found" });

    return res.status(200).json(data as ScheduledArticleDetail);
  } catch (error) {
    console.error("get scheduled article failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load article: ${message}` });
  }
}
