import type { NextApiRequest, NextApiResponse } from "next";
import { deleteDiscordChannel, setDefaultDiscordChannel } from "../../../../utils/discord";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing channel id" });
  }

  if (req.method === "PATCH") {
    try {
      await setDefaultDiscordChannel(id);
      return res.status(200).json({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to set default channel: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      await deleteDiscordChannel(id);
      return res.status(200).json({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to delete channel: ${message}` });
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
