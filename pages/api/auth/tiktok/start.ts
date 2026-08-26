import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getTiktokAuthUrl } from "../../../../utils/tiktok";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const state = randomBytes(16).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `tiktok_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );
    res.redirect(302, getTiktokAuthUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send(message);
  }
}
