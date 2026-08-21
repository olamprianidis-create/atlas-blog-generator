import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../components/layout/Header";
import { CATEGORIES, STEPS } from "../utils/types";

interface DraftListItem {
  id: string;
  title: string;
  category: string | null;
  current_step: number;
  updated_at: string;
}

function categoryLabel(value: string | null) {
  if (!value) return "Uncategorized";
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function stepLabel(stepNumber: number) {
  return STEPS.find((s) => s.number === stepNumber)?.label ?? `Step ${stepNumber}`;
}

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void loadDrafts();
  }, []);

  async function loadDrafts() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/drafts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load drafts");
      setDrafts(data as DraftListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to delete draft");
      }
      setDrafts((current) => current.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete draft");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Drafts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Resume an article you saved before finishing.
          </p>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-8 text-sm text-slate-500">Loading drafts…</p>
          ) : drafts.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">
              No saved drafts yet. Use "Save as Draft" while working on an article to see it
              here.
            </p>
          ) : (
            <ul className="mt-8 flex flex-col gap-3">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{draft.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {categoryLabel(draft.category)} · {stepLabel(draft.current_step)} ·{" "}
                      {formatUpdatedAt(draft.updated_at)}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <Link
                      href={`/?draft=${draft.id}`}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      Resume
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(draft.id)}
                      disabled={deletingId === draft.id}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === draft.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
