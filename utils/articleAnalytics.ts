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
  scroll: ScrollStats;
  elements: ElementRow[];
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

// --- Scroll depth (article_scroll_depths, migration 0027) ------------------

export interface ScrollSection {
  title: string;
  position: number; // average % of the article body where the heading sits
  leftHere: number; // readers whose furthest point was inside this section
  leftHerePercent: number;
}

export interface ScrollStats {
  readers: number; // sessions with scroll data (tracking began 2026-10-16)
  averageDropOff: number | null; // mean of each reader's furthest point, %
  finishedPercent: number | null; // reached the end (≥ 95%)
  retention: { percent: number; stillReading: number }[]; // % of readers who got at least this far
  newsletterPosition: number | null; // average % where the in-article newsletter sits
  intro: { leftHere: number; leftHerePercent: number }; // left before the first section heading
  sections: ScrollSection[];
  biggestDropOff: { title: string; leftHerePercent: number } | null;
}

interface ScrollRow {
  session_id: string;
  max_percent: number;
  sections: { t: string; p: number }[] | null;
  newsletter_percent: number | null;
  created_at: string;
}

const FINISHED_AT = 95;

// A reader can send several rows (one each time they leave the tab having
// read further) — keep each session's furthest row.
function furthestPerSession(rows: ScrollRow[]): ScrollRow[] {
  const bySession = new Map<string, ScrollRow>();
  for (const row of rows) {
    const current = bySession.get(row.session_id);
    if (!current || row.max_percent >= current.max_percent) bySession.set(row.session_id, row);
  }
  return Array.from(bySession.values());
}

function averageOf(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function computeScrollStats(rows: ScrollRow[]): ScrollStats {
  const readers = furthestPerSession(rows);
  const n = readers.length;
  const pct = (count: number) => (n ? Math.round((count / n) * 100) : 0);

  const retention = Array.from({ length: 21 }, (_, i) => i * 5).map((percent) => ({
    percent,
    stillReading: pct(readers.filter((r) => r.max_percent >= percent).length),
  }));

  // Section order and average position across readers (layout differs by
  // device, so each reader's own heading positions are used to place them).
  const positions = new Map<string, number[]>();
  for (const r of readers) {
    for (const s of r.sections ?? []) {
      if (!positions.has(s.t)) positions.set(s.t, []);
      positions.get(s.t)!.push(s.p);
    }
  }
  const sectionList = Array.from(positions.entries())
    .map(([title, ps]) => ({ title, position: averageOf(ps) ?? 0 }))
    .sort((a, b) => a.position - b.position);

  // Which section each reader stopped in: the last heading they got past.
  const leftCounts = new Map<string, number>();
  let introCount = 0;
  for (const r of readers) {
    const passed = (r.sections ?? []).filter((s) => s.p <= r.max_percent).sort((a, b) => b.p - a.p)[0];
    if (r.max_percent >= FINISHED_AT) continue;
    if (!passed) introCount += 1;
    else leftCounts.set(passed.t, (leftCounts.get(passed.t) ?? 0) + 1);
  }
  const sections: ScrollSection[] = sectionList.map((s) => ({
    ...s,
    leftHere: leftCounts.get(s.title) ?? 0,
    leftHerePercent: pct(leftCounts.get(s.title) ?? 0),
  }));

  const candidates = [
    { title: "the opening (before the first section)", leftHere: introCount, leftHerePercent: pct(introCount) },
    ...sections,
  ];
  const top = candidates.reduce((a, b) => (b.leftHere > a.leftHere ? b : a), candidates[0]);

  return {
    readers: n,
    averageDropOff: averageOf(readers.map((r) => r.max_percent)),
    finishedPercent: n ? pct(readers.filter((r) => r.max_percent >= FINISHED_AT).length) : null,
    retention,
    newsletterPosition: averageOf(
      readers.flatMap((r) => (r.newsletter_percent === null ? [] : [r.newsletter_percent]))
    ),
    intro: { leftHere: introCount, leftHerePercent: pct(introCount) },
    sections,
    biggestDropOff: top && top.leftHere > 0 ? { title: top.title, leftHerePercent: top.leftHerePercent } : null,
  };
}

// --- Seen vs. clicked (article_element_events, migration 0027) ------------

export interface ElementRow {
  key: string;
  label: string;
  group: string;
  help: string;
  seen: number; // readers who had it on screen
  clicked: number; // readers who clicked it (newsletter: signed up)
  ratePercent: number | null;
}

// Every tracked element on the article page, in page order. Keys match the
// data-track attributes on the ATLAS Website (src/lib/article-engagement.ts).
export const TRACKED_ELEMENTS: { key: string; label: string; group: string; help: string }[] = [
  { key: "share_x", label: "Share on X", group: "Share this article", help: "X icon next to the summary" },
  { key: "share_linkedin", label: "Share on LinkedIn", group: "Share this article", help: "LinkedIn icon next to the summary" },
  { key: "share_email", label: "Share by email", group: "Share this article", help: "Mail icon next to the summary" },
  { key: "toc", label: "“In This Article” links", group: "Inside the article", help: "Jumping to a section from the contents box" },
  { key: "inline_link", label: "Links in the article text", group: "Inside the article", help: "Any link inside the paragraphs (sources and other articles)" },
  { key: "newsletter_inline", label: "Newsletter box (in the article) — sign-ups", group: "Newsletter", help: "The box ~40% of the way down; clicked = completed sign-up" },
  { key: "newsletter_sidebar", label: "Newsletter (sidebar) — sign-ups", group: "Newsletter", help: "The sign-up form in the right-hand column; clicked = completed sign-up" },
  { key: "realtor_instagram", label: "Realtor box — My Instagram", group: "Meet Your Local Realtor", help: "Only on articles by a realtor" },
  { key: "realtor_email", label: "Realtor box — Email Me", group: "Meet Your Local Realtor", help: "Only on articles by a realtor" },
  { key: "realtor_website", label: "Realtor box — Our Website", group: "Meet Your Local Realtor", help: "Only on articles by a realtor" },
  { key: "related_reading", label: "Related Reading row", group: "Keep reading", help: "The scrolling row of articles at the end" },
  { key: "sidebar_related", label: "Sidebar Related Articles", group: "Keep reading", help: "The article list in the right-hand column" },
  { key: "category_pill", label: "Topic pill", group: "Keep reading", help: "The orange topic pill(s) under the sidebar newsletter" },
  { key: "author_profile", label: "Author — View Profile", group: "Publishing Author", help: "Button in the author box" },
  { key: "author_contact", label: "Author — Contact Me", group: "Publishing Author", help: "Only shown for realtor authors" },
];

const REALTOR_KEYS = ["realtor_instagram", "realtor_email", "realtor_website", "author_contact"];
const SHARE_KEYS = ["share_x", "share_linkedin", "share_email"];
const SIGNUP_KEYS = ["newsletter_inline", "newsletter_sidebar"];

interface ElementEventRow {
  session_id: string;
  element: string;
  action: "seen" | "click";
  created_at: string;
}

function computeElementRows(events: ElementEventRow[]): ElementRow[] {
  const seen = new Map<string, Set<string>>();
  const clicked = new Map<string, Set<string>>();
  for (const e of events) {
    const map = e.action === "click" ? clicked : seen;
    if (!map.has(e.element)) map.set(e.element, new Set());
    map.get(e.element)!.add(e.session_id);
  }
  return TRACKED_ELEMENTS.map((el) => {
    const seenCount = seen.get(el.key)?.size ?? 0;
    const clickedCount = clicked.get(el.key)?.size ?? 0;
    return {
      ...el,
      seen: seenCount,
      clicked: clickedCount,
      ratePercent: seenCount ? (clickedCount / seenCount) * 100 : null,
    };
  });
}

const PAGE = 1000; // Supabase's per-request row cap

// All rows of one analytics table (optionally for one article), paged past
// Supabase's 1,000-row cap. A missing table (migration not run) → [].
async function fetchAllRows<T>(table: string, columns: string, articleId?: string): Promise<T[]> {
  const supabase = getServiceClient();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns);
    if (articleId) query = query.eq("article_id", articleId);
    const { data, error } = await query.order("created_at").range(from, from + PAGE - 1);
    if (error) return rows;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

// Every day from the first view (at most the last 90 days) to today, with
// zero-view days filled in so gaps show on the chart.
function fillDays(counts: Map<string, number>): { date: string; views: number }[] {
  const keys = Array.from(counts.keys()).sort();
  if (keys.length === 0) return [];
  const DAY = 86_400_000;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const first = Math.max(new Date(keys[0]).getTime(), today - 89 * DAY);
  const days: { date: string; views: number }[] = [];
  for (let t = first; t <= today; t += DAY) {
    const key = new Date(t).toISOString().slice(0, 10);
    days.push({ date: key, views: counts.get(key) ?? 0 });
  }
  return days;
}

// Reads the analytics tables from supabase/migrations/0010_article_analytics.sql
// and 0027 (written to by the ATLAS Website — see its src/lib/supabase.ts and
// src/lib/article-engagement.ts) via the service-role client, which bypasses
// the insert-only RLS policies those tables have for anon. Every query here
// degrades to empty results if a migration hasn't been run, rather than
// throwing — the Statistics page should show "no data yet," not break.
export async function getArticleStats(articleId: string): Promise<ArticleStats> {
  const [views, impressions, durations, scrollRows, elementEvents] = await Promise.all([
    fetchAllRows<{ visitor_id: string; referrer_category: string; device_type: string; created_at: string }>(
      "article_page_views",
      "visitor_id, referrer_category, device_type, created_at",
      articleId
    ),
    fetchAllRows<{ created_at: string }>("article_impressions", "created_at", articleId),
    fetchAllRows<{ duration_seconds: number; created_at: string }>(
      "article_view_durations",
      "duration_seconds, created_at",
      articleId
    ),
    fetchAllRows<ScrollRow>(
      "article_scroll_depths",
      "session_id, max_percent, sections, newsletter_percent, created_at",
      articleId
    ),
    fetchAllRows<ElementEventRow>("article_element_events", "session_id, element, action, created_at", articleId),
  ]);

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
  const viewsByDay = fillDays(viewsByDayMap);

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
    scroll: computeScrollStats(scrollRows),
    elements: computeElementRows(elementEvents),
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
  // From the 2026-10-16 engagement tracking (migration 0027):
  averageDropOff: PeriodValue; // how far down readers get on average, %
  newsletterSignups: PeriodValue; // sign-ups from the article newsletter boxes
  realtorClicks: PeriodValue; // Instagram/Email/Website in the realtor box + Contact Me
  shares: PeriodValue; // Share on X / LinkedIn / email clicks
  // Per article (all time), for the Published list.
  perArticle: Record<string, ArticleEngagementSummary>;
}

export interface ArticleEngagementSummary {
  readers: number; // with scroll data
  averageDropOff: number | null;
  newsletterSignups: number;
  realtorClicks: number;
  shares: number;
}

export async function getArticlesOverview(): Promise<ArticlesOverview> {
  const [views, impressions, durations, scrollRows, clickRows] = await Promise.all([
    fetchAllRows<{ visitor_id: string; referrer_category: string; created_at: string }>(
      "article_page_views",
      "visitor_id, referrer_category, created_at"
    ),
    fetchAllRows<{ created_at: string }>("article_impressions", "created_at"),
    fetchAllRows<{ duration_seconds: number; created_at: string }>("article_view_durations", "duration_seconds, created_at"),
    fetchAllRows<ScrollRow & { article_id: string }>(
      "article_scroll_depths",
      "article_id, session_id, max_percent, sections, newsletter_percent, created_at"
    ),
    fetchAllRows<ElementEventRow & { article_id: string }>(
      "article_element_events",
      "article_id, session_id, element, action, created_at"
    ).then((rows) => rows.filter((r) => r.action === "click")),
  ]);
  const readers = furthestPerSession(scrollRows) as (ScrollRow & { article_id: string })[];
  const countClicks = (keys: string[], rows: typeof clickRows) => rows.filter((r) => keys.includes(r.element)).length;

  const perArticle: Record<string, ArticleEngagementSummary> = {};
  const summaryFor = (id: string) =>
    (perArticle[id] ??= { readers: 0, averageDropOff: null, newsletterSignups: 0, realtorClicks: 0, shares: 0 });
  const depthsByArticle = new Map<string, number[]>();
  for (const r of readers) {
    if (!depthsByArticle.has(r.article_id)) depthsByArticle.set(r.article_id, []);
    depthsByArticle.get(r.article_id)!.push(r.max_percent);
  }
  for (const [id, depths] of depthsByArticle) {
    const summary = summaryFor(id);
    summary.readers = depths.length;
    summary.averageDropOff = averageOf(depths);
  }
  for (const r of clickRows) {
    const summary = summaryFor(r.article_id);
    if (SIGNUP_KEYS.includes(r.element)) summary.newsletterSignups += 1;
    if (REALTOR_KEYS.includes(r.element)) summary.realtorClicks += 1;
    if (SHARE_KEYS.includes(r.element)) summary.shares += 1;
  }

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
    averageDropOff: per((w) => averageOf(readers.filter((r) => inWindow(r.created_at, w)).map((r) => r.max_percent))),
    newsletterSignups: per((w) => countClicks(SIGNUP_KEYS, clickRows.filter((r) => inWindow(r.created_at, w)))),
    realtorClicks: per((w) => countClicks(REALTOR_KEYS, clickRows.filter((r) => inWindow(r.created_at, w)))),
    shares: per((w) => countClicks(SHARE_KEYS, clickRows.filter((r) => inWindow(r.created_at, w)))),
    perArticle,
  };
}
