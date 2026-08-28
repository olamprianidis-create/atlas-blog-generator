import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { PLATFORMS } from "../../../utils/types";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PLATFORMS = new Set(PLATFORMS.map((p) => p.value));

interface CalendarEvent {
  id: string;
  event_date: string;
  platforms: string[];
  description: string | null;
  thumbnail_url: string | null;
  completed_platforms: string[];
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

    const full = baseQuery("id, event_date, platforms, description, thumbnail_url, completed_platforms");
    if (!full) return res.status(400).json({ error: "Missing or invalid year/month" });

    try {
      const { data, error } = await full.order("event_date", { ascending: true });
      if (!error) return res.status(200).json((data ?? []) as unknown as CalendarEvent[]);

      // completed_platforms is an optional column (0012_calendar_event_
      // completion.sql) — degrade gracefully to the event list without
      // checkbox state if that migration hasn't been run yet, rather than
      // failing the whole calendar over one missing column.
      console.warn(
        "calendar events select with completed_platforms failed, retrying without it (run supabase/migrations/0012_calendar_event_completion.sql):",
        error.message
      );
      const fallback = baseQuery("id, event_date, platforms, description, thumbnail_url");
      const { data: fallbackData, error: fallbackError } = await fallback!.order("event_date", { ascending: true });
      if (fallbackError) throw fallbackError;

      const items = (fallbackData ?? []).map((row) => ({ ...(row as object), completed_platforms: [] }));
      return res.status(200).json(items as unknown as CalendarEvent[]);
    } catch (error) {
      console.error("list calendar events failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load calendar events: ${message}` });
    }
  }

  if (req.method === "POST") {
    const { eventDate, platforms, description, thumbnailUrl } = req.body as {
      eventDate?: unknown;
      platforms?: unknown;
      description?: unknown;
      thumbnailUrl?: unknown;
    };

    if (typeof eventDate !== "string" || !DAY_PATTERN.test(eventDate)) {
      return res.status(400).json({ error: "Invalid eventDate" });
    }
    const platformList = Array.isArray(platforms) ? platforms : [];
    if (!platformList.every((p) => typeof p === "string" && VALID_PLATFORMS.has(p as never))) {
      return res.status(400).json({ error: "Invalid platforms" });
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({ error: "Invalid description" });
    }
    if (thumbnailUrl !== undefined && thumbnailUrl !== null && typeof thumbnailUrl !== "string") {
      return res.status(400).json({ error: "Invalid thumbnailUrl" });
    }

    try {
      const insertRow = {
        event_date: eventDate,
        platforms: platformList,
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
      };

      const { data, error } = await supabase
        .from("content_calendar_events")
        .insert(insertRow)
        .select("id, event_date, platforms, description, thumbnail_url, completed_platforms")
        .single();

      if (!error) return res.status(200).json(data as CalendarEvent);

      console.warn(
        "calendar event insert-select with completed_platforms failed, retrying without it (run supabase/migrations/0012_calendar_event_completion.sql):",
        error.message
      );
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("content_calendar_events")
        .insert(insertRow)
        .select("id, event_date, platforms, description, thumbnail_url")
        .single();
      if (fallbackError) throw fallbackError;
      return res.status(200).json({ ...fallbackData, completed_platforms: [] } as CalendarEvent);
    } catch (error) {
      console.error("create calendar event failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to create calendar event: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
