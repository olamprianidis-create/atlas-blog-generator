import { useEffect, useState } from "react";
import Header from "../../components/layout/Header";

interface SurveyResponseItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whyJoined: string;
  whatToGain: string;
  growthArea: string;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SurveyPage() {
  const [responses, setResponses] = useState<SurveyResponseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/statistics/survey")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load survey responses");
        setResponses(data as SurveyResponseItem[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load survey responses"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">New Member Survey</h1>
          <p className="mt-1 text-sm text-slate-500">
            Answers from the "Your Thoughts" step of the new-member welcome flow. Entries older than 90 days no
            longer appear here.
          </p>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-8 text-sm text-slate-500">Loading survey responses…</p>
          ) : responses.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">No responses in the last 90 days.</p>
          ) : (
            <ul className="mt-8 flex flex-col gap-4">
              {responses.map((response) => (
                <li key={response.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {response.firstName} {response.lastName}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(response.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{response.email}</p>

                  <div className="mt-4 flex flex-col gap-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Why did I join this group?
                      </p>
                      <p>{response.whyJoined}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        What do I hope to gain from ATLAS Network?
                      </p>
                      <p>{response.whatToGain}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Where do I believe I have the most room for growth in my life?
                      </p>
                      <p>{response.growthArea}</p>
                    </div>
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
