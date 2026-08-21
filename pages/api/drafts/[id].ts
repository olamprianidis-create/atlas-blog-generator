import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing draft id" });
  }

  const supabase = getServiceClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("article_drafts")
        .select("id, title, category, current_step, state, updated_at")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Draft not found" });

      return res.status(200).json(data);
    } catch (error) {
      console.error("get draft failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load draft: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("article_drafts").delete().eq("id", id);
      if (error) throw error;
      return res.status(204).end();
    } catch (error) {
      console.error("delete draft failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to delete draft: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
