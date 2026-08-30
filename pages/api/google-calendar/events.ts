import type { NextApiRequest, NextApiResponse } from "next";
import { getGoogleCalendarConnection, listGoogleCalendarEvents } from "../../../utils/googleCalendar";
import { getServiceClient } from "../../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const y = Number(req.query.year);
  const m = Number(req.query.month);
  if (!y || !m || m < 1 || m > 12) {
    return res.status(400).json({ error: "Missing or invalid year/month" });
  }

  try {
    const { connected, selectedCalendarId } = await getGoogleCalendarConnection();
    if (!connected || !selectedCalendarId) {
      return res.status(200).json({ connected, selectedCalendarId, events: [] });
    }

    // Events we ourselves pushed to Google (synced notes) already show as
    // that note's own chip — exclude them here so they don't render twice.
    const supabase = getServiceClient();
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const { data: syncedRows } = await supabase
      .from("content_calendar_events")
      .select("google_event_id")
      .gte("event_date", start)
      .lt("event_date", end)
      .not("google_event_id", "is", null);
    const excludeIds = new Set((syncedRows ?? []).map((r) => r.google_event_id as string));

    const events = await listGoogleCalendarEvents(y, m, excludeIds);
    return res.status(200).json({ connected: true, selectedCalendarId, events });
  } catch (error) {
    console.error("list google calendar events failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load Google Calendar events: ${message}` });
  }
}
