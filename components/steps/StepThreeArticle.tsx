import { ReactNode, useState } from "react";
import DOMPurify from "dompurify";
import type { QualityCheckResult } from "../../utils/qualityChecklist";
import Spinner from "../Spinner";

export interface ArticleData {
  title: string;
  html: string;
  metaDescription: string;
  wordCount: number;
  readingTimeMinutes: number;
  checklist: QualityCheckResult[];
}

interface StepThreeArticleProps {
  data: ArticleData | null;
  isLoading: boolean;
  error: string | null;
  onApproveAndSchedule: () => void;
  onRequestEdits: (instructions: string) => void;
  onRetry: () => void;
  onBack: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function StepThreeArticle({
  data,
  isLoading,
  error,
  onApproveAndSchedule,
  onRequestEdits,
  onRetry,
  onBack,
}: StepThreeArticleProps) {
  const [isRequestingEdits, setIsRequestingEdits] = useState(false);
  const [editInstructions, setEditInstructions] = useState("");

  function handleSubmitEdits() {
    const trimmed = editInstructions.trim();
    if (!trimmed) return;
    onRequestEdits(trimmed);
    setIsRequestingEdits(false);
    setEditInstructions("");
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Step 3: Generate Full Article</h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-20">
          <Spinner />
          <p className="text-sm text-slate-500">Generating the full article...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Step 3: Generate Full Article</h2>
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const passedCount = data.checklist.filter((c) => c.passed).length;

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Step 3: Generate Full Article</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.wordCount.toLocaleString()} words · {data.readingTimeMinutes} min read
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

      <Section title="Meta Description">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">{data.metaDescription}</p>
          <p className="mt-2 text-xs text-slate-400">{data.metaDescription.length} characters</p>
        </div>
      </Section>

      <Section title={`Quality Checklist (${passedCount}/${data.checklist.length} passed)`}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
          {data.checklist.map((check) => (
            <div key={check.id} className="flex items-start gap-2 py-1 text-sm">
              <span className={check.passed ? "text-green-600" : "text-red-500"}>
                {check.passed ? "✓" : "✗"}
              </span>
              <span className={check.passed ? "text-slate-700" : "text-slate-500"}>{check.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Full Article">
        <div
          className="prose prose-sm max-w-none max-h-[36rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 prose-headings:text-slate-900 prose-a:text-blue-600"
          dangerouslySetInnerHTML={{
            __html: typeof window !== "undefined" ? DOMPurify.sanitize(data.html) : data.html,
          }}
        />
      </Section>

      {isRequestingEdits && (
        <Section title="Request Edits">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label htmlFor="edit-instructions" className="mb-2 block text-xs text-slate-500">
              Describe the changes you'd like, then regenerate.
            </label>
            <textarea
              id="edit-instructions"
              value={editInstructions}
              onChange={(event) => setEditInstructions(event.target.value)}
              rows={3}
              placeholder="e.g. Make the tone more casual, add a stat about..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRequestingEdits(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitEdits}
                disabled={!editInstructions.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Regenerate
              </button>
            </div>
          </div>
        </Section>
      )}

      <div className="mt-8 flex justify-end gap-3">
        {!isRequestingEdits && (
          <button
            type="button"
            onClick={() => setIsRequestingEdits(true)}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Request Edits
          </button>
        )}
        <button
          type="button"
          onClick={onApproveAndSchedule}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Approve & Schedule
        </button>
      </div>
    </div>
  );
}
