// Server-only: campaign analytics, computed live from email_sends (one row
// per recipient, stamped by the Resend webhook) and email_events (every
// raw event). See CLAUDE.md "Email campaigns" → analytics.
//
// Rate definitions (industry standard):
//   delivery    = delivered / sent
//   open        = unique openers / delivered   (inflated by Apple Mail Privacy Protection — approximate)
//   click       = unique clickers / delivered  (the most reliable engagement number)
//   CTOR        = unique clickers / unique openers
//   unsubscribe = unsubscribes / delivered
//   spam        = complaints / delivered
//   bounce      = bounces / sent
// "Your average" pools every OTHER sent campaign with tracking data (sum
// of numerators / sum of denominators), so it stabilizes as volume grows.
import { getServiceClient } from "./supabase";
import { CAMPAIGN_COLUMNS, EmailCampaign } from "./emailCampaigns";
import {
  CampaignOverview,
  CampaignReport,
  Counts,
  METRICS,
  MetricKey,
  RecipientRow,
  RecipientState,
  TimelineBucket,
  computeRates,
} from "./emailAnalyticsShared";

const PAGE = 1000; // Supabase's per-request row cap
const COLLECTING_HOURS = 72;

// Pages through a query so totals don't silently stop at 1,000 rows.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

interface SendRow {
  id: string;
  campaign_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  unsubscribed_at: string | null;
  error: string | null;
}
interface EventRow {
  send_id: string | null;
  campaign_id: string | null;
  type: string;
  link: string | null;
  occurred_at: string;
}

const SEND_COLUMNS =
  "id, campaign_id, email, first_name, last_name, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, unsubscribed_at, error";

function countSends(sends: SendRow[], events: EventRow[]): Counts {
  return {
    sent: sends.filter((s) => s.status !== "queued" && s.status !== "failed").length,
    delivered: sends.filter((s) => s.delivered_at).length,
    bounced: sends.filter((s) => s.bounced_at).length,
    failed: sends.filter((s) => s.status === "failed").length,
    complained: sends.filter((s) => s.complained_at).length,
    uniqueOpens: sends.filter((s) => s.opened_at).length,
    totalOpens: events.filter((e) => e.type === "email.opened").length,
    uniqueClicks: sends.filter((s) => s.clicked_at).length,
    totalClicks: events.filter((e) => e.type === "email.clicked" && !isUnsubscribeLink(e.link)).length,
    unsubscribed: sends.filter((s) => s.unsubscribed_at).length,
  };
}

function isUnsubscribeLink(link: string | null): boolean {
  return Boolean(link && /\/unsubscribe(\?|$)/.test(link));
}

export function recipientState(s: Pick<SendRow, "status" | "delivered_at" | "opened_at" | "clicked_at" | "bounced_at" | "complained_at" | "unsubscribed_at">): RecipientState {
  if (s.complained_at) return "complained";
  if (s.bounced_at) return "bounced";
  if (s.status === "failed") return "failed";
  if (s.unsubscribed_at) return "unsubscribed";
  if (s.clicked_at) return "clicked";
  if (s.opened_at) return "opened";
  if (s.delivered_at) return "delivered";
  if (s.status === "queued") return "queued";
  return "sent";
}

// Unique first-opens / first-clicks per hour (first 72h) or per day.
function buildTimeline(sends: SendRow[], start: Date, now: Date): { granularity: "hour" | "day"; buckets: TimelineBucket[] } {
  const ageHours = (now.getTime() - start.getTime()) / 3_600_000;
  const granularity = ageHours <= COLLECTING_HOURS ? "hour" : "day";
  const size = granularity === "hour" ? 3_600_000 : 86_400_000;
  const count = Math.min(Math.max(Math.ceil((now.getTime() - start.getTime()) / size), 1), granularity === "hour" ? 72 : 30);
  const buckets: TimelineBucket[] = Array.from({ length: count }, (_, i) => ({
    start: new Date(start.getTime() + i * size).toISOString(),
    opens: 0,
    clicks: 0,
  }));
  const place = (iso: string | null, key: "opens" | "clicks") => {
    if (!iso) return;
    const i = Math.floor((new Date(iso).getTime() - start.getTime()) / size);
    if (i >= 0 && i < buckets.length) buckets[i][key]++;
  };
  for (const s of sends) {
    place(s.opened_at, "opens");
    place(s.clicked_at, "clicks");
  }
  return { granularity, buckets };
}

async function loadSentCampaigns(): Promise<EmailCampaign[]> {
  return fetchAll<EmailCampaign>((from, to) =>
    getServiceClient()
      .from("email_campaigns")
      .select(CAMPAIGN_COLUMNS)
      .in("status", ["sending", "sent", "failed"])
      .order("started_at", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: EmailCampaign[] | null; error: unknown }>
  );
}

async function loadSends(campaignIds: string[]): Promise<SendRow[]> {
  if (campaignIds.length === 0) return [];
  return fetchAll<SendRow>((from, to) =>
    getServiceClient()
      .from("email_sends")
      .select(SEND_COLUMNS)
      .in("campaign_id", campaignIds)
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: SendRow[] | null; error: unknown }>
  );
}

async function loadEvents(campaignIds: string[], types?: string[]): Promise<EventRow[]> {
  if (campaignIds.length === 0) return [];
  return fetchAll<EventRow>((from, to) => {
    let q = getServiceClient()
      .from("email_events")
      .select("send_id, campaign_id, type, link, occurred_at")
      .in("campaign_id", campaignIds);
    if (types) q = q.in("type", types);
    return q.order("occurred_at").range(from, to) as unknown as PromiseLike<{ data: EventRow[] | null; error: unknown }>;
  });
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(row);
  }
  return map;
}

function sumCounts(list: Counts[]): Counts {
  const total: Counts = { sent: 0, delivered: 0, bounced: 0, failed: 0, complained: 0, uniqueOpens: 0, totalOpens: 0, uniqueClicks: 0, totalClicks: 0, unsubscribed: 0 };
  for (const c of list) for (const k of Object.keys(total) as (keyof Counts)[]) total[k] += c[k];
  return total;
}

// Counts for every sent campaign, plus which ones have any webhook data
// (campaigns sent before tracking existed only know who they went to).
async function loadAllCounts(): Promise<{ campaigns: EmailCampaign[]; counts: Map<string, Counts>; tracked: Set<string> }> {
  const campaigns = await loadSentCampaigns();
  const ids = campaigns.map((c) => c.id);
  const [sends, events] = await Promise.all([loadSends(ids), loadEvents(ids, ["email.opened", "email.clicked", "email.delivered", "email.bounced"])]);
  const sendsBy = groupBy(sends, (s) => s.campaign_id);
  const eventsBy = groupBy(events, (e) => e.campaign_id);
  const counts = new Map<string, Counts>();
  for (const id of ids) counts.set(id, countSends(sendsBy.get(id) ?? [], eventsBy.get(id) ?? []));
  return { campaigns, counts, tracked: new Set(eventsBy.keys()) };
}

export async function getCampaignReport(campaignId: string): Promise<CampaignReport | null> {
  const supabase = getServiceClient();
  const { data: campaignRow, error } = await supabase.from("email_campaigns").select(CAMPAIGN_COLUMNS).eq("id", campaignId).maybeSingle();
  if (error) throw error;
  if (!campaignRow) return null;
  const campaign = campaignRow as EmailCampaign;

  const [sends, events, all] = await Promise.all([loadSends([campaignId]), loadEvents([campaignId]), loadAllCounts()]);
  const counts = countSends(sends, events);
  const rates = computeRates(counts);
  const tracked = events.length > 0;

  // Benchmarks: every other tracked campaign, pooled.
  const others = all.campaigns.filter((c) => c.id !== campaignId && all.tracked.has(c.id));
  const benchmarkCounts = sumCounts(others.map((c) => all.counts.get(c.id)!));
  const benchmarkRates = computeRates(benchmarkCounts);

  // Rank among all tracked campaigns (this one included). 1 = best.
  const ranked = all.campaigns.filter((c) => all.tracked.has(c.id) || c.id === campaignId);
  const ranks = {} as Record<MetricKey, { rank: number; of: number } | null>;
  for (const metric of METRICS) {
    const values = ranked
      .map((c) => ({ id: c.id, value: computeRates(c.id === campaignId ? counts : all.counts.get(c.id)!)[metric.key] }))
      .filter((v): v is { id: string; value: number } => v.value !== null);
    const mine = values.find((v) => v.id === campaignId);
    if (!tracked || !mine || values.length < 2) {
      ranks[metric.key] = null;
      continue;
    }
    const better = values.filter((v) => (metric.higherIsBetter ? v.value > mine.value : v.value < mine.value)).length;
    ranks[metric.key] = { rank: better + 1, of: values.length };
  }

  // Clicks per link (unsubscribe clicks are counted as unsubscribes instead).
  const clickEvents = events.filter((e) => e.type === "email.clicked" && e.link && !isUnsubscribeLink(e.link));
  const links = Array.from(groupBy(clickEvents, (e) => e.link)).map(([link, rows]) => ({
    link,
    totalClicks: rows.length,
    uniqueClickers: new Set(rows.map((r) => r.send_id)).size,
  }));
  links.sort((a, b) => b.totalClicks - a.totalClicks);

  const opensBySend = groupBy(events.filter((e) => e.type === "email.opened"), (e) => e.send_id);
  const clicksBySend = groupBy(clickEvents, (e) => e.send_id);
  const recipients: RecipientRow[] = sends
    .map((s) => ({
      email: s.email,
      name: [s.first_name, s.last_name].filter(Boolean).join(" "),
      state: recipientState(s),
      deliveredAt: s.delivered_at,
      openedAt: s.opened_at,
      clickedAt: s.clicked_at,
      opens: opensBySend.get(s.id)?.length ?? 0,
      clicks: clicksBySend.get(s.id)?.length ?? 0,
      error: s.error,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  const start = new Date(campaign.started_at ?? campaign.send_at ?? campaign.created_at);
  const now = new Date();
  return {
    campaign,
    tracked,
    collecting: now.getTime() - start.getTime() < COLLECTING_HOURS * 3_600_000,
    counts,
    rates,
    benchmark: { campaigns: others.length, counts: benchmarkCounts, rates: benchmarkRates },
    ranks,
    timeline: buildTimeline(sends, start, now),
    links,
    recipients,
  };
}

export async function getCampaignOverview(): Promise<CampaignOverview> {
  const all = await loadAllCounts();
  const trackedCampaigns = all.campaigns.filter((c) => all.tracked.has(c.id));
  const totals = sumCounts(trackedCampaigns.map((c) => all.counts.get(c.id)!));
  return {
    campaignsSent: all.campaigns.length,
    emailsSent: sumCounts(all.campaigns.map((c) => all.counts.get(c.id)!)).sent,
    trackedCampaigns: trackedCampaigns.length,
    rates: computeRates(totals),
    series: trackedCampaigns.map((c) => ({
      id: c.id,
      subject: c.subject,
      sentAt: c.started_at ?? c.send_at ?? c.created_at,
      rates: computeRates(all.counts.get(c.id)!),
    })),
  };
}

export interface ContactActivityItem {
  campaignId: string;
  subject: string;
  sentAt: string | null;
  state: RecipientState;
  openedAt: string | null;
  clickedAt: string | null;
  opens: number;
  clicks: number;
}

// Every campaign email one contact was sent, newest first (Contacts page).
// Matched by contact id or by email, since a send made before the contact
// existed (e.g. a member who later became a contact) has no contact id.
export async function getContactActivity(contactId: string, email: string | null): Promise<ContactActivityItem[]> {
  const supabase = getServiceClient();
  // Quoted so commas/parentheses in an address can't break the filter syntax.
  const quoted = email ? `"${email.toLowerCase().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : null;
  const filter = quoted ? `contact_id.eq.${contactId},email.eq.${quoted}` : `contact_id.eq.${contactId}`;
  const { data: sends, error } = await supabase
    .from("email_sends")
    .select(`${SEND_COLUMNS}, email_campaigns(subject)`)
    .or(filter)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  const rows = (sends ?? []) as unknown as (SendRow & { email_campaigns: { subject: string } | null })[];
  if (rows.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from("email_events")
    .select("send_id, type, link")
    .in(
      "send_id",
      rows.map((r) => r.id)
    )
    .in("type", ["email.opened", "email.clicked"]);
  if (eventsError) throw eventsError;
  const count = (sendId: string, type: string) =>
    (events ?? []).filter((e) => e.send_id === sendId && e.type === type && !(type === "email.clicked" && isUnsubscribeLink(e.link as string | null))).length;

  return rows.map((r) => ({
    campaignId: r.campaign_id,
    subject: r.email_campaigns?.subject || "Untitled campaign",
    sentAt: r.sent_at,
    state: recipientState(r),
    openedAt: r.opened_at,
    clickedAt: r.clicked_at,
    opens: count(r.id, "email.opened"),
    clicks: count(r.id, "email.clicked"),
  }));
}
