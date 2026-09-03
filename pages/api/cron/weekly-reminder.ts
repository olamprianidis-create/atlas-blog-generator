import type { NextApiRequest, NextApiResponse } from "next";
import { postToDiscord } from "../../../utils/discord";
import { getWeeklyMeeting } from "../../../utils/websiteDb";

// Same channel every time — the "main" channel under the Q3 (Jul-Sep
// 2026) category, chosen 2026-09-03. Update here if the category/channel
// ever changes; not stored in discord_channels since it's a fixed
// reminder target, not one of the user-manageable channels on /discord.
const REMINDER_CHANNEL_ID = "1534723311899250778";

// Piggybacks on the same every-10-minutes GitHub Actions ping used for
// scheduled publishing (.github/workflows/publish-cron.yml) rather than a
// second workflow with fixed UTC cron times — this checks the *actual*
// current Pacific time on every run, so it's automatically correct across
// the twice-a-year daylight-saving shift with no manual adjustment, unlike
// a fixed "30 0 * * 2" UTC schedule would be.
//
// Each message only has one 10-minute-wide window per Monday it can fire
// in, and the ping cadence matches that window width exactly, so exactly
// one run lands inside it — no separate "already sent today" flag needed.
function isAuthorized(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function currentPacificTime(): { weekday: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const weekday = parts.find((p) => p.type === "weekday")!.value;
  // hour12: false can still yield "24" for midnight in some environments —
  // normalize to 0-23.
  const hour = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return { weekday, hour, minute };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { weekday, hour, minute } = currentPacificTime();

  if (weekday !== "Monday") {
    return res.status(200).json({ sent: false, reason: "not Monday" });
  }

  const isStartingSoonWindow = hour === 17 && minute >= 25 && minute < 35; // 5:25-5:34 PM PT
  const isLiveWindow = hour === 18 && minute < 10; // 6:00-6:09 PM PT

  if (!isStartingSoonWindow && !isLiveWindow) {
    return res.status(200).json({ sent: false, reason: "outside reminder windows", hour, minute });
  }

  try {
    let content: string;
    if (isStartingSoonWindow) {
      const meeting = await getWeeklyMeeting();
      content = `⏰ Weekly call starts in 30 minutes — see you there! ${meeting?.zoomUrl ?? ""}`.trim();
    } else {
      content = `🔴 We're live! Hop on the call now.`;
    }

    const messageId = await postToDiscord(REMINDER_CHANNEL_ID, content);
    return res.status(200).json({ sent: true, messageId });
  } catch (error) {
    console.error("[cron/weekly-reminder] failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
}
