import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
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

function ViewsChart({ data }: { data: ArticleStats["viewsByDay"] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No view data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.views), 1);

  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.views} views`}>
          <div
            className="w-full rounded-t bg-blue-500"
            style={{ height: `${Math.max(4, (d.views / max) * 100)}%` }}
          />
        </div>
      ))}
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
    <AppLayout>
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
                <StatCard label="Avg. time on page" value={formatDuration(stats.avgTimeOnPageSeconds)} />
                <StatCard label="Impressions" value={stats.impressions.toLocaleString()} hint="on the Articles page" />
                <StatCard label="Clicks" value={stats.clicksFromListing.toLocaleString()} hint="from the Articles page" />
                <StatCard
                  label="Click-through rate"
                  value={stats.ctrPercent !== null ? `${stats.ctrPercent.toFixed(1)}%` : "—"}
                  hint="clicks ÷ impressions"
                />
              </div>

              <div className={`mt-6 ${cardClass}`}>
                <p className="mb-3 text-sm font-medium text-slate-700">Views over time</p>
                <ViewsChart data={stats.viewsByDay} />
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
