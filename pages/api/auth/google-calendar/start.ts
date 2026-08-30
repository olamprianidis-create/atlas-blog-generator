import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getGoogleCalendarAuthUrl } from "../../../../utils/googleCalendar";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const state = randomBytes(16).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `gcal_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );
    res.redirect(302, getGoogleCalendarAuthUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send(message);
  }
}
