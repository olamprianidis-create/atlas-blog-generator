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

// Median, not mean: one tab left open for hours (seen: 16,325s next to
// readings of 1–87s) would otherwise drag a mean to ~17 minutes.
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

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

  // Field name kept for compatibility; the value is the median (see median()).
  const avgTimeOnPageSeconds = median(durations.map((d) => d.duration_seconds));

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

// --- All-articles summary for the top of the Published page ---------------

export interface PeriodValue {
  allTime: number | null;
  last30: number | null;
  prev30: number | null; // the 30 days before that, for the ▲/▼
}

export interface ArticlesOverview {
  views: PeriodValue;
  uniqueReaders: PeriodValue;
  avgTimeOnPageSeconds: PeriodValue;
  ctrPercent: PeriodValue; // clicks from the /articles listing ÷ impressions there
}

const PAGE = 1000; // Supabase's per-request row cap

async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const supabase = getServiceClient();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order("created_at").range(from, from + PAGE - 1);
    if (error) return rows; // table missing (migration not run) → treat as no data
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getArticlesOverview(): Promise<ArticlesOverview> {
  const [views, impressions, durations] = await Promise.all([
    fetchAllRows<{ visitor_id: string; referrer_category: string; created_at: string }>(
      "article_page_views",
      "visitor_id, referrer_category, created_at"
    ),
    fetchAllRows<{ created_at: string }>("article_impressions", "created_at"),
    fetchAllRows<{ duration_seconds: number; created_at: string }>("article_view_durations", "duration_seconds, created_at"),
  ]);

  const now = Date.now();
  const DAY = 86_400_000;
  // [from, to) windows in ms; null = unbounded.
  const windows = { allTime: [null, null], last30: [now - 30 * DAY, null], prev30: [now - 60 * DAY, now - 30 * DAY] } as const;
  const inWindow = (iso: string, [from, to]: readonly [number | null, number | null]) => {
    const t = new Date(iso).getTime();
    return (from === null || t >= from) && (to === null || t < to);
  };
  const per = (fn: (w: readonly [number | null, number | null]) => number | null): PeriodValue => ({
    allTime: fn(windows.allTime),
    last30: fn(windows.last30),
    prev30: fn(windows.prev30),
  });

  return {
    views: per((w) => views.filter((v) => inWindow(v.created_at, w)).length),
    uniqueReaders: per((w) => new Set(views.filter((v) => inWindow(v.created_at, w)).map((v) => v.visitor_id)).size),
    avgTimeOnPageSeconds: per((w) => median(durations.filter((x) => inWindow(x.created_at, w)).map((x) => x.duration_seconds))),
    ctrPercent: per((w) => {
      const shown = impressions.filter((i) => inWindow(i.created_at, w)).length;
      const clicks = views.filter((v) => v.referrer_category === "internal_listing" && inWindow(v.created_at, w)).length;
      return shown ? (clicks / shown) * 100 : null;
    }),
  };
}
