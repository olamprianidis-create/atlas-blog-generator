import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import { CATEGORIES } from "../utils/types";
import { buildArticleUrl } from "../utils/site";

interface PublishedArticleItem {
  id: string;
  title: string;
  category: string;
  publish_date: string | null;
  meta_description: string | null;
}

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

  useEffect(() => {
    fetch("/api/published-articles")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load published articles");
        setArticles(data as PublishedArticleItem[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load published articles"))
      .finally(() => setIsLoading(false));
  }, []);

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
                <li key={article.id}>
                  <a
                    href={buildArticleUrl(article.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{article.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {categoryLabel(article.category)} · Published {formatPublishDate(article.publish_date)}
                      </p>
                    </div>
                    <span className="ml-4 shrink-0 text-xs font-medium text-blue-600">View live →</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
