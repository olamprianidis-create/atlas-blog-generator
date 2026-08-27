import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../utils/supabase";

interface PublishedArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
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
    const { data, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, category, publish_date, meta_description, linkedin_status, linkedin_error")
      .eq("status", "published")
      .order("publish_date", { ascending: false });

    if (error) throw error;
    return res.status(200).json((data ?? []) as PublishedArticleItem[]);
  } catch (error) {
    console.error("list published articles failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load published articles: ${message}` });
  }
}
