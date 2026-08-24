import { useEffect, useState } from "react";
import Header from "../../components/layout/Header";

interface ApplicantItem {
  id: string;
  fullName: string;
  invitedBy: string;
  reason: string;
  availability: string;
  email: string;
  phone: string;
  whyAdmit: string;
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

export default function ApplicantsPage() {
  const [applicants, setApplicants] = useState<ApplicantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/statistics/applicants")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load applicants");
        setApplicants(data as ApplicantItem[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applicants"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Applicants</h1>
          <p className="mt-1 text-sm text-slate-500">
            "Join The Network" requests submitted on atlasnetwork.club.
          </p>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-8 text-sm text-slate-500">Loading applicants…</p>
          ) : applicants.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">No applications yet.</p>
          ) : (
            <ul className="mt-8 flex flex-col gap-4">
              {applicants.map((applicant) => (
                <li key={applicant.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{applicant.fullName}</p>
                    <p className="text-xs text-slate-400">{formatDate(applicant.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {applicant.email} · {applicant.phone}
                  </p>

                  <div className="mt-4 flex flex-col gap-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invited By</p>
                      <p>{applicant.invitedBy}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Why Do You Want To Join?
                      </p>
                      <p>{applicant.reason}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Current Availability
                      </p>
                      <p>{applicant.availability}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Why Should They Be Admitted?
                      </p>
                      <p>{applicant.whyAdmit}</p>
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
