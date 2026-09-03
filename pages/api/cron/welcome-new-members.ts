import type { NextApiRequest, NextApiResponse } from "next";
import { postToDiscord, listGuildMembers, listWelcomedMemberIds, markMemberWelcomed } from "../../../utils/discord";

// Posts a welcome message into #welcome for every new (non-bot) member
// of the ATLAS Network Discord — polled every ~10 minutes by the same
// GitHub Actions ping used for scheduled publishing and the weekly call
// reminders (Vercel Hobby cron is too imprecise for time-sensitive
// posts; see .github/workflows/publish-cron.yml). A member is only ever
// welcomed once, tracked via discord_welcomed_members — see
// utils/discord.ts's listWelcomedMemberIds/markMemberWelcomed.
const WELCOME_CHANNEL_ID = "1534722286131613847"; // #welcome
const PRINCIPLES_CHANNEL_ID = "1534722238706618570"; // #principles
const INTRODUCE_CHANNEL_ID = "1534722373973049585"; // #introduce-yourself

function isAuthorized(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [members, welcomedIds] = await Promise.all([listGuildMembers(), listWelcomedMemberIds()]);

    const newMembers = members.filter((m) => !m.isBot && !welcomedIds.has(m.discordUserId));

    const welcomed: string[] = [];
    for (const member of newMembers) {
      try {
        const content =
          `Welcome, <@${member.discordUserId}>, to ATLAS Network. ` +
          `Explore our <#${PRINCIPLES_CHANNEL_ID}>, and let everyone know who you are by responding in <#${INTRODUCE_CHANNEL_ID}>.`;
        await postToDiscord(WELCOME_CHANNEL_ID, content);
        await markMemberWelcomed(member.discordUserId);
        welcomed.push(member.discordUserId);
      } catch (err) {
        console.error(`[cron/welcome-new-members] failed for ${member.discordUserId}:`, err);
      }
    }

    return res.status(200).json({ checked: members.length, welcomed: welcomed.length });
  } catch (error) {
    console.error("[cron/welcome-new-members] failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
}
