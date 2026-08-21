import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";

interface DraftListItem {
  id: string;
  title: string;
  category: string | null;
  current_step: number;
  updated_at: string;
}

interface SaveDraftRequestBody {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  currentStep?: unknown;
  state?: unknown;
}

interface SaveDraftResponse {
  id: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DraftListItem[] | SaveDraftResponse | { error: string }>
) {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("article_drafts")
        .select("id, title, category, current_step, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return res.status(200).json((data ?? []) as DraftListItem[]);
    } catch (error) {
      console.error("list drafts failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load drafts: ${message}` });
    }
  }

  if (req.method === "POST") {
    const { id, title, category, currentStep, state } = req.body as SaveDraftRequestBody;

    if (typeof state !== "object" || state === null) {
      return res.status(400).json({ error: "Missing draft state" });
    }
    if (typeof currentStep !== "number") {
      return res.status(400).json({ error: "Missing current step" });
    }

    try {
      const row = {
        title: typeof title === "string" && title.trim() ? title.trim() : "Untitled draft",
        category: typeof category === "string" ? category : null,
        current_step: currentStep,
        state,
        updated_at: new Date().toISOString(),
      };

      if (typeof id === "string" && id) {
        const { data, error } = await supabase
          .from("article_drafts")
          .update(row)
          .eq("id", id)
          .select("id")
          .single();

        if (error) throw error;
        return res.status(200).json({ id: data.id as string });
      }

      const { data, error } = await supabase
        .from("article_drafts")
        .insert(row)
        .select("id")
        .single();

      if (error) throw error;
      return res.status(200).json({ id: data.id as string });
    } catch (error) {
      console.error("save draft failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to save draft: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
