import { getServiceClient } from "./supabase";

export interface ArticleStats {
  totalViews: number;
  uniqueViewers: number;
  avgTimeOnPageSeconds: number | null;
  impressions: number;
  clicksFromListing: number;
  ctrPercent: number | null;
  viewsByDay: { date: string; views: number }[];
  referrerBreakdown: { category: string; count: number }[];
  deviceBreakdown: { device: string; count: number }[];
}

const REFERRER_LABELS: Record<string, string> = {
  direct: "Direct",
  internal_listing: "Articles page",
  internal_other: "Other ATLAS page",
  social: "Social",
  search: "Search",
  other: "Other",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
  unknown: "Unknown",
};

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

// Reads the 3 tables from supabase/migrations/0010_article_analytics.sql
// (written to by the ATLAS Website — see its src/lib/supabase.ts) via the
// service-role client, which bypasses the insert-only RLS policies those
// tables have for anon. Every query here degrades to empty results if the
// migration hasn't been run yet, rather than throwing — the Statistics
// page should show "no data yet," not a broken page.
export async function getArticleStats(articleId: string): Promise<ArticleStats> {
  const supabase = getServiceClient();

  const [viewsResult, impressionsResult, durationsResult] = await Promise.all([
    supabase
      .from("article_page_views")
      .select("visitor_id, referrer_category, device_type, created_at")
      .eq("article_id", articleId),
    supabase.from("article_impressions").select("id").eq("article_id", articleId),
    supabase.from("article_view_durations").select("duration_seconds").eq("article_id", articleId),
  ]);

  const views = viewsResult.data ?? [];
  const impressions = impressionsResult.data ?? [];
  const durations = durationsResult.data ?? [];

  const totalViews = views.length;
  const uniqueViewers = new Set(views.map((v) => v.visitor_id)).size;
  const clicksFromListing = views.filter((v) => v.referrer_category === "internal_listing").length;
  const impressionCount = impressions.length;
  const ctrPercent = impressionCount > 0 ? (clicksFromListing / impressionCount) * 100 : null;

  const avgTimeOnPageSeconds =
    durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d.duration_seconds, 0) / durations.length)
      : null;

  const viewsByDayMap = new Map<string, number>();
  for (const view of views) {
    const key = toDateKey(view.created_at);
    viewsByDayMap.set(key, (viewsByDayMap.get(key) ?? 0) + 1);
  }
  const viewsByDay = Array.from(viewsByDayMap.entries())
    .map(([date, count]) => ({ date, views: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const referrerCounts = new Map<string, number>();
  for (const view of views) {
    const label = REFERRER_LABELS[view.referrer_category] ?? view.referrer_category;
    referrerCounts.set(label, (referrerCounts.get(label) ?? 0) + 1);
  }
  const referrerBreakdown = Array.from(referrerCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const deviceCounts = new Map<string, number>();
  for (const view of views) {
    const label = DEVICE_LABELS[view.device_type] ?? view.device_type;
    deviceCounts.set(label, (deviceCounts.get(label) ?? 0) + 1);
  }
  const deviceBreakdown = Array.from(deviceCounts.entries())
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalViews,
    uniqueViewers,
    avgTimeOnPageSeconds,
    impressions: impressionCount,
    clicksFromListing,
    ctrPercent,
    viewsByDay,
    referrerBreakdown,
    deviceBreakdown,
  };
}
