import type { NextApiRequest, NextApiResponse } from "next";
import { addDiscordChannel, isDiscordConfigured, listDiscordChannels } from "../../../utils/discord";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const channels = await listDiscordChannels();
      return res.status(200).json({ configured: isDiscordConfigured(), channels });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load Discord channels: ${message}` });
    }
  }

  if (req.method === "POST") {
    const { label, channelId, isDefault } = req.body as { label?: unknown; channelId?: unknown; isDefault?: unknown };
    if (typeof label !== "string" || !label.trim()) {
      return res.status(400).json({ error: "Missing label" });
    }
    if (typeof channelId !== "string" || !channelId.trim()) {
      return res.status(400).json({ error: "Missing channelId" });
    }
    try {
      const channel = await addDiscordChannel(label.trim(), channelId.trim(), !!isDefault);
      return res.status(200).json({ channel });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to save Discord channel: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
