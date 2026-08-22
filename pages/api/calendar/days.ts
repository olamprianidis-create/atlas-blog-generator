import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    const { year, month } = req.query;
    const y = Number(year);
    const m = Number(month);
    if (!y || !m || m < 1 || m > 12) {
      return res.status(400).json({ error: "Missing or invalid year/month" });
    }

    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(y, m, 1));
    const end = endDate.toISOString().slice(0, 10);

    try {
      const { data, error } = await supabase
        .from("content_calendar_days")
        .select("day")
        .gte("day", start)
        .lt("day", end);

      if (error) throw error;
      return res.status(200).json((data ?? []).map((row) => row.day as string));
    } catch (error) {
      console.error("list calendar days failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load calendar days: ${message}` });
    }
  }

  if (req.method === "POST") {
    const { day, checked } = req.body as { day?: unknown; checked?: unknown };

    if (typeof day !== "string" || !DAY_PATTERN.test(day)) {
      return res.status(400).json({ error: "Invalid day" });
    }
    if (typeof checked !== "boolean") {
      return res.status(400).json({ error: "Invalid checked value" });
    }

    try {
      if (checked) {
        const { error } = await supabase.from("content_calendar_days").upsert({ day });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_calendar_days").delete().eq("day", day);
        if (error) throw error;
      }
      return res.status(200).json({ day, checked });
    } catch (error) {
      console.error("set calendar day failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to update calendar day: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
