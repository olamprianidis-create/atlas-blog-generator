import { useEffect, useState } from "react";
import Spinner from "../Spinner";
import RichTextEditor from "../RichTextEditor";
import type { RelatedArticleItem } from "../../utils/relatedArticles";
import type { Category } from "../../utils/types";

interface StepThreeOutlineProps {
  outlineText: string;
  onOutlineTextChange: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  category: Category | null;
  topic: string;
  onRelatedArticlesChange: (articles: RelatedArticleItem[]) => void;
  onBack: () => void;
  onApprove: () => void;
}

function formatPublishDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ArticleLink({ article }: { article: RelatedArticleItem }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 text-sm"
    >
      <span className="font-medium text-blue-600 hover:underline">{article.title}</span>
      {article.publishDate && (
        <span className="shrink-0 text-xs text-slate-400">{formatPublishDate(article.publishDate)}</span>
      )}
    </a>
  );
}

export default function StepThreeOutline({
  outlineText,
  onOutlineTextChange,
  isLoading,
  error,
  category,
  topic,
  onRelatedArticlesChange,
  onBack,
  onApprove,
}: StepThreeOutlineProps) {
  const [recommended, setRecommended] = useState<RelatedArticleItem[]>([]);
  const [recent, setRecent] = useState<RelatedArticleItem[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) {
      setRecommended([]);
      setRecent([]);
      onRelatedArticlesChange([]);
      return;
    }

    let cancelled = false;
    setIsLoadingRelated(true);
    setRelatedError(null);

    fetch("/api/related-articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, topic }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load related articles");
        if (!cancelled) {
          const recommendedArticles: RelatedArticleItem[] = data.recommended ?? [];
          setRecommended(recommendedArticles);
          setRecent(data.recent ?? []);
          onRelatedArticlesChange(recommendedArticles);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRelatedError(err instanceof Error ? err.message : "Failed to load related articles");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRelated(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Step 3: Outline Approval</h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-20">
          <Spinner />
          <p className="text-sm text-slate-500">Generating the outline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Step 3: Outline Approval</h2>
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Step 3: Outline Approval</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edit freely — add, delete, or rewrite anything before generating the full article.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Back
        </button>
      </div>

      <div className="mt-6">
        <RichTextEditor value={outlineText} onChange={onOutlineTextChange} />
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Related Articles for Internal Linking
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Published articles on atlasnetwork.club in this category — for internal-link context when
          writing the full article.
        </p>

        {!category ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Select a category on Step 1 to see related published articles.
          </p>
        ) : isLoadingRelated ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            <Spinner /> Loading related articles…
          </div>
        ) : relatedError ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {relatedError}
          </p>
        ) : recent.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            No published articles yet in this category.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Top 3 Recommended
              </h4>
              <ul className="space-y-3">
                {recommended.map((article) => (
                  <li key={article.id}>
                    <ArticleLink article={article} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Last {recent.length} Published in This Category
              </h4>
              <ul className="space-y-3">
                {recent.map((article) => (
                  <li key={article.id}>
                    <ArticleLink article={article} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          type="button"
          onClick={onApprove}
          disabled={!outlineText.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Approve & Generate Article
        </button>
      </div>
    </div>
  );
}
