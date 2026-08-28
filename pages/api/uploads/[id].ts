import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";

interface UpdateUploadBody {
  title?: string;
  description?: string | null;
  tags?: string[];
  thumbnailUrl?: string | null;
  publishAt?: string | null;

  youtubePrivacyStatus?: "public" | "unlisted" | "private";
  youtubeCategoryId?: string;
  youtubeMadeForKids?: boolean;

  tiktokPrivacyLevel?: string;
  tiktokDisableComment?: boolean;
  tiktokDisableDuet?: boolean;
  tiktokDisableStitch?: boolean;
  tiktokCoverTimestampMs?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Missing upload id." });
  }

  const db = getServiceClient();

  if (req.method === "GET") {
    const { data, error } = await db.from("video_uploads").select("*").eq("id", id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Upload not found." });
    return res.status(200).json({ upload: data });
  }

  if (req.method === "PATCH") {
    const { data: existing, error: fetchError } = await db
      .from("video_uploads")
      .select("id, target_youtube, youtube_status, target_tiktok, tiktok_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!existing) return res.status(404).json({ error: "Upload not found." });

    // Once every targeted platform has actually gone live, its metadata
    // lives on that platform now — editing our local row wouldn't change
    // anything real there and would just desync our copy from what's
    // actually posted. Editing is only meaningful while at least one
    // targeted platform hasn't published yet (pending/failed/not_connected).
    const youtubeDone = !existing.target_youtube || existing.youtube_status === "published";
    const tiktokDone = !existing.target_tiktok || existing.tiktok_status === "published";
    if (youtubeDone && tiktokDone) {
      return res.status(400).json({ error: "This video has already published — it can no longer be edited here." });
    }

    const body = req.body as UpdateUploadBody;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.thumbnailUrl !== undefined) updates.thumbnail_url = body.thumbnailUrl || null;
    if (body.publishAt !== undefined) updates.publish_at = body.publishAt || null;

    if (body.youtubePrivacyStatus !== undefined) updates.youtube_privacy_status = body.youtubePrivacyStatus;
    if (body.youtubeCategoryId !== undefined) updates.youtube_category_id = body.youtubeCategoryId || null;
    if (body.youtubeMadeForKids !== undefined) updates.youtube_made_for_kids = body.youtubeMadeForKids;

    if (body.tiktokPrivacyLevel !== undefined) updates.tiktok_privacy_level = body.tiktokPrivacyLevel;
    if (body.tiktokDisableComment !== undefined) updates.tiktok_disable_comment = body.tiktokDisableComment;
    if (body.tiktokDisableDuet !== undefined) updates.tiktok_disable_duet = body.tiktokDisableDuet;
    if (body.tiktokDisableStitch !== undefined) updates.tiktok_disable_stitch = body.tiktokDisableStitch;
    if (body.tiktokCoverTimestampMs !== undefined) updates.tiktok_cover_timestamp_ms = body.tiktokCoverTimestampMs;

    const { data: updated, error: updateError } = await db
      .from("video_uploads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ upload: updated });
  }

  if (req.method === "DELETE") {
    // Only removes our own tracking row — does not un-publish an
    // already-live YouTube/TikTok video. The client is responsible for
    // warning the admin about that distinction before calling this.
    const { error } = await db.from("video_uploads").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({});
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
