import { getServiceClient } from "./supabase";

export interface PublishLogEntry {
  articleId: string;
  status: "success" | "error";
  message: string;
}

// Logs every publish attempt to the console (always) and, best-effort,
// to the optional `article_publish_log` Supabase table — see
// supabase/migrations/0002_publish_log.sql. If that table hasn't been
// created yet this silently falls back to console-only logging.
export async function logPublishAttempt({ articleId, status, message }: PublishLogEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  const line = `[publish-log] ${timestamp} article=${articleId} status=${status} ${message}`;

  if (status === "error") {
    console.error(line);
  } else {
    console.log(line);
  }

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("article_publish_log").insert({
      article_id: articleId,
      status,
      message,
      attempted_at: timestamp,
    });

    if (error) {
      console.warn("[publish-log] could not write to article_publish_log:", error.message);
    }
  } catch (error) {
    console.warn(
      "[publish-log] article_publish_log insert failed (table may not exist yet — run supabase/migrations/0002_publish_log.sql):",
      error instanceof Error ? error.message : error
    );
  }
}
