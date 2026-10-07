import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../../utils/supabase";
import {
  CAMPAIGN_COLUMNS,
  CampaignEdits,
  DEFAULT_BODY_STYLE,
  DEFAULT_HEADER_STYLE,
  EDITABLE_CAMPAIGN_FIELDS,
  EmailCampaign,
  SenderSettings,
  withSectionDefaults,
} from "../../../../../utils/emailCampaigns";
import { getSenderSettings } from "../../../../../utils/emailSettings";
import { TIMEZONE_OPTIONS, buildPublishDate } from "../../../../../utils/timezones";

type Response = { campaign: EmailCampaign; sender: SenderSettings } | EmailCampaign | { error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

// Keeps only known, correctly-typed fields from a PATCH body.
function pickEdits(body: Record<string, unknown>): CampaignEdits | { error: string } {
  const edits: Record<string, unknown> = {};
  for (const field of EDITABLE_CAMPAIGN_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];
    switch (field) {
      case "current_step":
        if (typeof value !== "number" || value < 1 || value > 5) return { error: "Invalid step" };
        break;
      case "audience_list_ids":
      case "audience_contact_ids":
        if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return { error: `Invalid ${field}` };
        break;
      case "include_all_members":
      case "include_all_contacts":
      case "send_immediately":
        if (typeof value !== "boolean") return { error: `Invalid ${field}` };
        break;
      case "send_date":
        if (value !== null && (typeof value !== "string" || !DATE_PATTERN.test(value))) return { error: "Invalid date" };
        break;
      case "send_time":
        if (value !== null && (typeof value !== "string" || !TIME_PATTERN.test(value))) return { error: "Invalid time" };
        break;
      case "timezone":
        if (!TIMEZONE_OPTIONS.some((t) => t.value === value)) return { error: "Invalid time zone" };
        break;
      case "header_style":
      case "body_style":
        // Normalized rather than rejected: unknown fonts/sizes fall back.
        edits[field] = withSectionDefaults(value, field === "header_style" ? DEFAULT_HEADER_STYLE : DEFAULT_BODY_STYLE);
        continue;
      default:
        if (typeof value !== "string") return { error: `Invalid ${field}` };
    }
    edits[field] = value;
  }
  return edits as CampaignEdits;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing campaign id" });

  const supabase = getServiceClient();

  async function load(): Promise<EmailCampaign | null> {
    const { data, error } = await supabase.from("email_campaigns").select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data as EmailCampaign | null;
  }

  try {
    if (req.method === "GET") {
      const campaign = await load();
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      return res.status(200).json({ campaign, sender: getSenderSettings() });
    }

    if (req.method === "PATCH") {
      const existing = await load();
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      if (existing.status !== "draft") {
        return res.status(409).json({ error: "Only drafts can be edited — unschedule this campaign first." });
      }

      const edits = pickEdits((req.body ?? {}) as Record<string, unknown>);
      if ("error" in edits) return res.status(400).json({ error: edits.error as string });

      // Keep send_at (the real instant) in sync with what was typed.
      const merged = { ...existing, ...edits };
      const sendAt =
        merged.send_date && merged.send_time
          ? buildPublishDate(merged.send_date, merged.send_time, merged.timezone).toISOString()
          : null;

      const { data, error } = await supabase
        .from("email_campaigns")
        .update({ ...edits, send_at: sendAt, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "draft")
        .select(CAMPAIGN_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ error: "This campaign was scheduled elsewhere — reload the page." });
      return res.status(200).json(data as EmailCampaign);
    }

    if (req.method === "DELETE") {
      const existing = await load();
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      if (existing.status !== "draft" && existing.status !== "canceled") {
        return res.status(409).json({ error: "Only drafts can be deleted." });
      }
      const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(`campaign ${req.method} failed:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Campaign request failed: ${message}` });
  }
}
