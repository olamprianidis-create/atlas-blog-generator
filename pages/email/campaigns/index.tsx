import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppLayout from "../../../components/layout/AppLayout";
import { CAMPAIGN_STEPS, CampaignStatus, EmailCampaign, campaignStatusLabel } from "../../../utils/emailCampaigns";
import { CampaignOverview, formatPercent } from "../../../utils/emailAnalyticsShared";
import CampaignTrendChart from "../../../components/email/analytics/CampaignTrendChart";

const TABS: { key: string; label: string; statuses: CampaignStatus[] }[] = [
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled", "sending"] },
  { key: "sent", label: "Sent", statuses: ["sent", "failed", "canceled"] },
];

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-50 text-blue-700",
  sending: "bg-amber-50 text-amber-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  canceled: "bg-slate-100 text-slate-500",
};

// Sent/sending/failed campaigns open their analytics report; the rest
// open the wizard.
function campaignHref(c: EmailCampaign): string {
  return c.status === "sent" || c.status === "sending" || c.status === "failed"
    ? `/email/campaigns/${c.id}/report`
    : `/email/campaigns/${c.id}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [tab, setTab] = useState("drafts");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<CampaignOverview | null>(null);

  useEffect(() => {
    fetch("/api/email/analytics/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setOverview(data as CampaignOverview | null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/email/campaigns")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaigns");
        setCampaigns(data as EmailCampaign[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setIsLoading(false));
  }, []);

  async function createCampaign() {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/email/campaigns", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create campaign");
      await router.push(`/email/campaigns/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
      setIsCreating(false);
    }
  }

  async function deleteDraft(campaign: EmailCampaign) {
    if (!window.confirm(`Delete the draft "${campaign.subject || "Untitled campaign"}"? This can't be undone.`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/email/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      setCampaigns((current) => current.filter((c) => c.id !== campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const visible = campaigns
    .filter((c) => activeTab.statuses.includes(c.status))
    // Scheduled: soonest first. Others: most recently touched first.
    .sort((a, b) =>
      tab === "scheduled"
        ? (a.send_at ?? "").localeCompare(b.send_at ?? "")
        : (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at)
    );

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
              <p className="mt-1 text-sm text-slate-500">Draft, schedule and track your email campaigns.</p>
            </div>
            <button
              type="button"
              onClick={createCampaign}
              disabled={isCreating}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isCreating ? "Creating…" : "+ New Campaign"}
            </button>
          </div>

          {overview && overview.campaignsSent > 0 && (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  ["Campaigns sent", String(overview.campaignsSent)],
                  ["Emails sent", overview.emailsSent.toLocaleString()],
                  ["Avg click rate", formatPercent(overview.rates.clickRate)],
                  ["Avg open rate (approx.)", formatPercent(overview.rates.openRate)],
                  ["Avg unsubscribes", formatPercent(overview.rates.unsubscribeRate)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              {overview.series.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-1 text-xs font-medium text-slate-500">Click rate by campaign</p>
                  <CampaignTrendChart overview={overview} />
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Averages appear once a campaign with tracking has been sent.</p>
              )}
            </section>
          )}

          <div className="mt-6 flex gap-1 border-b border-slate-200">
            {TABS.map((t) => {
              const count = campaigns.filter((c) => t.statuses.includes(c.status)).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                    tab === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label} <span className="text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="mt-4 space-y-2">
            {isLoading && <p className="text-sm text-slate-500">Loading campaigns…</p>}
            {!isLoading && visible.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                No {activeTab.label.toLowerCase()} campaigns.
              </p>
            )}
            {visible.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
                <Link href={campaignHref(c)} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[c.status]}`}>
                      {campaignStatusLabel(c.status)}
                    </span>
                    <p className="truncate text-sm font-semibold text-slate-900 hover:underline">
                      {c.subject || "Untitled campaign"}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {c.from_name}
                    {c.status === "draft" &&
                      ` · Step ${c.current_step} of 5: ${CAMPAIGN_STEPS[c.current_step - 1]?.label} · edited ${formatDate(c.updated_at)}`}
                    {(c.status === "scheduled" || c.status === "sending") &&
                      c.send_at &&
                      ` · ${c.recipient_count ?? "?"} recipients · sends ${formatDate(c.send_at)}`}
                    {(c.status === "sent" || c.status === "failed") &&
                      ` · ${c.sent_count} sent${c.failed_count ? `, ${c.failed_count} failed` : ""}${c.completed_at ? ` · ${formatDate(c.completed_at)}` : ""}`}
                  </p>
                </Link>
                {c.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => deleteDraft(c)}
                    className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
                <Link
                  href={campaignHref(c)}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {c.status === "draft" ? "Continue" : "View"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
