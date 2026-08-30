import { getServiceClient } from "./supabase";
import { logPublishAttempt } from "./webhookLogger";
import { autoPostToDiscord } from "./discord";
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

  // LinkedIn auto-posting disabled 2026-08-28 — it was blocking the
  // "just publish it" path (0008_linkedin.sql was never run, so every
  // attempt failed at the DB step) with no benefit while LinkedIn isn't
  // even connected yet. Revisit when LinkedIn is actually set up (see
  // CLAUDE.md's "LinkedIn" / "Platform setup checklist" sections) — the
  // manual "Share to LinkedIn" button on the Published page still exists
  // for posting individually once that's ready.

  try {
    await autoPostToDiscord(`📝 New article published: **${article.title}** — ${buildArticleUrl(article.title)}`);
  } catch (discordError) {
    // Best-effort — a Discord hiccup shouldn't undo a successful publish.
    console.error("discord auto-post (article) failed:", discordError);
  }

  return { success: true, articleId };
}
