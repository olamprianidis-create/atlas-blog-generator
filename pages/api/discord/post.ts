import type { NextApiRequest, NextApiResponse } from "next";
import { postToDiscord } from "../../../utils/discord";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { channelId, message } = req.body as { channelId?: unknown; message?: unknown };
  if (typeof channelId !== "string" || !channelId.trim()) {
    return res.status(400).json({ error: "Missing channelId" });
  }
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    const messageId = await postToDiscord(channelId.trim(), message);
    return res.status(200).json({ messageId });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: errMessage });
  }
}
