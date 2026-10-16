import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import BlogTabs from "../../../components/layout/BlogTabs";
import AppLayout from "../../../components/layout/AppLayout";
import type { ArticleStats } from "../../../utils/articleAnalytics";

const cardClass = "rounded-lg border border-slate-200 bg-white p-4";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cardClass}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Daily views, every day from the first view (up to 90 days) with zero days
// shown as gaps. Bars are sized in pixels against a fixed-height plot.
function ViewsChart({ data }: { data: ArticleStats["viewsByDay"] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No view data yet.</p>;
  }

  const PLOT_HEIGHT = 160;
  const max = Math.max(...data.map((d) => d.views), 1);
  const total = data.reduce((sum, d) => sum + d.views, 0);
  const shown = hovered !== null ? data[hovered] : null;

  return (
    <div>
      <p className="mb-2 h-5 text-xs text-slate-500">
        {shown
          ? `${shortDate(shown.date)}: ${shown.views} ${shown.views === 1 ? "view" : "views"}`
          : `${total.toLocaleString()} views over ${data.length} ${data.length === 1 ? "day" : "days"} — hover a bar for its day`}
      </p>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[10px] text-slate-400" style={{ height: PLOT_HEIGHT }}>
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="flex items-end gap-px border-b border-l border-slate-200"
            style={{ height: PLOT_HEIGHT }}
            onMouseLeave={() => setHovered(null)}
          >
            {data.map((d, i) => (
              <div
                key={d.date}
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setHovered(i)}
                title={`${shortDate(d.date)}: ${d.views} views`}
              >
                <div
                  className={`w-full rounded-t ${hovered === i ? "bg-blue-700" : "bg-blue-500"}`}
                  style={{ height: d.views ? Math.max(3, (d.views / max) * PLOT_HEIGHT) : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>{shortDate(data[0].date)}</span>
            {data.length > 2 && <span>{shortDate(data[Math.floor(data.length / 2)].date)}</span>}
            <span>{shortDate(data[data.length - 1].date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// "How far people read": the share of readers still reading at each point
// of the article, with the newsletter box, section headings and the average
// drop-off point marked on it.
function RetentionChart({ scroll }: { scroll: ArticleStats["scroll"] }) {
  const PLOT_HEIGHT = 160;
  const [hovered, setHovered] = useState<number | null>(null);
  const point = hovered !== null ? scroll.retention[hovered] : null;

  return (
    <div>
      <p className="mb-2 h-5 text-xs text-slate-500">
        {point
          ? `${point.stillReading}% of readers got at least ${point.percent}% of the way down`
          : "Share of readers still reading at each point of the article — hover a bar"}
      </p>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[10px] text-slate-400" style={{ height: PLOT_HEIGHT }}>
          <span>100%</span>
          <span>0%</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative border-b border-l border-slate-200" style={{ height: PLOT_HEIGHT }}>
            <div className="absolute inset-0 flex items-end gap-px" onMouseLeave={() => setHovered(null)}>
              {scroll.retention.map((r, i) => (
                <div key={r.percent} className="flex h-full flex-1 items-end" onMouseEnter={() => setHovered(i)}>
                  <div
                    className={`w-full rounded-t ${hovered === i ? "bg-emerald-700" : "bg-emerald-500"}`}
                    style={{ height: (r.stillReading / 100) * PLOT_HEIGHT }}
                  />
                </div>
              ))}
            </div>
            {/* Markers: section headings (gray), newsletter (orange), average drop-off (red). */}
            {scroll.sections.map((s) => (
              <div
                key={s.title}
                className="pointer-events-none absolute top-0 h-full border-l border-dashed border-slate-400"
                style={{ left: `${s.position}%` }}
              />
            ))}
            {scroll.newsletterPosition !== null && (
              <div
                className="pointer-events-none absolute top-0 h-full border-l-2 border-orange-500"
                style={{ left: `${scroll.newsletterPosition}%` }}
              />
            )}
            {scroll.averageDropOff !== null && (
              <div
                className="pointer-events-none absolute top-0 h-full border-l-2 border-red-500"
                style={{ left: `${scroll.averageDropOff}%` }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>Top of article</span>
            <span>Halfway</span>
            <span>End</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-red-500" /> Average drop-off point
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-orange-500" /> Newsletter box
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 border-l border-dashed border-slate-400" /> Section headings
        </span>
      </div>
    </div>
  );
}

function ScrollSection({ scroll }: { scroll: ArticleStats["scroll"] }) {
  if (scroll.readers === 0) {
    return (
      <p className="text-sm text-slate-400">
        No scroll data yet. Scroll tracking started Oct 16, 2026, so this fills in as people read the
        article from now on. Give it a few dozen readers before drawing conclusions.
      </p>
    );
  }

  const rows = [
    { title: "Opening (before the first section)", position: 0, ...scroll.intro },
    ...scroll.sections,
  ];
  const maxLeft = Math.max(...rows.map((r) => r.leftHere), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Average drop-off point"
          value={scroll.averageDropOff !== null ? `${scroll.averageDropOff}%` : "—"}
          hint="how far down readers get before leaving, on average"
        />
        <StatCard
          label="Read to the end"
          value={scroll.finishedPercent !== null ? `${scroll.finishedPercent}%` : "—"}
          hint="of readers scrolled to the bottom (95%+)"
        />
        <StatCard
          label="Readers tracked"
          value={scroll.readers.toLocaleString()}
          hint="since scroll tracking began Oct 16, 2026"
        />
      </div>

      {scroll.biggestDropOff && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Biggest drop-off:</span> {scroll.biggestDropOff.leftHerePercent}% of
          readers left during <span className="font-semibold">“{scroll.biggestDropOff.title}”</span>. That&apos;s the
          section to tighten up, or to put something worth staying for right before.
        </p>
      )}

      <RetentionChart scroll={scroll} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Where readers left, by section</p>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.title} className="flex items-center gap-3 text-sm">
              <span className="w-10 shrink-0 text-right text-xs text-slate-400">{row.position}%</span>
              <span className="min-w-0 flex-1 truncate text-slate-700" title={row.title}>
                {row.title}
              </span>
              <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:w-40">
                <div className="h-full rounded-full bg-red-400" style={{ width: `${(row.leftHere / maxLeft) * 100}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                {row.leftHere} left ({row.leftHerePercent}%)
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Left column: where the section starts (% of the way down). Readers who reached the end aren&apos;t counted
          as leaving.
        </p>
      </div>
    </div>
  );
}

// "Seen vs. clicked": for every button/link on the article page, how many
// readers had it on screen and how many of them clicked it.
function SeenClickedTable({ stats }: { stats: ArticleStats }) {
  const rows = [
    {
      key: "listing_card",
      label: "Article card on your Articles page",
      group: "Getting people in (your click-through rate)",
      help: "Seen = times the card was shown on atlasnetwork.club/articles; clicked = times someone opened the article from it",
      seen: stats.impressions,
      clicked: stats.clicksFromListing,
      ratePercent: stats.ctrPercent,
    },
    ...stats.elements,
  ];
  const visible = rows.filter((r) => r.seen > 0 || r.clicked > 0);
  const hiddenCount = rows.length - visible.length;

  if (visible.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No data yet. Button and link tracking started Oct 16, 2026, so this fills in as people read the article.
      </p>
    );
  }

  const groups = Array.from(new Set(visible.map((r) => r.group)));

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 font-medium">Button / link</th>
            <th className="py-2 text-right font-medium">Seen</th>
            <th className="py-2 text-right font-medium">Clicked</th>
            <th className="w-32 py-2 pl-4 text-right font-medium">Rate</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group}>
              <tr>
                <td colSpan={4} className="pb-1 pt-4 text-xs font-semibold text-slate-900">
                  {group}
                </td>
              </tr>
              {visible
                .filter((r) => r.group === group)
                .map((r) => (
                  <tr key={r.key} className="border-b border-slate-100" title={r.help}>
                    <td className="py-2 pr-2 text-slate-700">{r.label}</td>
                    <td className="py-2 text-right text-slate-700">{r.seen.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-700">{r.clicked.toLocaleString()}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 sm:block">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.min(100, r.ratePercent ?? 0)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-medium text-slate-900">
                          {r.ratePercent !== null ? `${r.ratePercent.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {hiddenCount} other {hiddenCount === 1 ? "button isn't" : "buttons aren't"} listed because no reader has
          seen {hiddenCount === 1 ? "it" : "them"} yet (e.g. the realtor box only appears on realtor articles).
        </p>
      )}
    </div>
  );
}

function BreakdownList({ items, total }: { items: { category?: string; device?: string; count: number }[]; total: number }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No data yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const label = item.category ?? item.device ?? "Unknown";
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate text-slate-700">{label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-slate-500">
              {item.count} ({percent}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ArticleStatsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [title, setTitle] = useState<string | null>(null);
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof id !== "string") return;

    setIsLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/scheduled-articles/${id}`).then((res) => res.json()),
      fetch(`/api/published-articles/${id}/stats`).then((res) => res.json()),
    ])
      .then(([articleData, statsData]) => {
        if (articleData.error) throw new Error(articleData.error);
        if (statsData.error) throw new Error(statsData.error);
        setTitle(articleData.title as string);
        setStats(statsData as ArticleStats);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load statistics"))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <AppLayout header={<BlogTabs />}>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/published" className="text-sm text-blue-600 hover:underline">
            ← Back to Published
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {title ?? "Article Statistics"}
          </h1>

          {isLoading && <p className="mt-8 text-sm text-slate-500">Loading statistics…</p>}

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {stats && !isLoading && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard label="Total views" value={stats.totalViews.toLocaleString()} />
                <StatCard label="Unique viewers" value={stats.uniqueViewers.toLocaleString()} />
                <StatCard label="Typical time on page" value={formatDuration(stats.avgTimeOnPageSeconds)} />
                <StatCard
                  label="Impressions"
                  value={stats.impressions.toLocaleString()}
                  hint="times its card was shown on your Articles page"
                />
                <StatCard
                  label="Clicks"
                  value={stats.clicksFromListing.toLocaleString()}
                  hint="times someone opened it from that card"
                />
                <StatCard
                  label="Click-through rate"
                  value={stats.ctrPercent !== null ? `${stats.ctrPercent.toFixed(1)}%` : "—"}
                  hint="clicks ÷ impressions: how well the title + image win the click"
                />
              </div>

              <div className={`mt-6 ${cardClass}`}>
                <p className="mb-3 text-sm font-medium text-slate-700">Views over time</p>
                <ViewsChart data={stats.viewsByDay} />
              </div>

              <div className={`mt-6 ${cardClass}`}>
                <p className="text-sm font-medium text-slate-700">How far people read</p>
                <p className="mb-4 mt-1 text-xs text-slate-500">
                  How far down the article each reader got before leaving (on phones and computers alike).
                </p>
                <ScrollSection scroll={stats.scroll} />
              </div>

              <div className={`mt-6 ${cardClass}`}>
                <p className="text-sm font-medium text-slate-700">Seen vs. clicked</p>
                <p className="mb-2 mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">Seen</span> = readers who scrolled it onto their screen.{" "}
                  <span className="font-medium text-slate-700">Clicked</span> = how many of them clicked it (for the
                  newsletter: completed a sign-up). A low rate with lots of views means the button isn&apos;t convincing;
                  few views means people don&apos;t scroll that far, so move it higher. Hover a row for details.
                </p>
                <SeenClickedTable stats={stats} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={cardClass}>
                  <p className="mb-3 text-sm font-medium text-slate-700">Traffic sources</p>
                  <BreakdownList items={stats.referrerBreakdown.map((r) => ({ category: r.category, count: r.count }))} total={stats.totalViews} />
                </div>
                <div className={cardClass}>
                  <p className="mb-3 text-sm font-medium text-slate-700">Devices</p>
                  <BreakdownList items={stats.deviceBreakdown.map((d) => ({ device: d.device, count: d.count }))} total={stats.totalViews} />
                </div>
              </div>

              {stats.totalViews === 0 && (
                <p className="mt-6 text-sm text-slate-400">
                  No views recorded yet — this either means the article hasn&apos;t been read yet, or
                  the article-analytics migration (supabase/migrations/0010_article_analytics.sql)
                  hasn&apos;t been run yet.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
