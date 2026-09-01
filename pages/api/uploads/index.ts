import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { publishVideoUploadById } from "../../../utils/publishVideo";

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
  youtubeUploadType?: "video" | "short";

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

  const baseInsert = {
    title: body.title.trim(),
    description: body.description?.trim() || null,
    tags: body.tags ?? [],
    video_url: body.videoUrl,
    thumbnail_url: body.thumbnailUrl || null,
    publish_at: body.publishAt || null,

    target_youtube: body.targetYoutube,
    // Both the immediate and scheduled paths insert as "pending" —
    // publishVideoUploadById() is what actually flips it to
    // published/failed, called either right below (immediate) or later
    // by the cron check (scheduled). One code path does the real work
    // either way, so scheduling isn't a second, drifting implementation.
    youtube_status: !body.targetYoutube ? "not_selected" : "pending",
    youtube_privacy_status: body.youtubePrivacyStatus,
    youtube_category_id: body.youtubeCategoryId || null,
    youtube_made_for_kids: body.youtubeMadeForKids,

    target_tiktok: body.targetTiktok,
    tiktok_status: !body.targetTiktok ? "not_selected" : "pending",
    tiktok_privacy_level: body.tiktokPrivacyLevel,
    tiktok_disable_comment: body.tiktokDisableComment,
    tiktok_disable_duet: body.tiktokDisableDuet,
    tiktok_disable_stitch: body.tiktokDisableStitch,
    tiktok_cover_timestamp_ms: body.tiktokCoverTimestampMs,
  };

  let { data: row, error: insertError } = await db
    .from("video_uploads")
    .insert({ ...baseInsert, youtube_upload_type: body.youtubeUploadType || "video" })
    .select()
    .single();

  if (insertError) {
    // youtube_upload_type is an optional column (0016_youtube_upload_type.sql)
    // — degrade gracefully to inserting without it if that migration hasn't
    // been run yet.
    console.warn(
      "video_uploads insert with youtube_upload_type failed, retrying without it (run supabase/migrations/0016_youtube_upload_type.sql):",
      insertError.message
    );
    ({ data: row, error: insertError } = await db.from("video_uploads").insert(baseInsert).select().single());
  }

  if (insertError || !row) {
    return res.status(500).json({ error: insertError?.message || "Failed to save the upload." });
  }

  if (isScheduled) {
    // Row stays "pending" — pages/api/cron/publish-scheduled.ts checks
    // for due video_uploads rows (alongside scheduled articles) and calls
    // the same publishVideoUploadById() this immediate path uses below.
    return res.status(201).json({ upload: row });
  }

  await publishVideoUploadById(row.id);

  const { data: updated, error: refetchError } = await db
    .from("video_uploads")
    .select()
    .eq("id", row.id)
    .single();

  if (refetchError || !updated) {
    return res.status(500).json({ error: refetchError?.message ?? "Failed to reload the upload." });
  }

  return res.status(201).json({ upload: updated });
}
