import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../utils/supabase";

interface ScheduledArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
  image_url: string | null;
  linkedin_auto_share: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScheduledArticleItem[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getServiceClient();
    let { data, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, category, publish_date, meta_description, image_url, linkedin_auto_share")
      .eq("status", "scheduled")
      .order("publish_date", { ascending: true });

    if (error) {
      // linkedin_auto_share is an optional column (0015_linkedin_auto_share.sql)
      // — degrade gracefully to defaulting every row to true (the same
      // behavior every article had before that migration) if it hasn't
      // been run yet.
      console.warn(
        "scheduled_articles list with linkedin_auto_share failed, retrying without it (run supabase/migrations/0015_linkedin_auto_share.sql):",
        error.message
      );
      const fallback = await supabase
        .from("scheduled_articles")
        .select("id, title, category, publish_date, meta_description, image_url")
        .eq("status", "scheduled")
        .order("publish_date", { ascending: true });
      data = (fallback.data ?? []).map((row) => ({ ...row, linkedin_auto_share: true }));
      error = fallback.error;
    }

    if (error) throw error;
    return res.status(200).json((data ?? []) as ScheduledArticleItem[]);
  } catch (error) {
    console.error("list scheduled articles failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load scheduled articles: ${message}` });
  }
}
