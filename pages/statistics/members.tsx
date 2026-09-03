import { useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";

interface MemberRow {
  id: string;
  fullName: string;
  email: string;
  memberNumber: number | null;
}

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/statistics/members")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load members");
        setMembers(data as MemberRow[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load members"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every ATLAS Network member, in the order they joined.
          </p>

          {error && (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-8 text-sm text-slate-500">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">No members yet.</p>
          ) : (
            <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Name
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Number
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3 font-medium text-slate-900">{member.fullName}</td>
                      <td className="px-5 py-3 text-slate-600">{member.email}</td>
                      <td className="px-5 py-3 text-slate-600">{member.memberNumber ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
