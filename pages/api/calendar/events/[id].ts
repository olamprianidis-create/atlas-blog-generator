import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { PLATFORMS } from "../../../../utils/types";

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
  res: NextApiResponse<CalendarEvent | Record<string, never> | { error: string }>
) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing event id" });
  }

  const supabase = getServiceClient();

  if (req.method === "PATCH") {
    const { platforms, description, thumbnailUrl } = req.body as {
      platforms?: unknown;
      description?: unknown;
      thumbnailUrl?: unknown;
    };

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
      const updateRow = {
        platforms: platformList,
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
      };

      const { data, error } = await supabase
        .from("content_calendar_events")
        .update(updateRow)
        .eq("id", id)
        .select("id, event_date, platforms, description, thumbnail_url, completed_platforms")
        .single();

      if (!error) return res.status(200).json(data as CalendarEvent);

      console.warn(
        "calendar event update-select with completed_platforms failed, retrying without it (run supabase/migrations/0012_calendar_event_completion.sql):",
        error.message
      );
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("content_calendar_events")
        .update(updateRow)
        .eq("id", id)
        .select("id, event_date, platforms, description, thumbnail_url")
        .single();
      if (fallbackError) throw fallbackError;
      return res.status(200).json({ ...fallbackData, completed_platforms: [] } as CalendarEvent);
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
