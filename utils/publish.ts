import { getServiceClient } from "./supabase";
import { logPublishAttempt } from "./webhookLogger";
import { autoPostToDiscord } from "./discord";
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
  linkedin_auto_share: boolean;
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

  let { data: article, error: fetchError } = await supabase
    .from("scheduled_articles")
    .select("id, status, title, meta_description, linkedin_auto_share")
    .eq("id", articleId)
    .single<ScheduledArticleRow>();

  if (fetchError) {
    // linkedin_auto_share is an optional column (0015_linkedin_auto_share.sql)
    // — degrade gracefully to publishing without the toggle (defaulting to
    // sharing, the same behavior every article had before this migration)
    // if it hasn't been run yet.
    console.warn(
      "scheduled_articles select with linkedin_auto_share failed, retrying without it (run supabase/migrations/0015_linkedin_auto_share.sql):",
      fetchError.message
    );
    const fallback = await supabase
      .from("scheduled_articles")
      .select("id, status, title, meta_description")
      .eq("id", articleId)
      .single();
    article = fallback.data ? ({ ...fallback.data, linkedin_auto_share: true } as ScheduledArticleRow) : null;
    fetchError = fallback.error;
  }

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

  // Re-enabled 2026-08-30 now that LinkedIn is actually connected (see
  // CLAUDE.md's "LinkedIn" section — this was disabled 2026-08-28 when it
  // wasn't). Best-effort: a LinkedIn failure only records status/error on
  // the article row, it never fails the publish itself (which already
  // succeeded above). Covers both the "Publish Now" button and the
  // scheduled-article cron path, since both call this same function.
  // Gated on the per-article linkedin_auto_share toggle (Step 5) — off
  // just leaves linkedin_status at its "not_posted" default, same as an
  // article that hasn't published yet.
  if (article.linkedin_auto_share) {
    try {
      const urn = await postArticleToLinkedin({
        title: article.title,
        summary: article.meta_description ?? undefined,
        articleUrl: buildArticleUrl(article.title),
      });
      await supabase
        .from("scheduled_articles")
        .update({
          linkedin_status: "posted",
          linkedin_post_urn: urn,
          linkedin_error: null,
          linkedin_posted_at: new Date().toISOString(),
        })
        .eq("id", articleId);
    } catch (linkedinError) {
      const message = linkedinError instanceof Error ? linkedinError.message : "Unknown error";
      const status = message.includes("isn't connected") || message.includes("connection expired") ? "not_connected" : "failed";
      await supabase.from("scheduled_articles").update({ linkedin_status: status, linkedin_error: message }).eq("id", articleId);
      console.error("linkedin auto-post failed:", linkedinError);
    }
  }

  try {
    await autoPostToDiscord(`📝 New article published: **${article.title}** — ${buildArticleUrl(article.title)}`);
  } catch (discordError) {
    // Best-effort — a Discord hiccup shouldn't undo a successful publish.
    console.error("discord auto-post (article) failed:", discordError);
  }

  return { success: true, articleId };
}
