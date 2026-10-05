// Shared (client + server) types and helpers for Email campaigns.
// See CLAUDE.md "Email campaigns" and supabase/migrations/0019_email_campaigns.sql.

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "canceled" | "failed";

export interface EmailCampaign {
  id: string;
  status: CampaignStatus;
  current_step: number;
  audience_list_ids: string[];
  include_all_members: boolean;
  include_all_contacts: boolean;
  send_immediately: boolean;
  send_date: string | null;
  send_time: string | null;
  timezone: string;
  send_at: string | null;
  from_name: string;
  subject: string;
  preview_text: string;
  body_html: string;
  source_article_id: string | null;
  recipient_count: number | null;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const CAMPAIGN_COLUMNS =
  "id, status, current_step, audience_list_ids, include_all_members, include_all_contacts, send_immediately, send_date, send_time, timezone, send_at, from_name, subject, preview_text, body_html, source_article_id, recipient_count, sent_count, failed_count, scheduled_at, started_at, completed_at, last_error, created_at, updated_at";

// The fields the wizard is allowed to edit (everything else is set by the
// server: status, counts, timestamps).
export const EDITABLE_CAMPAIGN_FIELDS = [
  "current_step",
  "audience_list_ids",
  "include_all_members",
  "include_all_contacts",
  "send_immediately",
  "send_date",
  "send_time",
  "timezone",
  "from_name",
  "subject",
  "preview_text",
  "body_html",
] as const;

export type CampaignEdits = Partial<Pick<EmailCampaign, (typeof EDITABLE_CAMPAIGN_FIELDS)[number]>>;

export const CAMPAIGN_STEPS = [
  { number: 1, label: "Audience" },
  { number: 2, label: "Schedule" },
  { number: 3, label: "Subject & sender" },
  { number: 4, label: "Content" },
  { number: 5, label: "Review & confirm" },
] as const;

export interface AudienceSelection {
  audience_list_ids: string[];
  include_all_members: boolean;
  include_all_contacts: boolean;
}

export interface AudienceStats {
  recipients: number;
  unsubscribedRemoved: number;
  duplicatesMerged: number;
  missingEmail: number;
}

export interface AudienceOptions {
  memberCount: number;
  contactCount: number;
  lists: { id: string; name: string; count: number }[];
}

// Sender details shown in the wizard; values come from env on the server
// (EMAIL_FROM_ADDRESS etc.) and are passed down via the campaign API.
export interface SenderSettings {
  fromAddress: string;
  replyTo: string;
  mailingAddress: string;
}

export function hasAudience(selection: AudienceSelection): boolean {
  return selection.include_all_members || selection.include_all_contacts || selection.audience_list_ids.length > 0;
}

export function campaignStatusLabel(status: CampaignStatus): string {
  return {
    draft: "Draft",
    scheduled: "Scheduled",
    sending: "Sending",
    sent: "Sent",
    canceled: "Canceled",
    failed: "Failed",
  }[status];
}

// Everything still missing before a campaign can be scheduled — shown on
// the Review step and re-checked by the schedule API.
export function campaignProblems(campaign: EmailCampaign, now: Date = new Date()): string[] {
  const problems: string[] = [];
  if (!hasAudience(campaign)) problems.push("Choose an audience (Step 1).");
  if (!campaign.send_immediately) {
    if (!campaign.send_at) problems.push("Pick a send date and time (Step 2).");
    else if (new Date(campaign.send_at).getTime() <= now.getTime()) {
      problems.push("The send time is in the past — pick a later time (Step 2).");
    }
  }
  if (!campaign.from_name.trim()) problems.push("Add a sender name (Step 3).");
  if (!campaign.subject.trim()) problems.push("Add a subject line (Step 3).");
  if (!campaign.body_html.replace(/<[^>]+>/g, "").trim()) problems.push("Write the email content (Step 4).");
  return problems;
}
