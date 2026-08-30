import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { PLATFORMS } from "../../../../utils/types";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "../../../../utils/googleCalendar";
import { stripHtml } from "../../../../utils/richText";

const VALID_PLATFORMS = new Set(PLATFORMS.map((p) => p.value));

interface CalendarEvent {
  id: string;
  event_date: string;
  platforms: string[];
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  completed_platforms: string[];
  sync_to_google_calendar: boolean;
  google_event_id: string | null;
}

// title/completed_platforms (0012/0013) and sync_to_google_calendar/
// google_event_id (0014) are all optional columns added after the
// table's original shape — try the full select first and degrade a
// tier at a time if a migration hasn't been run yet, rather than
// failing the whole request over one missing column.
const SELECT_CANDIDATES = [
  "id, event_date, platforms, title, description, thumbnail_url, completed_platforms, sync_to_google_calendar, google_event_id",
  "id, event_date, platforms, title, description, thumbnail_url, completed_platforms",
  "id, event_date, platforms, description, thumbnail_url, completed_platforms",
  "id, event_date, platforms, description, thumbnail_url",
];

function fillDefaults(row: object): CalendarEvent {
  return {
    title: null,
    completed_platforms: [],
    sync_to_google_calendar: false,
    google_event_id: null,
    ...row,
  } as unknown as CalendarEvent;
}

function pickColumns(row: Record<string, unknown>, columns: string): Record<string, unknown> {
  const present = new Set(columns.split(",").map((c) => c.trim()));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (present.has(key)) out[key] = value;
  }
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CalendarEvent | Record<string, never> | { error: string }>
) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing event id" });
  }

  const supabase = getServiceClient();

  if (req.method === "PATCH") {
    const { platforms, title, description, thumbnailUrl, syncToGoogleCalendar } = req.body as {
      platforms?: unknown;
      title?: unknown;
      description?: unknown;
      thumbnailUrl?: unknown;
      syncToGoogleCalendar?: unknown;
    };

    const platformList = Array.isArray(platforms) ? platforms : [];
    if (!platformList.every((p) => typeof p === "string" && VALID_PLATFORMS.has(p as never))) {
      return res.status(400).json({ error: "Invalid platforms" });
    }
    if (title !== undefined && title !== null && typeof title !== "string") {
      return res.status(400).json({ error: "Invalid title" });
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({ error: "Invalid description" });
    }
    if (thumbnailUrl !== undefined && thumbnailUrl !== null && typeof thumbnailUrl !== "string") {
      return res.status(400).json({ error: "Invalid thumbnailUrl" });
    }

    try {
      const { data: existing } = await supabase
        .from("content_calendar_events")
        .select("google_event_id")
        .eq("id", id)
        .maybeSingle();
      const existingGoogleEventId: string | null = existing?.google_event_id ?? null;

      const updateRow: Record<string, unknown> = {
        platforms: platformList,
        title: title || null,
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
        sync_to_google_calendar: !!syncToGoogleCalendar,
      };

      let lastError: Error | null = null;
      let saved: CalendarEvent | null = null;
      for (const columns of SELECT_CANDIDATES) {
        const row = pickColumns(updateRow, columns);
        const { data, error } = await supabase
          .from("content_calendar_events")
          .update(row)
          .eq("id", id)
          .select(columns)
          .single();
        if (!error) {
          saved = fillDefaults(data);
          break;
        }
        lastError = error;
        console.warn(`calendar event update-select (${columns}) failed, trying a smaller column set:`, error.message);
      }
      if (!saved) throw lastError;

      // Best-effort: a Google Calendar hiccup shouldn't lose the note
      // itself, which is already saved at this point.
      try {
        const plainDescription = stripHtml(saved.description ?? "");
        if (syncToGoogleCalendar && existingGoogleEventId) {
          await updateGoogleCalendarEvent(existingGoogleEventId, saved.event_date, saved.title || "Note", plainDescription);
          saved.google_event_id = existingGoogleEventId;
        } else if (syncToGoogleCalendar && !existingGoogleEventId) {
          const googleEventId = await createGoogleCalendarEvent(saved.event_date, saved.title || "Note", plainDescription);
          await supabase.from("content_calendar_events").update({ google_event_id: googleEventId }).eq("id", id);
          saved.google_event_id = googleEventId;
        } else if (!syncToGoogleCalendar && existingGoogleEventId) {
          await deleteGoogleCalendarEvent(existingGoogleEventId);
          await supabase.from("content_calendar_events").update({ google_event_id: null }).eq("id", id);
          saved.google_event_id = null;
        }
      } catch (syncError) {
        console.error("google calendar sync (update) failed:", syncError);
      }

      return res.status(200).json(saved);
    } catch (error) {
      console.error("update calendar event failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to update event: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { data: existing } = await supabase
        .from("content_calendar_events")
        .select("google_event_id")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase.from("content_calendar_events").delete().eq("id", id);
      if (error) throw error;

      if (existing?.google_event_id) {
        try {
          await deleteGoogleCalendarEvent(existing.google_event_id);
        } catch (syncError) {
          console.error("google calendar sync (delete) failed:", syncError);
        }
      }

      return res.status(200).json({});
    } catch (error) {
      console.error("delete calendar event failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to delete event: ${message}` });
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
