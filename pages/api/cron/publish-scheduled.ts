import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { publishArticleById } from "../../../utils/publish";
import { publishVideoUploadById } from "../../../utils/publishVideo";

interface CronResponse {
  checked: number;
  published: number;
  results: { articleId: string; success: boolean; error?: string }[];
  videosChecked: number;
  videosPublished: number;
  videoResults: { uploadId: string; success: boolean; youtubeError?: string; tiktokError?: string }[];
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
// when CRON_SECRET is set as a project env var (see vercel.json). If
// CRON_SECRET isn't set locally, the check is skipped so `npm run dev`
// + a manual curl still works without extra setup.
function isAuthorized(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const header = req.headers.authorization;
  return header === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CronResponse | { error: string }>) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getServiceClient();

  const { data: dueArticles, error } = await supabase
    .from("scheduled_articles")
    .select("id")
    .eq("status", "scheduled")
    .lte("publish_date", new Date().toISOString());

  if (error) {
    console.error("[cron/publish-scheduled] query failed:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const results: CronResponse["results"] = [];

  for (const row of dueArticles ?? []) {
    const result = await publishArticleById(row.id);
    results.push({ articleId: row.id, success: result.success, error: result.error });
  }

  const publishedCount = results.filter((r) => r.success).length;

  console.log(
    publishedCount > 0
      ? `[cron/publish-scheduled] Published ${publishedCount} article(s) of ${results.length} checked`
      : `[cron/publish-scheduled] No articles ready (${results.length} checked)`
  );

  // Scheduled video_uploads rows: only ones with a due publish_at AND at
  // least one platform still "pending" (an immediate/non-scheduled upload
  // has publish_at = null and is handled synchronously by
  // pages/api/uploads/index.ts, so it never matches this query).
  const { data: dueVideos, error: videoQueryError } = await supabase
    .from("video_uploads")
    .select("id")
    .not("publish_at", "is", null)
    .lte("publish_at", new Date().toISOString())
    .or("youtube_status.eq.pending,tiktok_status.eq.pending");

  if (videoQueryError) {
    console.error("[cron/publish-scheduled] video query failed:", videoQueryError.message);
  }

  const videoResults: CronResponse["videoResults"] = [];
  for (const row of dueVideos ?? []) {
    const result = await publishVideoUploadById(row.id);
    videoResults.push({
      uploadId: result.uploadId,
      success: result.success,
      youtubeError: result.youtubeError,
      tiktokError: result.tiktokError,
    });
  }

  const videosPublishedCount = videoResults.filter((r) => r.success).length;

  console.log(
    videosPublishedCount > 0
      ? `[cron/publish-scheduled] Published ${videosPublishedCount} video(s) of ${videoResults.length} checked`
      : `[cron/publish-scheduled] No videos ready (${videoResults.length} checked)`
  );

  return res.status(200).json({
    checked: results.length,
    published: publishedCount,
    results,
    videosChecked: videoResults.length,
    videosPublished: videosPublishedCount,
    videoResults,
  });
}
