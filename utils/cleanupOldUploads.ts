import { del } from "@vercel/blob";
import { getServiceClient } from "./supabase";

interface OldUploadRow {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  published_at: string | null;
  target_youtube: boolean;
  youtube_status: string;
  target_tiktok: boolean;
  tiktok_status: string;
}

const RETENTION_DAYS = 7;

// Deletes video_uploads rows (and their Blob-stored video/thumbnail
// files) a week after they actually finished publishing successfully —
// the raw source file's only job was getting the video onto YouTube/
// TikTok, and once that's done it just sits there costing storage.
//
// Deliberately narrow eligibility, to avoid a repeat of the 2026-09-02
// incident (a fuzzy list()-and-match cleanup script deleted files still
// needed by not-yet-published rows): only rows where `published_at` is
// set AND every platform the row actually targeted reached "published"
// (not "failed"/"not_connected"/"pending") are eligible — a video that
// failed to publish still needs its source file for a retry, so it's
// left alone regardless of age. Each Blob delete uses the row's own
// video_url/thumbnail_url directly (a known, exact path from our own
// database), never a fuzzy match against a separate storage listing.
export async function cleanupOldUploads(
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<{ id: string; title: string; publishedAt: string }[]> {
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("video_uploads")
    .select("id, title, video_url, thumbnail_url, published_at, target_youtube, youtube_status, target_tiktok, tiktok_status")
    .not("published_at", "is", null)
    .lte("published_at", cutoff)
    .returns<OldUploadRow[]>();

  if (error) throw error;

  const eligible = (data ?? []).filter((row) => {
    const youtubeOk = !row.target_youtube || row.youtube_status === "published";
    const tiktokOk = !row.target_tiktok || row.tiktok_status === "published";
    return youtubeOk && tiktokOk;
  });

  const results: { id: string; title: string; publishedAt: string }[] = [];

  for (const row of eligible) {
    results.push({ id: row.id, title: row.title, publishedAt: row.published_at! });
    if (dryRun) continue;

    try {
      await del(row.video_url);
    } catch (err) {
      console.error(`cleanupOldUploads: failed to delete video blob for ${row.id}:`, err);
    }
    if (row.thumbnail_url) {
      try {
        await del(row.thumbnail_url);
      } catch (err) {
        console.error(`cleanupOldUploads: failed to delete thumbnail blob for ${row.id}:`, err);
      }
    }

    const { error: deleteError } = await db.from("video_uploads").delete().eq("id", row.id);
    if (deleteError) {
      console.error(`cleanupOldUploads: failed to delete row ${row.id}:`, deleteError.message);
    }
  }

  return results;
}
