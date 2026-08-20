import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { publishArticleById } from "../../../utils/publish";

interface CronResponse {
  checked: number;
  published: number;
  results: { articleId: string; success: boolean; error?: string }[];
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

  return res.status(200).json({ checked: results.length, published: publishedCount, results });
}
