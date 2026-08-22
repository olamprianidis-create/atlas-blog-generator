import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../utils/supabase";
import { buildArticleUrl } from "../../utils/site";
import { generateJSON } from "../../utils/anthropic";
import type { RelatedArticleItem, RelatedArticlesResponse } from "../../utils/relatedArticles";

const RECENT_LIMIT = 10;
const RECOMMENDED_LIMIT = 3;

interface PublishedRow {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RelatedArticlesResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { category, topic } = req.body as { category?: unknown; topic?: unknown };

  if (typeof category !== "string" || !category) {
    return res.status(400).json({ error: "Missing category" });
  }

  const topicText = typeof topic === "string" ? topic.trim() : "";

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("scheduled_articles")
      .select("id, title, category, publish_date, meta_description")
      .eq("status", "published")
      .eq("category", category)
      .order("publish_date", { ascending: false })
      .limit(RECENT_LIMIT);

    if (error) throw error;

    const rows = (data ?? []) as PublishedRow[];
    const recent: RelatedArticleItem[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: buildArticleUrl(row.title),
      category: row.category,
      publishDate: row.publish_date,
    }));

    if (recent.length === 0) {
      return res.status(200).json({ recommended: [], recent: [] });
    }

    let recommended = recent.slice(0, RECOMMENDED_LIMIT);

    if (topicText && recent.length > RECOMMENDED_LIMIT) {
      const candidateList = rows
        .map(
          (row, i) =>
            `${i}. "${row.title}"${row.meta_description ? ` — ${row.meta_description}` : ""}`
        )
        .join("\n");

      const prompt = `A new blog article is being written on this topic: "${topicText}"\n\nHere are previously published articles on the same site, each with an index number:\n${candidateList}\n\nPick the ${RECOMMENDED_LIMIT} articles most relevant to the new topic, for internal linking purposes. Return them ordered from most to least relevant.\n\nRespond with JSON: {"indices": [number, number, number]} using the index numbers above.`;

      const mockIndices = recent.slice(0, RECOMMENDED_LIMIT).map((_, i) => i);

      try {
        const ranked = await generateJSON<{ indices: number[] }>(prompt, { indices: mockIndices });
        const seen = new Set<number>();
        const validIndices = ranked.indices.filter(
          (i) => Number.isInteger(i) && i >= 0 && i < rows.length && !seen.has(i) && seen.add(i)
        );

        if (validIndices.length > 0) {
          recommended = validIndices.slice(0, RECOMMENDED_LIMIT).map((i) => recent[i]);
        }
      } catch (rankError) {
        console.error("related-articles ranking failed, falling back to most recent:", rankError);
      }
    }

    return res.status(200).json({ recommended, recent });
  } catch (error) {
    console.error("related-articles fetch failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load related articles: ${message}` });
  }
}
