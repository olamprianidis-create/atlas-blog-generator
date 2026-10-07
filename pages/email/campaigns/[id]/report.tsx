import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppLayout from "../../../../components/layout/AppLayout";
import TimelineChart from "../../../../components/email/analytics/TimelineChart";
import { EmailPreview } from "../../../../components/email/EmailPreviews";
import { SenderSettings, campaignStatusLabel } from "../../../../utils/emailCampaigns";
import {
  CampaignReport,
  Counts,
  METRICS,
  MetricDef,
  MetricKey,
  RecipientState,
  formatPercent,
  healthLevel,
} from "../../../../utils/emailAnalyticsShared";

// Numerator / denominator behind each rate, for the "3 of 120" line.
const FRACTIONS: Record<MetricKey, (c: Counts) => [number, number, string]> = {
  clickRate: (c) => [c.uniqueClicks, c.delivered, "delivered"],
  ctor: (c) => [c.uniqueClicks, c.uniqueOpens, "openers"],
  openRate: (c) => [c.uniqueOpens, c.delivered, "delivered"],
  deliveryRate: (c) => [c.delivered, c.sent, "sent"],
  unsubscribeRate: (c) => [c.unsubscribed, c.delivered, "delivered"],
  complaintRate: (c) => [c.complained, c.delivered, "delivered"],
  bounceRate: (c) => [c.bounced, c.sent, "sent"],
};

const STATE_LABELS: Record<RecipientState, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  complained: "Marked spam",
  failed: "Failed",
};
const STATE_STYLES: Record<RecipientState, string> = {
  queued: "bg-slate-100 text-slate-600",
  sent: "bg-slate-100 text-slate-600",
  delivered: "bg-slate-100 text-slate-700",
  opened: "bg-blue-50 text-blue-700",
  clicked: "bg-green-50 text-green-700",
  unsubscribed: "bg-amber-50 text-amber-800",
  bounced: "bg-red-50 text-red-700",
  complained: "bg-red-50 text-red-700",
  failed: "bg-red-50 text-red-700",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function MetricTile({ metric, report }: { metric: MetricDef; report: CampaignReport }) {
  // Without webhook data every rate would read 0%, which looks like a real result.
  const value = report.tracked ? report.rates[metric.key] : null;
  const bench = report.benchmark.rates[metric.key];
  const rank = report.ranks[metric.key];
  const [num, den, denLabel] = FRACTIONS[metric.key](report.counts);
  const health = healthLevel(metric, value);

  let delta: React.ReactNode = null;
  if (value !== null && bench !== null) {
    const points = (value - bench) * 100;
    const better = metric.higherIsBetter ? points > 0 : points < 0;
    const same = Math.abs(points) < 0.05;
    delta = (
      <span className={same ? "text-slate-500" : better ? "text-green-700" : "text-red-700"}>
        {same ? "≈ " : points > 0 ? "▲ " : "▼ "}
        {same ? "same as" : `${points > 0 ? "+" : ""}${points.toFixed(Math.abs(points) < 1 ? 2 : 1)} pts vs`} your avg{" "}
        <span className="text-slate-500">({formatPercent(bench)})</span>
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        health === "danger" ? "border-red-300" : health === "warn" ? "border-amber-300" : "border-slate-200"
      }`}
      title={metric.help}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">
          {metric.label}
          {metric.key === "openRate" && <span className="text-slate-400"> · approx.</span>}
        </p>
        {rank && <p className="text-[11px] text-slate-400 tabular-nums">#{rank.rank} of {rank.of}</p>}
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{formatPercent(value)}</p>
      <p className="text-xs text-slate-500 tabular-nums">
        {num} of {den} {denLabel}
      </p>
      <div className="mt-2 space-y-0.5 text-xs">
        {delta ?? <p className="text-slate-400">No benchmark yet — it builds as you send more.</p>}
        {metric.industry !== undefined && <p className="text-slate-400">Industry avg {formatPercent(metric.industry)}</p>}
        {health !== "ok" && (
          <p className={health === "danger" ? "font-medium text-red-700" : "font-medium text-amber-700"}>
            {health === "danger" ? "✕ Above the healthy limit" : "! Getting close to the limit"}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CampaignReportPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [sender, setSender] = useState<SenderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RecipientState | "all">("all");
  const [search, setSearch] = useState("");
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetch(`/api/email/campaigns/${id}/report`), fetch(`/api/email/campaigns/${id}`)])
      .then(async ([r1, r2]) => {
        const [reportData, campaignData] = await Promise.all([r1.json(), r2.json()]);
        if (!r1.ok) throw new Error(reportData.error ?? "Failed to load report");
        setReport(reportData as CampaignReport);
        if (r2.ok) setSender(campaignData.sender as SenderSettings);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"));
  }, [id]);

  const stateCounts = useMemo(() => {
    const counts = new Map<RecipientState, number>();
    for (const r of report?.recipients ?? []) counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
    return counts;
  }, [report]);

  const visibleRecipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (report?.recipients ?? []).filter(
      (r) => (filter === "all" || r.state === filter) && (!q || r.email.includes(q) || r.name.toLowerCase().includes(q))
    );
  }, [report, filter, search]);

  if (!report) {
    return (
      <AppLayout>
        <main className="flex-1 p-10 text-sm text-slate-500">{error ?? "Loading report…"}</main>
      </AppLayout>
    );
  }

  const { campaign } = report;
  const sentAt = campaign.started_at ?? campaign.send_at;
  const maxLinkClicks = Math.max(1, ...report.links.map((l) => l.totalClicks));

  return (
    <AppLayout>
      <main className="flex-1 overflow-y-auto bg-slate-50 px-10 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <Link href="/email/campaigns" className="text-xs font-medium text-slate-500 hover:text-slate-900">
              ← All campaigns
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{campaign.subject || "Untitled campaign"}</h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {campaignStatusLabel(campaign.status)}
              </span>
              {report.collecting && report.tracked && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700" title="Numbers keep changing for about 3 days after sending">
                  Still collecting
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              From {campaign.from_name} · {report.counts.sent} sent{sentAt ? ` · ${formatDateTime(sentAt)}` : ""}
              {report.benchmark.campaigns > 0 && ` · compared with your other ${report.benchmark.campaigns} campaign${report.benchmark.campaigns === 1 ? "" : "s"}`}
            </p>
          </div>

          {!report.tracked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No tracking data for this email yet. Emails sent before tracking was switched on (or within the last minute or two)
              only show who they were sent to.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METRICS.map((m) => (
              <MetricTile key={m.key} metric={m} report={report} />
            ))}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Totals</p>
              <dl className="mt-2 space-y-1 text-xs tabular-nums">
                {[
                  ["Total opens", report.counts.totalOpens],
                  ["Total clicks", report.counts.totalClicks],
                  ["Failed to send", report.counts.failed],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">When people engaged</h2>
            <p className="mb-3 text-xs text-slate-500">
              People opening or clicking for the first time, per {report.timeline.granularity} since sending.
            </p>
            {report.tracked ? (
              <TimelineChart buckets={report.timeline.buckets} granularity={report.timeline.granularity} />
            ) : (
              <p className="text-sm text-slate-500">No tracking data for this email.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Link clicks</h2>
            {report.links.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No link clicks yet.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Link</th>
                    <th className="w-1/3 pb-2 font-medium">Clicks</th>
                    <th className="pb-2 text-right font-medium">People</th>
                  </tr>
                </thead>
                <tbody>
                  {report.links.map((l) => (
                    <tr key={l.link} className="border-t border-slate-100">
                      <td className="max-w-0 truncate py-2 pr-4">
                        <a href={l.link} target="_blank" rel="noreferrer" className="text-slate-900 hover:underline" title={l.link}>
                          {l.link.replace(/^https?:\/\//, "")}
                        </a>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-r-[4px] bg-[#2a78d6]" style={{ width: `${(l.totalClicks / maxLinkClicks) * 100}%`, maxWidth: "80%" }} />
                          <span className="text-xs tabular-nums text-slate-700">{l.totalClicks}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-700">{l.uniqueClickers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Recipients</h2>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["all", "clicked", "opened", "delivered", "unsubscribed", "bounced", "complained", "failed", "sent", "queued"] as const)
                .filter((s) => s === "all" || stateCounts.get(s))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s === "all" ? "All" : STATE_LABELS[s]}{" "}
                    <span className="tabular-nums opacity-70">{s === "all" ? report.recipients.length : stateCounts.get(s)}</span>
                  </button>
                ))}
            </div>
            <div className="mt-3 max-h-[480px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Recipient</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">First opened</th>
                    <th className="pb-2 text-right font-medium">Opens</th>
                    <th className="pb-2 text-right font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecipients.map((r) => (
                    <tr key={r.email} className="border-t border-slate-100">
                      <td className="py-2 pr-4">
                        <p className="text-slate-900">{r.name || r.email}</p>
                        {r.name && <p className="text-xs text-slate-500">{r.email}</p>}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_STYLES[r.state]}`} title={r.error ?? undefined}>
                          {STATE_LABELS[r.state]}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-600">{formatDateTime(r.openedAt)}</td>
                      <td className="py-2 text-right tabular-nums text-slate-700">{r.opens}</td>
                      <td className="py-2 text-right tabular-nums text-slate-700">{r.clicks}</td>
                    </tr>
                  ))}
                  {visibleRecipients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                        No recipients match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <button type="button" onClick={() => setShowEmail((v) => !v)} className="text-sm font-semibold text-slate-900">
              {showEmail ? "▾" : "▸"} The email that was sent
            </button>
            {showEmail && sender && (
              <div className="mt-4 max-w-2xl">
                <EmailPreview campaign={campaign} mailingAddress={sender.mailingAddress} />
              </div>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
