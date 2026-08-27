import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../utils/supabase";

interface PublishedArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
  image_url: string | null;
  linkedin_status: string;
  linkedin_error: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublishedArticleItem[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getServiceClient();

    // image_url/linkedin_status/linkedin_error are optional columns (see
    // supabase/migrations/0004_header_image.sql and 0008_linkedin.sql) —
    // degrade gracefully to listing published articles without them if
    // those migrations haven't been run yet, instead of failing the whole
    // page for every article.
    const { data, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, category, publish_date, meta_description, image_url, linkedin_status, linkedin_error")
      .eq("status", "published")
      .order("publish_date", { ascending: false });

    if (!error) {
      return res.status(200).json((data ?? []) as PublishedArticleItem[]);
    }

    console.warn(
      "published-articles select with image_url/linkedin_status/linkedin_error failed, retrying without them (run supabase/migrations/0004_header_image.sql and 0008_linkedin.sql):",
      error.message
    );

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("scheduled_articles")
      .select("id, title, category, publish_date, meta_description")
      .eq("status", "published")
      .order("publish_date", { ascending: false });

    if (fallbackError) throw fallbackError;

    const items: PublishedArticleItem[] = (fallbackData ?? []).map((row) => ({
      ...row,
      image_url: null,
      linkedin_status: "not_posted",
      linkedin_error: null,
    }));
    return res.status(200).json(items);
  } catch (error) {
    console.error("list published articles failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load published articles: ${message}` });
  }
}
