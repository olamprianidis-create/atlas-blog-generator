import type { NextApiRequest, NextApiResponse } from "next";
import { isYoutubeConnected } from "../../utils/youtube";
import { isTiktokConnected } from "../../utils/tiktok";
import { isLinkedinConnected } from "../../utils/linkedin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [youtube, tiktok, linkedin] = await Promise.all([
    isYoutubeConnected(),
    isTiktokConnected(),
    isLinkedinConnected(),
  ]);
  return res.status(200).json({ youtube, tiktok, linkedin });
}
