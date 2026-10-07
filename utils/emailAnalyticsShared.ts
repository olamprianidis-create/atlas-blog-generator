// Client-safe types, metric definitions and reference values for email
// campaign analytics (computed server-side in utils/emailAnalytics.ts).
import type { EmailCampaign } from "./emailCampaigns";

export interface Counts {
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  complained: number;
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  totalClicks: number;
  unsubscribed: number;
}

export type MetricKey = "deliveryRate" | "openRate" | "clickRate" | "ctor" | "unsubscribeRate" | "complaintRate" | "bounceRate";
export type Rates = Record<MetricKey, number | null>; // 0–1, null when there's nothing to divide by

export interface MetricDef {
  key: MetricKey;
  label: string;
  higherIsBetter: boolean;
  help: string;
  // Mailchimp's all-industry averages — shown faintly for context only.
  industry?: number;
  // Above this (or below, for delivery) the metric is flagged.
  warnAt?: number;
  dangerAt?: number;
}

// Order = order on the report page.
export const METRICS: MetricDef[] = [
  { key: "clickRate", label: "Click rate", higherIsBetter: true, industry: 0.0262, help: "People who clicked a link ÷ delivered. The most reliable sign someone read it." },
  { key: "ctor", label: "Click-to-open", higherIsBetter: true, help: "Clickers ÷ openers. How compelling the content was once opened." },
  { key: "openRate", label: "Open rate", higherIsBetter: true, industry: 0.3563, help: "Approximate — Apple Mail opens every email automatically, which inflates this." },
  { key: "deliveryRate", label: "Delivered", higherIsBetter: true, help: "Accepted by the recipient's mail server ÷ sent." },
  { key: "unsubscribeRate", label: "Unsubscribes", higherIsBetter: false, industry: 0.0022, warnAt: 0.005, dangerAt: 0.01, help: "Unsubscribed from this email ÷ delivered." },
  { key: "complaintRate", label: "Spam reports", higherIsBetter: false, warnAt: 0.001, dangerAt: 0.003, help: "Marked as spam ÷ delivered. Gmail starts filtering senders above 0.3%; keep it under 0.1%." },
  { key: "bounceRate", label: "Bounces", higherIsBetter: false, warnAt: 0.02, dangerAt: 0.05, help: "Rejected by the recipient's mail server ÷ sent. Keep under 2%." },
];

export function computeRates(c: Counts): Rates {
  const div = (n: number, d: number) => (d > 0 ? n / d : null);
  return {
    deliveryRate: div(c.delivered, c.sent),
    openRate: div(c.uniqueOpens, c.delivered),
    clickRate: div(c.uniqueClicks, c.delivered),
    ctor: div(c.uniqueClicks, c.uniqueOpens),
    unsubscribeRate: div(c.unsubscribed, c.delivered),
    complaintRate: div(c.complained, c.delivered),
    bounceRate: div(c.bounced, c.sent),
  };
}

export function healthLevel(metric: MetricDef, value: number | null): "ok" | "warn" | "danger" {
  if (value === null) return "ok";
  if (metric.dangerAt !== undefined && value >= metric.dangerAt) return "danger";
  if (metric.warnAt !== undefined && value >= metric.warnAt) return "warn";
  return "ok";
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null) return "—";
  const pct = value * 100;
  // Small rates (spam, unsubscribes) need more precision to be meaningful.
  return `${pct > 0 && pct < 1 ? pct.toFixed(2) : pct.toFixed(digits)}%`;
}

export type RecipientState = "queued" | "sent" | "delivered" | "opened" | "clicked" | "unsubscribed" | "bounced" | "complained" | "failed";

export interface RecipientRow {
  email: string;
  name: string;
  state: RecipientState;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  opens: number;
  clicks: number;
  error: string | null;
}

export interface TimelineBucket {
  start: string;
  opens: number; // people opening for the first time in this bucket
  clicks: number; // people clicking for the first time in this bucket
}

export interface CampaignReport {
  campaign: EmailCampaign;
  tracked: boolean; // false → sent before tracking existed; only recipients are known
  collecting: boolean; // < 72h old; numbers still moving
  counts: Counts;
  rates: Rates;
  benchmark: { campaigns: number; counts: Counts; rates: Rates };
  ranks: Record<MetricKey, { rank: number; of: number } | null>;
  timeline: { granularity: "hour" | "day"; buckets: TimelineBucket[] };
  links: { link: string; totalClicks: number; uniqueClickers: number }[];
  recipients: RecipientRow[];
}

export interface CampaignOverview {
  campaignsSent: number;
  emailsSent: number;
  trackedCampaigns: number;
  rates: Rates;
  series: { id: string; subject: string; sentAt: string; rates: Rates }[];
}
