import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/layout/AppLayout";
import { CATEGORIES } from "../utils/types";
import { buildArticleUrl } from "../utils/site";

interface PublishedArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
  linkedin_status: string;
  linkedin_error: string | null;
}

const LINKEDIN_STATUS_STYLES: Record<string, string> = {
  posted: "bg-green-100 text-green-700",
  posting: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  not_connected: "bg-red-100 text-red-700",
  not_posted: "bg-slate-100 text-slate-500",
};

const LINKEDIN_STATUS_LABELS: Record<string, string> = {
  posted: "Shared on LinkedIn",
  posting: "Sharing…",
  failed: "LinkedIn share failed",
  not_connected: "LinkedIn not connected",
  not_posted: "Not shared yet",
};

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function formatPublishDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PublishedPage() {
  const [articles, setArticles] = useState<PublishedArticleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  function loadArticles() {
    fetch("/api/published-articles")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load published articles");
        setArticles(data as PublishedArticleItem[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load published articles"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadArticles();
  }, []);

  async function shareToLinkedin(articleId: string) {
    setSharingId(articleId);
    try {
      const res = await fetch(`/api/published-articles/${articleId}/linkedin`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to share to LinkedIn.");
      loadArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share to LinkedIn.");
    } finally {
      setSharingId(null);
    }
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Published</h1>
          <p className="mt-1 text-sm text-slate-500">
            Articles live on atlasnetwork.club. Click one to open it.
          </p>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-8 text-sm text-slate-500">Loading published articles…</p>
          ) : articles.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">No articles have been published yet.</p>
          ) : (
            <ul className="mt-8 flex flex-col gap-3">
              {articles.map((article) => (
                <li key={article.id} className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={buildArticleUrl(article.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 hover:opacity-80"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{article.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {categoryLabel(article.category)} · Published {formatPublishDate(article.publish_date)}
                      </p>
                    </a>
                    <span className="shrink-0 text-xs font-medium text-blue-600">
                      <a href={buildArticleUrl(article.title)} target="_blank" rel="noopener noreferrer">
                        View live →
                      </a>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <Link
                      href={`/published/${article.id}/stats`}
                      className="text-xs font-medium text-slate-600 hover:underline"
                    >
                      Statistics
                    </Link>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${LINKEDIN_STATUS_STYLES[article.linkedin_status] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      {LINKEDIN_STATUS_LABELS[article.linkedin_status] ?? article.linkedin_status}
                    </span>
                    {article.linkedin_status !== "posted" && (
                      <button
                        type="button"
                        onClick={() => shareToLinkedin(article.id)}
                        disabled={sharingId === article.id}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {sharingId === article.id ? "Sharing…" : "Share to LinkedIn"}
                      </button>
                    )}
                    {article.linkedin_error && (
                      <span className="truncate text-xs text-red-600" title={article.linkedin_error}>
                        {article.linkedin_error}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
