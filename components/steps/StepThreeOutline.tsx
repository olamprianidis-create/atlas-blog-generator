import Spinner from "../Spinner";
import { PLACEHOLDER_RELATED_ARTICLES } from "../../utils/relatedArticles";

interface StepThreeOutlineProps {
  outlineText: string;
  onOutlineTextChange: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onApprove: () => void;
}

export default function StepThreeOutline({
  outlineText,
  onOutlineTextChange,
  isLoading,
  error,
  onBack,
  onApprove,
}: StepThreeOutlineProps) {
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
        <textarea
          value={outlineText}
          onChange={(event) => onOutlineTextChange(event.target.value)}
          rows={28}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Related Articles for Internal Linking
        </h3>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs text-slate-400">
            Latest published articles on atlasnetwork.club — for internal-link context when writing the
            full article.
          </p>
          <ul className="space-y-3">
            {PLACEHOLDER_RELATED_ARTICLES.map((article) => (
              <li key={article.url} className="text-sm">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {article.title}
                </a>
                <span className="ml-2 text-xs text-slate-400">{article.category}</span>
              </li>
            ))}
          </ul>
        </div>
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
