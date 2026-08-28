import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../../utils/supabase";

// A "platform" here is either a real Platform value (instagram, linkedin,
// etc.) or the literal "general" for a platform-less event — each is its
// own independent checkbox on the calendar, toggled without touching the
// others on the same event.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing event id" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { platform, completed } = req.body as { platform?: unknown; completed?: unknown };
  if (typeof platform !== "string" || !platform) {
    return res.status(400).json({ error: "Missing platform" });
  }
  if (typeof completed !== "boolean") {
    return res.status(400).json({ error: "Missing completed" });
  }

  const supabase = getServiceClient();

  const { data: existing, error: fetchError } = await supabase
    .from("content_calendar_events")
    .select("completed_platforms")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return res.status(502).json({ error: fetchError.message });
  if (!existing) return res.status(404).json({ error: "Event not found" });

  const current: string[] = existing.completed_platforms ?? [];
  const next = completed ? Array.from(new Set([...current, platform])) : current.filter((p) => p !== platform);

  const { data, error } = await supabase
    .from("content_calendar_events")
    .update({ completed_platforms: next })
    .eq("id", id)
    .select("id, event_date, platforms, description, thumbnail_url, completed_platforms")
    .single();

  if (error) return res.status(502).json({ error: error.message });
  return res.status(200).json(data);
}
