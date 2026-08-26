import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { uploadVideoToYoutube } from "../../../utils/youtube";
import { publishVideoToTiktok } from "../../../utils/tiktok";

interface CreateUploadBody {
  title: string;
  description?: string;
  tags?: string[];
  videoUrl: string;
  thumbnailUrl?: string;
  publishAt?: string | null;

  targetYoutube: boolean;
  youtubePrivacyStatus: "public" | "unlisted" | "private";
  youtubeCategoryId?: string;
  youtubeMadeForKids: boolean;

  targetTiktok: boolean;
  tiktokPrivacyLevel: string;
  tiktokDisableComment: boolean;
  tiktokDisableDuet: boolean;
  tiktokDisableStitch: boolean;
  tiktokCoverTimestampMs: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getServiceClient();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("video_uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ uploads: data });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as CreateUploadBody;

  if (!body.title?.trim()) {
    return res.status(400).json({ error: "Title is required." });
  }
  if (!body.videoUrl) {
    return res.status(400).json({ error: "A video file is required." });
  }
  if (!body.targetYoutube && !body.targetTiktok) {
    return res.status(400).json({ error: "Select at least one platform." });
  }

  const isScheduled = !!body.publishAt && new Date(body.publishAt).getTime() > Date.now();

  const { data: row, error: insertError } = await db
    .from("video_uploads")
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      tags: body.tags ?? [],
      video_url: body.videoUrl,
      thumbnail_url: body.thumbnailUrl || null,
      publish_at: body.publishAt || null,

      target_youtube: body.targetYoutube,
      youtube_status: !body.targetYoutube ? "not_selected" : isScheduled ? "pending" : "publishing",
      youtube_privacy_status: body.youtubePrivacyStatus,
      youtube_category_id: body.youtubeCategoryId || null,
      youtube_made_for_kids: body.youtubeMadeForKids,

      target_tiktok: body.targetTiktok,
      tiktok_status: !body.targetTiktok ? "not_selected" : isScheduled ? "pending" : "publishing",
      tiktok_privacy_level: body.tiktokPrivacyLevel,
      tiktok_disable_comment: body.tiktokDisableComment,
      tiktok_disable_duet: body.tiktokDisableDuet,
      tiktok_disable_stitch: body.tiktokDisableStitch,
      tiktok_cover_timestamp_ms: body.tiktokCoverTimestampMs,
    })
    .select()
    .single();

  if (insertError || !row) {
    return res.status(500).json({ error: insertError?.message || "Failed to save the upload." });
  }

  if (isScheduled) {
    // Scheduled publishing isn't wired to a cron job yet — see CLAUDE.md's
    // "Uploads" section. The row is saved as "pending" so it's visible on
    // the Uploads page, but nothing currently flips it to "publishing".
    return res.status(201).json({ upload: row });
  }

  const updates: Record<string, unknown> = {};

  if (body.targetYoutube) {
    try {
      const videoId = await uploadVideoToYoutube({
        videoUrl: body.videoUrl,
        title: body.title.trim(),
        description: body.description,
        tags: body.tags,
        categoryId: body.youtubeCategoryId,
        privacyStatus: body.youtubePrivacyStatus,
        madeForKids: body.youtubeMadeForKids,
        thumbnailUrl: body.thumbnailUrl,
      });
      updates.youtube_status = "published";
      updates.youtube_video_id = videoId;
      updates.youtube_error = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updates.youtube_status = message.includes("isn't connected") ? "not_connected" : "failed";
      updates.youtube_error = message;
    }
  }

  if (body.targetTiktok) {
    try {
      const publishId = await publishVideoToTiktok({
        videoUrl: body.videoUrl,
        title: body.title.trim(),
        privacyLevel: body.tiktokPrivacyLevel,
        disableComment: body.tiktokDisableComment,
        disableDuet: body.tiktokDisableDuet,
        disableStitch: body.tiktokDisableStitch,
        coverTimestampMs: body.tiktokCoverTimestampMs,
      });
      updates.tiktok_status = "published";
      updates.tiktok_publish_id = publishId;
      updates.tiktok_error = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updates.tiktok_status = message.includes("isn't connected") ? "not_connected" : "failed";
      updates.tiktok_error = message;
    }
  }

  const anyPublished = updates.youtube_status === "published" || updates.tiktok_status === "published";
  if (anyPublished) {
    updates.published_at = new Date().toISOString();
  }
  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await db
    .from("video_uploads")
    .update(updates)
    .eq("id", row.id)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  return res.status(201).json({ upload: updated });
}
