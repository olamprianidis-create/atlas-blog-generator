import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/layout/AppLayout";
import { CATEGORIES } from "../utils/types";

interface ScheduledArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
  linkedin_auto_share: boolean;
}

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function formatPublishDate(iso: string | null) {
  if (!iso) return "No publish date set";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LinkedInScheduledBadge() {
  return (
    <span
      title="Will auto-share to LinkedIn when this publishes"
      aria-label="Will auto-share to LinkedIn when this publishes"
      className="ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 align-middle"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5">
        <path d="m5 13 4 4 10-10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function ScheduledPage() {
  const [articles, setArticles] = useState<ScheduledArticleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);

  useEffect(() => {
    fetch("/api/scheduled-articles")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load scheduled articles");
        setArticles(data as ScheduledArticleItem[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load scheduled articles"))
      .finally(() => setIsLoading(false));

    fetch("/api/platform-connections")
      .then((res) => res.json())
      .then((data) => setLinkedinConnected(!!data.linkedin))
      .catch(() => setLinkedinConnected(false));
  }, []);

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Scheduled</h1>
          <p className="mt-1 text-sm text-slate-500">
            Articles waiting to auto-publish. Not live yet. Click one to change its publish date.
          </p>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-8 text-sm text-slate-500">Loading scheduled articles…</p>
          ) : articles.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">Nothing is currently scheduled.</p>
          ) : (
            <ul className="mt-8 flex flex-col gap-3">
              {articles.map((article) => (
                <li key={article.id}>
                  <Link
                    href={`/?scheduledId=${article.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{article.title}</p>
                      <p className="mt-1 flex items-center text-xs text-slate-500">
                        {categoryLabel(article.category)} · Publishes {formatPublishDate(article.publish_date)}
                        {linkedinConnected && article.linkedin_auto_share && <LinkedInScheduledBadge />}
                      </p>
                    </div>
                    <span className="ml-4 shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      Scheduled
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
