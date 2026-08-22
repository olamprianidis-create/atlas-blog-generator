import { ReactNode } from "react";
import type { QualityCheckResult } from "../../utils/qualityChecklist";
import { Category, CATEGORIES } from "../../utils/types";
import { TIMEZONE_OPTIONS, formatPublishPreview } from "../../utils/timezones";
import Spinner from "../Spinner";

export interface ArticleSummary {
  title: string;
  metaDescription: string;
  readingTimeMinutes: number;
  checklist: QualityCheckResult[];
}

export interface ScheduleResult {
  articleId: string;
  publishPreview: string;
}

interface StepFiveScheduleProps {
  article: ArticleSummary;
  category: Category | null;
  onCategoryChange: (category: Category) => void;
  publishDate: string;
  publishTime: string;
  timezone: string;
  onPublishDateChange: (value: string) => void;
  onPublishTimeChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  isSubmitting: boolean;
  submitError: string | null;
  scheduleResult: ScheduleResult | null;
  onSchedule: () => void;
  onBackToArticle: () => void;
  onNextBlog: () => void;
  isPublishing: boolean;
  publishError: string | null;
  isPublished: boolean;
  onPublishNow: () => void;
  isEditingExisting?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  deleteError?: string | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function StepFiveSchedule({
  article,
  category,
  onCategoryChange,
  publishDate,
  publishTime,
  timezone,
  onPublishDateChange,
  onPublishTimeChange,
  onTimezoneChange,
  isSubmitting,
  submitError,
  scheduleResult,
  onSchedule,
  onBackToArticle,
  onNextBlog,
  isPublishing,
  publishError,
  isPublished,
  onPublishNow,
  isEditingExisting = false,
  onDelete,
  isDeleting = false,
  deleteError = null,
}: StepFiveScheduleProps) {
  const passedCount = article.checklist.filter((c) => c.passed).length;
  const totalChecks = article.checklist.length;
  const preview = formatPublishPreview(publishDate, publishTime, timezone);
  const canSchedule = !isSubmitting && !!category && !!publishDate && !!publishTime;

  const publishNowBlock = (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {isPublished ? (
        <p className="text-sm font-medium text-green-700">
          ✓ Published — status updated to &quot;published&quot; and the webhook was sent.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {isEditingExisting
              ? "Post this article right now instead of waiting for its scheduled time."
              : "The real publish happens automatically when the scheduled time arrives (via the cron job). To test the publish + webhook flow right now without waiting, use the button below."}
          </p>
          <button
            type="button"
            onClick={onPublishNow}
            disabled={isPublishing}
            className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPublishing && <Spinner />}
            {isPublishing ? "Publishing..." : "Publish Now"}
          </button>
          {publishError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {publishError}
            </p>
          )}
        </>
      )}
    </div>
  );

  const deleteBlock = isEditingExisting && onDelete && (
    <div className="mt-8 flex flex-col items-center gap-2 border-t border-slate-200 pt-6">
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Deleting..." : "Delete Article"}
      </button>
      <p className="text-xs text-slate-400">Removes this article from the website and database permanently.</p>
      {deleteError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
      )}
    </div>
  );

  if (scheduleResult) {
    return (
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Step 5: Schedule & Store</h2>

        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
          <p className="text-lg font-semibold text-green-800">
            ✓ Article scheduled for {scheduleResult.publishPreview}
          </p>
          <p className="mt-2 text-sm text-green-700">
            Saved to Supabase with status &quot;scheduled&quot; — article ID {scheduleResult.articleId}
          </p>
        </div>

        <Section title="Publish">{publishNowBlock}</Section>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onNextBlog}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next Blog
          </button>
        </div>

        {deleteBlock}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <h2 className="text-xl font-semibold text-slate-900">Step 5: Schedule & Store</h2>
      <p className="mt-1 text-sm text-slate-500">Review the summary, choose a publish time, and store it.</p>

      <Section title="Article Summary">
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p>
            <span className="font-medium text-slate-900">Title:</span>{" "}
            <span className="text-slate-700">{article.title}</span>
          </p>
          <p>
            <span className="font-medium text-slate-900">Meta description:</span>{" "}
            <span className="text-slate-700">{article.metaDescription}</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">Category:</span>
            {category ? (
              <span className="text-slate-700">
                {CATEGORIES.find((c) => c.value === category)?.label}
              </span>
            ) : (
              <select
                value={category ?? ""}
                onChange={(event) => onCategoryChange(event.target.value as Category)}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm"
              >
                <option value="" disabled>
                  Select a category...
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p>
            <span className="font-medium text-slate-900">Reading time:</span>{" "}
            <span className="text-slate-700">{article.readingTimeMinutes} min read</span>
          </p>
        </div>
      </Section>

      <Section title="Schedule">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="publish-date" className="mb-1 block text-xs text-slate-500">
                Date
              </label>
              <input
                id="publish-date"
                type="date"
                value={publishDate}
                onChange={(event) => onPublishDateChange(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="publish-time" className="mb-1 block text-xs text-slate-500">
                Time
              </label>
              <input
                id="publish-time"
                type="time"
                value={publishTime}
                onChange={(event) => onPublishTimeChange(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="publish-timezone" className="mb-1 block text-xs text-slate-500">
                Timezone
              </label>
              <select
                id="publish-timezone"
                value={timezone}
                onChange={(event) => onTimezoneChange(event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {preview && (
            <p className="mt-4 text-sm text-slate-600">
              Article will publish: <span className="font-medium text-slate-900">{preview}</span>
            </p>
          )}
        </div>
      </Section>

      {isEditingExisting && <Section title="Publish">{publishNowBlock}</Section>}

      <Section title={`Quality Checklist Summary (${passedCount}/${totalChecks} passed)`}>
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            passedCount === totalChecks
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {passedCount === totalChecks
            ? "✓ All quality checks passed — ready to publish."
            : `⚠ ${totalChecks - passedCount} check(s) flagged — you can still schedule, but consider reviewing the article first.`}
        </div>
      </Section>

      {submitError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="mt-8 flex justify-end gap-3">
        <button
          type="button"
          onClick={onBackToArticle}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Article
        </button>
        <button
          type="button"
          onClick={onSchedule}
          disabled={!canSchedule}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting && <Spinner />}
          {isSubmitting ? "Saving..." : isEditingExisting ? "Update Schedule" : "Schedule & Store"}
        </button>
      </div>

      {deleteBlock}
    </div>
  );
}
