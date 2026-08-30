import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { PLATFORMS } from "../../../../utils/types";

const VALID_PLATFORMS = new Set(PLATFORMS.map((p) => p.value));

interface CalendarEvent {
  id: string;
  event_date: string;
  platforms: string[];
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  completed_platforms: string[];
}

// title (0013) and completed_platforms (0012) are both optional columns
// added after the table's original shape — try the full select first and
// degrade a column at a time if a migration hasn't been run yet, rather
// than failing the whole request over one missing column.
const SELECT_CANDIDATES = [
  "id, event_date, platforms, title, description, thumbnail_url, completed_platforms",
  "id, event_date, platforms, description, thumbnail_url, completed_platforms",
  "id, event_date, platforms, description, thumbnail_url",
];

function fillDefaults(row: object): CalendarEvent {
  return { title: null, completed_platforms: [], ...row } as unknown as CalendarEvent;
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
    const { platforms, title, description, thumbnailUrl } = req.body as {
      platforms?: unknown;
      title?: unknown;
      description?: unknown;
      thumbnailUrl?: unknown;
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

    const updateRow = {
      platforms: platformList,
      title: title || null,
      description: description || null,
      thumbnail_url: thumbnailUrl || null,
    };

    try {
      let lastError: Error | null = null;
      for (const columns of SELECT_CANDIDATES) {
        const row: Record<string, unknown> = columns.includes("title") ? updateRow : { ...updateRow, title: undefined };
        const { data, error } = await supabase
          .from("content_calendar_events")
          .update(row)
          .eq("id", id)
          .select(columns)
          .single();
        if (!error) return res.status(200).json(fillDefaults(data));
        lastError = error;
        console.warn(`calendar event update-select (${columns}) failed, trying a smaller column set:`, error.message);
      }
      throw lastError;
    } catch (error) {
      console.error("update calendar event failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to update event: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("content_calendar_events").delete().eq("id", id);
      if (error) throw error;
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
