import { ReactNode, useState } from "react";
import type { BlogOutline } from "../../utils/outline";
import { PLACEHOLDER_RELATED_ARTICLES } from "../../utils/relatedArticles";
import OutlineDisplay from "../OutlineDisplay";
import { KeywordItem } from "./StepOneResults";

interface StepTwoReviewProps {
  outline: BlogOutline;
  keywords: KeywordItem[];
  onAddKeyword: (text: string) => void;
  onRemoveKeyword: (text: string) => void;
  onApproveAndGenerate: () => void;
  onEditKeywords: () => void;
  onRestart: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function StepTwoReview({
  outline,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onApproveAndGenerate,
  onEditKeywords,
  onRestart,
}: StepTwoReviewProps) {
  const [newKeyword, setNewKeyword] = useState("");

  function handleAddKeyword() {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    onAddKeyword(trimmed);
    setNewKeyword("");
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Step 2: Review & Approve</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the outline and keywords before generating the full article.
          </p>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Restart
        </button>
      </div>

      <Section title="Generated Outline">
        <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          <OutlineDisplay outline={outline} />
        </div>
      </Section>

      <Section title="Keywords">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword.text}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  keyword.isSuggested
                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                    : "bg-slate-100 text-slate-700"
                }`}
                title={keyword.isSuggested ? "Suggested keyword" : "Base keyword"}
              >
                {keyword.text}
                {keyword.isSuggested && <span>✨</span>}
                <button
                  type="button"
                  onClick={() => onRemoveKeyword(keyword.text)}
                  aria-label={`Remove ${keyword.text}`}
                  className="text-current opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
            {keywords.length === 0 && (
              <p className="text-sm text-slate-400">No keywords yet — add one below.</p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(event) => setNewKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddKeyword();
                }
              }}
              placeholder="Add a keyword..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add
            </button>
          </div>
        </div>
      </Section>

      <Section title="Related Articles for Internal Linking">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs text-slate-400">
            Latest published articles on atlasnetwork.club — for internal-link context when writing the full article.
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
      </Section>

      <div className="mt-8 flex justify-end gap-3">
        <button
          type="button"
          onClick={onEditKeywords}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit Keywords
        </button>
        <button
          type="button"
          onClick={onApproveAndGenerate}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Approve & Generate Article
        </button>
      </div>
    </div>
  );
}
