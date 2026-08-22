import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../utils/supabase";

interface ScheduledArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
  image_url: string | null;
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
    const { data, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, category, publish_date, meta_description, image_url")
      .eq("status", "scheduled")
      .order("publish_date", { ascending: true });

    if (error) throw error;
    return res.status(200).json((data ?? []) as ScheduledArticleItem[]);
  } catch (error) {
    console.error("list scheduled articles failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load scheduled articles: ${message}` });
  }
}
