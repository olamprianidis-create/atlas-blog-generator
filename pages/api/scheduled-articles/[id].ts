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
  linkedin_auto_share: boolean;
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
          "id, title, content_markdown, content_html, keywords, meta_description, category, publish_date, image_url, author_user_id, status, linkedin_status, linkedin_error, linkedin_auto_share"
        )
        .eq("id", id)
        .single();

      if (error) {
        // author_user_id (0009) and linkedin_auto_share (0015) are both
        // optional columns — degrade gracefully if those migrations
        // haven't been run yet.
        console.warn(
          "get scheduled article with author_user_id/linkedin_auto_share failed, retrying without them (run supabase/migrations/0009_article_author.sql and 0015_linkedin_auto_share.sql):",
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

      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: "Article not found" });

      const result = { ...data } as ScheduledArticleDetail;
      if (result.linkedin_auto_share === undefined) result.linkedin_auto_share = true;
      return res.status(200).json(result);
    } catch (error) {
      console.error("get scheduled article failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load article: ${message}` });
    }
  }

  if (req.method === "PATCH") {
    const { linkedinAutoShare } = req.body as { linkedinAutoShare?: unknown };
    if (typeof linkedinAutoShare !== "boolean") {
      return res.status(400).json({ error: "Missing or invalid linkedinAutoShare" });
    }
    try {
      const { error } = await supabase
        .from("scheduled_articles")
        .update({ linkedin_auto_share: linkedinAutoShare })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return res.status(200).json({});
    } catch (error) {
      console.error("update linkedin_auto_share failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to update article: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      await supabase.from("article_history").delete().eq("article_id", id);

      const { error } = await supabase.from("scheduled_articles").delete().eq("id", id);
      if (error) throw new Error(error.message);

      return res.status(200).json({});
    } catch (error) {
      console.error("delete scheduled article failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to delete article: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
