import { ReactNode } from "react";
import type { KeywordResearchResult } from "../../utils/keywordResearch";
import Spinner from "../Spinner";

export interface KeywordItem {
  text: string;
  isSuggested: boolean;
  source?: "recommended" | "reference" | "custom";
}

interface StepTwoImageKeywordsProps {
  headerImageUrl: string | null;
  isUploadingImage: boolean;
  imageUploadError: string | null;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;

  referenceKeywords: string;
  onReferenceKeywordsChange: (value: string) => void;

  keywordResearch: KeywordResearchResult | null;
  isResearching: boolean;
  researchError: string | null;
  onRunResearch: () => void;
  onRetryResearchWithMoreTokens: () => void;
  onContinueWithoutResearch: () => void;

  keywords: KeywordItem[];
  isEditingKeywords: boolean;
  keywordsDraft: string;
  onToggleEditKeywords: () => void;
  onKeywordsDraftChange: (value: string) => void;
  onSaveKeywords: () => void;
  onAddDiscoveredKeyword: (text: string) => void;

  onBack: () => void;
  onNext: () => void;
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

export default function StepTwoImageKeywords({
  headerImageUrl,
  isUploadingImage,
  imageUploadError,
  onUploadImage,
  onRemoveImage,
  referenceKeywords,
  onReferenceKeywordsChange,
  keywordResearch,
  isResearching,
  researchError,
  onRunResearch,
  onRetryResearchWithMoreTokens,
  onContinueWithoutResearch,
  keywords,
  isEditingKeywords,
  keywordsDraft,
  onToggleEditKeywords,
  onKeywordsDraftChange,
  onSaveKeywords,
  onAddDiscoveredKeyword,
  onBack,
  onNext,
}: StepTwoImageKeywordsProps) {
  const selectedTextSet = new Set(keywords.map((k) => k.text.toLowerCase()));
  const notYetSelected = keywordResearch
    ? keywordResearch.discoveredKeywords.filter((k) => !selectedTextSet.has(k.keyword.toLowerCase()))
    : [];

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUploadImage(file);
    event.target.value = "";
  }

  const canContinue = !isResearching && keywords.length > 0 && !isUploadingImage;

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Step 2: Image & Keywords</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a header image and finalize the keywords the article will target.
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

      <Section title="Header Image">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {headerImageUrl ? (
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={headerImageUrl}
                alt="Article header"
                className="h-32 w-56 rounded-lg border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={onRemoveImage}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600">
                {isUploadingImage ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Uploading...
                  </span>
                ) : (
                  "Click to upload a header image (JPG, PNG, WEBP, or GIF, under 5MB)"
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </label>
            </div>
          )}
          {imageUploadError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {imageUploadError}
            </p>
          )}
        </div>
      </Section>

      <Section title="Reference Keywords (optional)">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <input
            type="text"
            value={referenceKeywords}
            onChange={(event) => onReferenceKeywordsChange(event.target.value)}
            placeholder="e.g., fundraising, startup funding, venture capital"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onRunResearch}
              disabled={isResearching}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isResearching && <Spinner />}
              {isResearching ? "Researching..." : keywordResearch ? "Refresh Research" : "Research Keywords"}
            </button>
          </div>
          {researchError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">{researchError}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {researchError.includes("truncated") && (
                  <button
                    type="button"
                    onClick={onRetryResearchWithMoreTokens}
                    disabled={isResearching}
                    className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Retry with more tokens
                  </button>
                )}
                <button
                  type="button"
                  onClick={onContinueWithoutResearch}
                  className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Continue with workflow
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {keywordResearch && (
        <Section title="Keyword Research Findings">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Discovery strategy</p>
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
                  <span key={text} className={`rounded-full px-3 py-1 text-xs font-medium ${pillClasses("recommended")}`}>
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
      )}

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
            <div>
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
                {keywords.length === 0 && (
                  <p className="text-sm text-slate-400">No keywords yet — run research above or add your own.</p>
                )}
              </div>
              <button
                type="button"
                onClick={onToggleEditKeywords}
                className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Refine Keywords
              </button>
            </div>
          )}
        </div>
      </Section>

      <div className="mt-8 flex justify-end gap-3">
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Next: Generate Outline
        </button>
      </div>
    </div>
  );
}
