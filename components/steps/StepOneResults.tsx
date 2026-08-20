import { ReactNode } from "react";
import type { ResearchQuery } from "../../utils/webSearch";
import type { BlogOutline } from "../../utils/outline";
import type { KeywordResearchResult } from "../../utils/keywordResearch";
import OutlineDisplay from "../OutlineDisplay";

export interface KeywordItem {
  text: string;
  isSuggested: boolean;
  source?: "recommended" | "reference" | "custom";
}

interface StepOneResultsProps {
  research: ResearchQuery[];
  outline: BlogOutline;
  keywordResearch: KeywordResearchResult;
  keywords: KeywordItem[];
  extractedTopic: string;
  isEditingKeywords: boolean;
  keywordsDraft: string;
  onToggleEditKeywords: () => void;
  onKeywordsDraftChange: (value: string) => void;
  onSaveKeywords: () => void;
  onAddDiscoveredKeyword: (text: string) => void;
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

function pillClasses(kind: "recommended" | "reference" | "custom") {
  if (kind === "recommended") return "bg-amber-100 text-amber-800 ring-1 ring-amber-300";
  if (kind === "reference") return "bg-blue-100 text-blue-800 ring-1 ring-blue-300";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function IntentBreakdown({ keywordResearch }: { keywordResearch: KeywordResearchResult }) {
  const total = keywordResearch.discoveredKeywords.length;
  if (total === 0) return null;

  const counts = { informational: 0, commercial: 0, transactional: 0 };
  for (const k of keywordResearch.discoveredKeywords) {
    counts[k.intent] += 1;
  }

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      <span>Informational: <span className="font-semibold text-slate-900">{pct(counts.informational)}%</span></span>
      <span>Commercial: <span className="font-semibold text-slate-900">{pct(counts.commercial)}%</span></span>
      <span>Transactional: <span className="font-semibold text-slate-900">{pct(counts.transactional)}%</span></span>
    </div>
  );
}

export default function StepOneResults({
  research,
  outline,
  keywordResearch,
  keywords,
  extractedTopic,
  isEditingKeywords,
  keywordsDraft,
  onToggleEditKeywords,
  onKeywordsDraftChange,
  onSaveKeywords,
  onAddDiscoveredKeyword,
  onApprove,
  onStartOver,
}: StepOneResultsProps) {
  const selectedTextSet = new Set(keywords.map((k) => k.text.toLowerCase()));
  const notYetSelected = keywordResearch.discoveredKeywords.filter(
    (k) => !selectedTextSet.has(k.keyword.toLowerCase())
  );

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

      <Section title="Keyword Research Findings">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Discovery strategy
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
              {keywordResearch.queriesRun.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-slate-700">{keywordResearch.strategy}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search intent breakdown
            </p>
            <div className="mt-1">
              <IntentBreakdown keywordResearch={keywordResearch} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Top recommended keywords
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {keywordResearch.recommendations.map((text) => (
                <span
                  key={text}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${pillClasses("recommended")}`}
                >
                  {text} <span className="ml-1">✨</span>
                </span>
              ))}
            </div>
          </div>

          {keywordResearch.userKeywordsAnalyzed.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your reference keywords
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {keywordResearch.userKeywordsAnalyzed.map((k) => (
                  <span
                    key={k.keyword}
                    title={k.found ? "Found in research findings" : "A gap — not found in research"}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${pillClasses("reference")}`}
                  >
                    {k.keyword} · potential {k.potential}/10 {k.found ? "✓" : "(gap)"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {notYetSelected.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Other discovered keywords
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {notYetSelected.map((k) => (
                  <button
                    key={k.keyword}
                    type="button"
                    onClick={() => onAddDiscoveredKeyword(k.keyword)}
                    title={`${k.source} · ${k.intent} · ranking ${k.ranking}/10`}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="text-emerald-600">+</span> {k.keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Selected Keywords">
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
                  className={`rounded-full px-3 py-1 text-xs font-medium ${pillClasses(
                    keyword.source ?? (keyword.isSuggested ? "recommended" : "custom")
                  )}`}
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
          {isEditingKeywords ? "Cancel Editing" : "Refine Keywords"}
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
