import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../utils/supabase";
import { extractLinks } from "../../utils/markdown";
import { Category, CATEGORIES } from "../../utils/types";
import type { BlogOutline } from "../../utils/outline";

interface ScheduleArticleRequestBody {
  title?: unknown;
  markdown?: unknown;
  html?: unknown;
  metaDescription?: unknown;
  keywords?: unknown;
  category?: unknown;
  publishDateIso?: unknown;
  originalPrompt?: unknown;
  outline?: unknown;
}

interface ScheduleArticleResponse {
  articleId: string;
  publishDate: string;
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((c) => c.value === value);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScheduleArticleResponse | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    title,
    markdown,
    html,
    metaDescription,
    keywords,
    category,
    publishDateIso,
    originalPrompt,
    outline,
  } = req.body as ScheduleArticleRequestBody;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Missing article title" });
  }
  if (typeof markdown !== "string" || !markdown.trim()) {
    return res.status(400).json({ error: "Missing article content" });
  }
  if (typeof metaDescription !== "string" || !metaDescription.trim()) {
    return res.status(400).json({ error: "Missing meta description" });
  }
  if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === "string")) {
    return res.status(400).json({ error: "Missing or invalid keywords" });
  }
  if (!isCategory(category)) {
    return res.status(400).json({ error: "A category is required to schedule an article" });
  }
  if (typeof publishDateIso !== "string" || Number.isNaN(new Date(publishDateIso).getTime())) {
    return res.status(400).json({ error: "Missing or invalid publish date" });
  }

  try {
    const links = extractLinks(markdown);
    const internalLinks = links.filter((l) => l.isInternal).map((l) => ({ text: l.text, url: l.url }));
    const externalLinks = links.filter((l) => !l.isInternal).map((l) => ({ text: l.text, url: l.url }));

    const supabase = getServiceClient();

    const { data: articleRow, error: articleError } = await supabase
      .from("scheduled_articles")
      .insert({
        title,
        content_markdown: markdown,
        content_html: typeof html === "string" ? html : null,
        keywords,
        meta_description: metaDescription,
        category,
        internal_links: internalLinks,
        external_links: externalLinks,
        publish_date: publishDateIso,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (articleError || !articleRow) {
      throw articleError ?? new Error("Insert into scheduled_articles returned no row");
    }

    const { error: historyError } = await supabase.from("article_history").insert({
      user_prompt: typeof originalPrompt === "string" ? originalPrompt : "",
      outline_generated: (outline as BlogOutline) ?? null,
      keywords_used: keywords,
      article_id: articleRow.id,
    });

    if (historyError) {
      throw historyError;
    }

    return res.status(200).json({ articleId: articleRow.id as string, publishDate: publishDateIso });
  } catch (error) {
    console.error("schedule-article failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Scheduling failed: ${message}` });
  }
}
