import { getServiceClient } from "./supabase";
import { countWords, calculateReadingTime } from "./markdown";
import { slugify } from "./slug";
import { logPublishAttempt } from "./webhookLogger";

export interface PublishResult {
  success: boolean;
  articleId: string;
  error?: string;
}

interface ScheduledArticleRow {
  id: string;
  title: string;
  content_markdown: string;
  content_html: string | null;
  keywords: string[];
  meta_description: string;
  category: string;
  publish_date: string;
  status: string;
}

const WEBHOOK_TIMEOUT_MS = 10_000;

// Shared by both pages/api/publish-article.ts (manual/single trigger,
// used by the "Publish Now" button) and pages/api/cron/publish-scheduled.ts
// (batch trigger). Calling this directly avoids one API route making an
// HTTP self-call to another — both routes just call this function.
export async function publishArticleById(articleId: string): Promise<PublishResult> {
  const supabase = getServiceClient();

  const { data: article, error: fetchError } = await supabase
    .from("scheduled_articles")
    .select("id, title, content_markdown, content_html, keywords, meta_description, category, publish_date, status")
    .eq("id", articleId)
    .single<ScheduledArticleRow>();

  if (fetchError || !article) {
    const message = fetchError?.message ?? "Article not found";
    await logPublishAttempt({ articleId, status: "error", message });
    return { success: false, articleId, error: message };
  }

  if (article.status !== "scheduled") {
    const message = `Article status is "${article.status}", expected "scheduled" — skipping`;
    await logPublishAttempt({ articleId, status: "error", message });
    return { success: false, articleId, error: message };
  }

  const webhookUrl = process.env.WEBSITE_WEBHOOK_URL;
  if (!webhookUrl) {
    const message = "Missing WEBSITE_WEBHOOK_URL in environment variables";
    await logPublishAttempt({ articleId, status: "error", message });
    return { success: false, articleId, error: message };
  }

  const wordCount = countWords(article.content_markdown);
  const readingTimeMinutes = calculateReadingTime(wordCount);

  const payload = {
    article_id: article.id,
    title: article.title,
    slug: slugify(article.title),
    content_markdown: article.content_markdown,
    content_html: article.content_html,
    frontmatter: {
      title: article.title,
      author: "Atlas Network",
      date: article.publish_date,
      keywords: article.keywords,
      meta_description: article.meta_description,
      category: article.category,
      readingTime: `${readingTimeMinutes} min read`,
    },
    publish_date: article.publish_date,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.WEBSITE_WEBHOOK_SECRET) {
      headers.Authorization = `Bearer ${process.env.WEBSITE_WEBHOOK_SECRET}`;
    }

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const message = `Webhook responded ${response.status}: ${body.slice(0, 300)}`;
      await logPublishAttempt({ articleId, status: "error", message });
      return { success: false, articleId, error: message };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook request failed";
    await logPublishAttempt({ articleId, status: "error", message });
    return { success: false, articleId, error: message };
  }

  const { error: updateError } = await supabase
    .from("scheduled_articles")
    .update({ status: "published" })
    .eq("id", articleId);

  if (updateError) {
    const message = `Webhook succeeded but status update failed: ${updateError.message}`;
    await logPublishAttempt({ articleId, status: "error", message });
    return { success: false, articleId, error: message };
  }

  await logPublishAttempt({ articleId, status: "success", message: "Published via webhook" });
  return { success: true, articleId };
}
