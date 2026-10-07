import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { ContactList, isDuplicateEmailError } from "../../../utils/contacts";
import { errorMessage } from "../../../utils/errorMessage";

// Rename or delete a list. Deleting a list only removes the list and its
// memberships (cascade) — the contacts themselves are untouched.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContactList | { error: string }>
) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing list id" });

  const supabase = getServiceClient();

  if (req.method === "PATCH") {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "A list needs a name" });
    try {
      const { data, error } = await supabase
        .from("contact_lists")
        .update({ name })
        .eq("id", id)
        .select("id, name, created_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "List not found" });
      return res.status(200).json(data as ContactList);
    } catch (error) {
      console.error("rename contact list failed:", error);
      if (isDuplicateEmailError(error)) return res.status(409).json({ error: "A list with that name already exists" });
      const message = errorMessage(error);
      return res.status(502).json({ error: `Failed to rename list: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("contact_lists").delete().eq("id", id);
      if (error) throw error;
      return res.status(204).end();
    } catch (error) {
      console.error("delete contact list failed:", error);
      const message = errorMessage(error);
      return res.status(502).json({ error: `Failed to delete list: ${message}` });
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
