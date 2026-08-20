import { ReactNode } from "react";
import type { ResearchQuery } from "../../utils/webSearch";
import type { BlogOutline } from "../../utils/outline";
import OutlineDisplay from "../OutlineDisplay";

export interface KeywordItem {
  text: string;
  isSuggested: boolean;
}

interface StepOneResultsProps {
  research: ResearchQuery[];
  outline: BlogOutline;
  keywords: KeywordItem[];
  extractedTopic: string;
  isEditingKeywords: boolean;
  keywordsDraft: string;
  onToggleEditKeywords: () => void;
  onKeywordsDraftChange: (value: string) => void;
  onSaveKeywords: () => void;
  onApprove: () => void;
  onStartOver: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function StepOneResults({
  research,
  outline,
  keywords,
  extractedTopic,
  isEditingKeywords,
  keywordsDraft,
  onToggleEditKeywords,
  onKeywordsDraftChange,
  onSaveKeywords,
  onApprove,
  onStartOver,
}: StepOneResultsProps) {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Step 1: Generate Outline + Keywords
          </h2>
          <p className="mt-1 text-sm text-slate-500">Review the results below, then approve.</p>
        </div>
        <button
          type="button"
          onClick={onStartOver}
          className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Start over
        </button>
      </div>

      <Section title="Research Findings">
        {extractedTopic && (
          <p className="mb-2 text-xs text-slate-400">
            Searched for: <span className="font-medium text-slate-600">{extractedTopic}</span>
          </p>
        )}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          {research.map((item) => (
            <div key={item.query}>
              <p className="text-xs font-medium text-slate-400">{item.query}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {item.findings.map((finding, index) => (
                  <li key={index}>{finding}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Generated Outline">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <OutlineDisplay outline={outline} />
        </div>
      </Section>

      <Section title="Keywords">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {isEditingKeywords ? (
            <div>
              <label htmlFor="keywords-draft" className="mb-2 block text-xs text-slate-500">
                Comma-separated keywords
              </label>
              <textarea
                id="keywords-draft"
                value={keywordsDraft}
                onChange={(event) => onKeywordsDraftChange(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onSaveKeywords}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save keywords
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  key={keyword.text}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    keyword.isSuggested
                      ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  title={keyword.isSuggested ? "Suggested keyword" : "Base keyword"}
                >
                  {keyword.text}
                  {keyword.isSuggested && <span className="ml-1">✨</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      <div className="mt-8 flex justify-end gap-3">
        <button
          type="button"
          onClick={onToggleEditKeywords}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {isEditingKeywords ? "Cancel Editing" : "Edit Keywords"}
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Approve Outline
        </button>
      </div>
    </div>
  );
}
