import type { NextApiRequest, NextApiResponse } from "next";
import { moveGoogleCalendarEvent } from "../../../utils/googleCalendar";
import { errorMessage } from "../../../utils/errorMessage";

// Content Calendar drag-and-drop for events that live in Google Calendar:
// moves the real event there (keeps its time of day and length).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { eventId, dateStr } = req.body as { eventId?: unknown; dateStr?: unknown };
  if (typeof eventId !== "string" || !eventId) return res.status(400).json({ error: "Missing eventId" });
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: "Invalid dateStr" });
  }
  try {
    await moveGoogleCalendarEvent(eventId, dateStr);
    return res.status(200).json({});
  } catch (error) {
    console.error("move google calendar event failed:", error);
    return res.status(502).json({ error: `Couldn't move the Google Calendar event: ${errorMessage(error)}` });
  }
}
