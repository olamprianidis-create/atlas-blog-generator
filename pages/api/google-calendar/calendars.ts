import type { NextApiRequest, NextApiResponse } from "next";
import {
  getGoogleCalendarConnection,
  listGoogleCalendars,
  setSelectedGoogleCalendar,
} from "../../../utils/googleCalendar";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const connection = await getGoogleCalendarConnection();
      if (!connection.connected) return res.status(200).json({ connected: false, calendars: [], selectedCalendarId: null });

      const calendars = await listGoogleCalendars();
      return res.status(200).json({ connected: true, calendars, selectedCalendarId: connection.selectedCalendarId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load calendars: ${message}` });
    }
  }

  if (req.method === "POST") {
    const { calendarId } = req.body as { calendarId?: unknown };
    if (typeof calendarId !== "string" || !calendarId) {
      return res.status(400).json({ error: "Missing calendarId" });
    }
    try {
      await setSelectedGoogleCalendar(calendarId);
      return res.status(200).json({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to select calendar: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
