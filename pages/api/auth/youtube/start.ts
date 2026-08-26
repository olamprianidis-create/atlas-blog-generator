import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getYoutubeAuthUrl } from "../../../../utils/youtube";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const state = randomBytes(16).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `youtube_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );
    res.redirect(302, getYoutubeAuthUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send(message);
  }
}
