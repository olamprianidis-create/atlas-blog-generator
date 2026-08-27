import { getServiceClient } from "./supabase";
import { logPublishAttempt } from "./webhookLogger";
import { postArticleToLinkedin } from "./linkedin";
import { buildArticleUrl } from "./site";

export interface PublishResult {
  success: boolean;
  articleId: string;
  error?: string;
}

interface ScheduledArticleRow {
  id: string;
  status: string;
  title: string;
  meta_description: string | null;
}

// Shared by both pages/api/publish-article.ts (manual/single trigger,
// used by the "Publish Now" button) and pages/api/cron/publish-scheduled.ts
// (batch trigger). Calling this directly avoids one API route making an
// HTTP self-call to another — both routes just call this function.
//
// The ATLAS Website reads published articles straight out of the
// scheduled_articles table (see its src/lib/supabase.ts,
// getPublishedArticles()) — it's a pull model, not push. There is no
// separate publish webhook: flipping status to "published" here is the
// entire publish action, and the article appears on the site on its next
// request (its /articles and /article/[slug] routes are force-dynamic).
export async function publishArticleById(articleId: string): Promise<PublishResult> {
  const supabase = getServiceClient();

  const { data: article, error: fetchError } = await supabase
    .from("scheduled_articles")
    .select("id, status, title, meta_description")
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

  const { error: updateError } = await supabase
    .from("scheduled_articles")
    .update({ status: "published" })
    .eq("id", articleId);

  if (updateError) {
    await logPublishAttempt({ articleId, status: "error", message: updateError.message });
    return { success: false, articleId, error: updateError.message };
  }

  await logPublishAttempt({ articleId, status: "success", message: "Marked published" });

  // Best-effort — a LinkedIn failure (not connected, expired token, rate
  // limit) never rolls back or fails the article publish itself.
  await postArticleToLinkedinBestEffort(articleId, article.title, article.meta_description);

  return { success: true, articleId };
}

async function postArticleToLinkedinBestEffort(
  articleId: string,
  title: string,
  metaDescription: string | null
): Promise<void> {
  const supabase = getServiceClient();

  try {
    const urn = await postArticleToLinkedin({
      title,
      summary: metaDescription ?? undefined,
      articleUrl: buildArticleUrl(title),
    });
    await supabase
      .from("scheduled_articles")
      .update({ linkedin_status: "posted", linkedin_post_urn: urn, linkedin_error: null, linkedin_posted_at: new Date().toISOString() })
      .eq("id", articleId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("scheduled_articles")
      .update({
        linkedin_status: message.includes("isn't connected") || message.includes("connection expired") ? "not_connected" : "failed",
        linkedin_error: message,
      })
      .eq("id", articleId);
  }
}
