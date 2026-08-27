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
  keywordResearch?: unknown;
  imageUrl?: unknown;
  authorUserId?: unknown;
  articleId?: unknown;
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
    keywordResearch,
    imageUrl,
    authorUserId,
    articleId,
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

    const articleRowBase = {
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
    };
    const imageUrlValue = typeof imageUrl === "string" && imageUrl ? imageUrl : null;
    const authorUserIdValue = typeof authorUserId === "string" && authorUserId ? authorUserId : null;
    const editingArticleId = typeof articleId === "string" && articleId ? articleId : null;

    if (editingArticleId) {
      // Re-scheduling an already-scheduled article (e.g. changing its
      // publish date from the Scheduled page) updates the existing row
      // in place rather than creating a duplicate.
      let { data: updatedRow, error: updateError } = await supabase
        .from("scheduled_articles")
        .update({ ...articleRowBase, image_url: imageUrlValue, author_user_id: authorUserIdValue })
        .eq("id", editingArticleId)
        .select("id")
        .single();

      if (updateError) {
        console.warn(
          "scheduled_articles update with image_url/author_user_id failed, retrying without them (run supabase/migrations/0004_header_image.sql and 0009_article_author.sql):",
          updateError.message
        );
        ({ data: updatedRow, error: updateError } = await supabase
          .from("scheduled_articles")
          .update(articleRowBase)
          .eq("id", editingArticleId)
          .select("id")
          .single());
      }

      if (updateError || !updatedRow) {
        throw updateError ?? new Error("Update to scheduled_articles returned no row");
      }

      return res.status(200).json({ articleId: updatedRow.id as string, publishDate: publishDateIso });
    }

    // image_url/author_user_id are optional columns (see
    // supabase/migrations/0004_header_image.sql and 0009_article_author.sql)
    // — degrade gracefully to scheduling without them if those migrations
    // haven't been run yet.
    let { data: articleRow, error: articleError } = await supabase
      .from("scheduled_articles")
      .insert({ ...articleRowBase, image_url: imageUrlValue, author_user_id: authorUserIdValue })
      .select("id")
      .single();

    if (articleError) {
      console.warn(
        "scheduled_articles insert with image_url/author_user_id failed, retrying without them (run supabase/migrations/0004_header_image.sql and 0009_article_author.sql):",
        articleError.message
      );
      ({ data: articleRow, error: articleError } = await supabase
        .from("scheduled_articles")
        .insert(articleRowBase)
        .select("id")
        .single());
    }

    if (articleError || !articleRow) {
      throw articleError ?? new Error("Insert into scheduled_articles returned no row");
    }

    const historyRow = {
      user_prompt: typeof originalPrompt === "string" ? originalPrompt : "",
      outline_generated: (outline as BlogOutline) ?? null,
      keywords_used: keywords,
      article_id: articleRow.id,
    };

    // keyword_research is an optional column (see
    // supabase/migrations/0003_keyword_research.sql) — degrade gracefully
    // to storing history without it if that migration hasn't been run yet.
    const { error: historyError } = await supabase
      .from("article_history")
      .insert({ ...historyRow, keyword_research: keywordResearch ?? null });

    if (historyError) {
      console.warn(
        "article_history insert with keyword_research failed, retrying without it (run supabase/migrations/0003_keyword_research.sql):",
        historyError.message
      );
      const { error: fallbackError } = await supabase.from("article_history").insert(historyRow);
      if (fallbackError) {
        throw fallbackError;
      }
    }

    return res.status(200).json({ articleId: articleRow.id as string, publishDate: publishDateIso });
  } catch (error) {
    console.error("schedule-article failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Scheduling failed: ${message}` });
  }
}
