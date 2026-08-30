import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { PLATFORMS } from "../../../utils/types";
import { createGoogleCalendarEvent } from "../../../utils/googleCalendar";
import { stripHtml } from "../../../utils/richText";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

// Only sends the fields whose column is actually present in `columns` —
// lets one insert/update row object work across every fallback tier
// above without hand-writing a stripped copy for each.
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
  res: NextApiResponse<CalendarEvent[] | CalendarEvent | { error: string }>
) {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    const { year, month, date } = req.query;

    function baseQuery(columns: string) {
      let query = supabase.from("content_calendar_events").select(columns);
      if (typeof date === "string" && DAY_PATTERN.test(date)) {
        return query.eq("event_date", date);
      }
      const y = Number(year);
      const m = Number(month);
      if (!y || !m || m < 1 || m > 12) return null;
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      return query.gte("event_date", start).lt("event_date", end);
    }

    try {
      let lastError: Error | null = null;
      for (const columns of SELECT_CANDIDATES) {
        const query = baseQuery(columns);
        if (!query) return res.status(400).json({ error: "Missing or invalid year/month" });
        const { data, error } = await query.order("event_date", { ascending: true });
        if (!error) return res.status(200).json((data ?? []).map(fillDefaults));
        lastError = error;
        console.warn(`calendar events select (${columns}) failed, trying a smaller column set:`, error.message);
      }
      throw lastError;
    } catch (error) {
      console.error("list calendar events failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load calendar events: ${message}` });
    }
  }

  if (req.method === "POST") {
    const { eventDate, platforms, title, description, thumbnailUrl, syncToGoogleCalendar } = req.body as {
      eventDate?: unknown;
      platforms?: unknown;
      title?: unknown;
      description?: unknown;
      thumbnailUrl?: unknown;
      syncToGoogleCalendar?: unknown;
    };

    if (typeof eventDate !== "string" || !DAY_PATTERN.test(eventDate)) {
      return res.status(400).json({ error: "Invalid eventDate" });
    }
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

    const insertRow: Record<string, unknown> = {
      event_date: eventDate,
      platforms: platformList,
      title: title || null,
      description: description || null,
      thumbnail_url: thumbnailUrl || null,
      sync_to_google_calendar: !!syncToGoogleCalendar,
      google_event_id: null,
    };

    try {
      let lastError: Error | null = null;
      let saved: CalendarEvent | null = null;
      for (const columns of SELECT_CANDIDATES) {
        const row = pickColumns(insertRow, columns);
        const { data, error } = await supabase.from("content_calendar_events").insert(row).select(columns).single();
        if (!error) {
          saved = fillDefaults(data);
          break;
        }
        lastError = error;
        console.warn(`calendar event insert-select (${columns}) failed, trying a smaller column set:`, error.message);
      }
      if (!saved) throw lastError;

      // Best-effort: a Google Calendar hiccup shouldn't lose the note
      // itself, which is already saved at this point.
      if (syncToGoogleCalendar) {
        try {
          const googleEventId = await createGoogleCalendarEvent(
            saved.event_date,
            saved.title || "Note",
            stripHtml(saved.description ?? "")
          );
          await supabase
            .from("content_calendar_events")
            .update({ google_event_id: googleEventId })
            .eq("id", saved.id);
          saved.google_event_id = googleEventId;
        } catch (syncError) {
          console.error("google calendar sync (create) failed:", syncError);
        }
      }

      return res.status(200).json(saved);
    } catch (error) {
      console.error("create calendar event failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to create calendar event: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
