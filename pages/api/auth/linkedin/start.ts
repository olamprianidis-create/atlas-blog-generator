import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getLinkedinAuthUrl } from "../../../../utils/linkedin";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const state = randomBytes(16).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `linkedin_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );
    res.redirect(302, getLinkedinAuthUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send(message);
  }
}
