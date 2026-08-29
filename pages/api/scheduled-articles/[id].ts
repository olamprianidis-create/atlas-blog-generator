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
  author_user_id: string | null;
  status: string;
  linkedin_status: string;
  linkedin_error: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScheduledArticleDetail | { error: string } | Record<string, never>>
) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing article id" });
  }

  const supabase = getServiceClient();

  if (req.method === "GET") {
    try {
      let { data, error } = await supabase
        .from("scheduled_articles")
        .select(
          "id, title, content_markdown, content_html, keywords, meta_description, category, publish_date, image_url, author_user_id, status, linkedin_status, linkedin_error"
        )
        .eq("id", id)
        .single();

      if (error) {
        // author_user_id is an optional column (see
        // supabase/migrations/0009_article_author.sql) — degrade
        // gracefully if that migration hasn't been run yet.
        console.warn(
          "get scheduled article with author_user_id failed, retrying without it (run supabase/migrations/0009_article_author.sql):",
          error.message
        );
        ({ data, error } = await supabase
          .from("scheduled_articles")
          .select(
            "id, title, content_markdown, content_html, keywords, meta_description, category, publish_date, image_url, status, linkedin_status, linkedin_error"
          )
          .eq("id", id)
          .single());
      }

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Article not found" });

      return res.status(200).json(data as ScheduledArticleDetail);
    } catch (error) {
      console.error("get scheduled article failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load article: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      await supabase.from("article_history").delete().eq("article_id", id);

      const { error } = await supabase.from("scheduled_articles").delete().eq("id", id);
      if (error) throw error;

      return res.status(200).json({});
    } catch (error) {
      console.error("delete scheduled article failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to delete article: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
