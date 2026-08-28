import { getServiceClient } from "./supabase";
import { uploadVideoToYoutube } from "./youtube";
import { publishVideoToTiktok } from "./tiktok";

interface VideoUploadRow {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  video_url: string;
  thumbnail_url: string | null;

  target_youtube: boolean;
  youtube_status: string;
  youtube_privacy_status: "public" | "unlisted" | "private" | null;
  youtube_category_id: string | null;
  youtube_made_for_kids: boolean;

  target_tiktok: boolean;
  tiktok_status: string;
  tiktok_privacy_level: string | null;
  tiktok_disable_comment: boolean;
  tiktok_disable_duet: boolean;
  tiktok_disable_stitch: boolean;
  tiktok_cover_timestamp_ms: number | null;
}

export interface PublishVideoResult {
  success: boolean;
  uploadId: string;
  youtubeError?: string;
  tiktokError?: string;
}

// Shared by the Uploads page's immediate-publish path (pages/api/uploads/
// index.ts) and the scheduled-video cron check (pages/api/cron/
// publish-scheduled.ts) — one place that actually talks to YouTube/TikTok,
// so a video scheduled for later gets published exactly the same way an
// immediate one does, not a second, drifting code path.
export async function publishVideoUploadById(uploadId: string): Promise<PublishVideoResult> {
  const db = getServiceClient();

  const { data: row, error: fetchError } = await db
    .from("video_uploads")
    .select("*")
    .eq("id", uploadId)
    .single<VideoUploadRow>();

  if (fetchError || !row) {
    return { success: false, uploadId, youtubeError: fetchError?.message ?? "Upload not found" };
  }

  const updates: Record<string, unknown> = {};
  let youtubeError: string | undefined;
  let tiktokError: string | undefined;

  if (row.target_youtube && row.youtube_status === "pending") {
    try {
      const videoId = await uploadVideoToYoutube({
        videoUrl: row.video_url,
        title: row.title,
        description: row.description ?? undefined,
        tags: row.tags,
        categoryId: row.youtube_category_id ?? undefined,
        privacyStatus: row.youtube_privacy_status ?? "public",
        madeForKids: row.youtube_made_for_kids,
        thumbnailUrl: row.thumbnail_url ?? undefined,
      });
      updates.youtube_status = "published";
      updates.youtube_video_id = videoId;
      updates.youtube_error = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      youtubeError = message;
      updates.youtube_status = message.includes("isn't connected") ? "not_connected" : "failed";
      updates.youtube_error = message;
    }
  }

  if (row.target_tiktok && row.tiktok_status === "pending") {
    try {
      const publishId = await publishVideoToTiktok({
        videoUrl: row.video_url,
        title: row.title,
        privacyLevel: row.tiktok_privacy_level ?? "PUBLIC_TO_EVERYONE",
        disableComment: row.tiktok_disable_comment,
        disableDuet: row.tiktok_disable_duet,
        disableStitch: row.tiktok_disable_stitch,
        coverTimestampMs: row.tiktok_cover_timestamp_ms ?? 1000,
      });
      updates.tiktok_status = "published";
      updates.tiktok_publish_id = publishId;
      updates.tiktok_error = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      tiktokError = message;
      updates.tiktok_status = message.includes("isn't connected") ? "not_connected" : "failed";
      updates.tiktok_error = message;
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.published_at = new Date().toISOString();
    await db.from("video_uploads").update(updates).eq("id", uploadId);
  }

  return { success: !youtubeError && !tiktokError, uploadId, youtubeError, tiktokError };
}
