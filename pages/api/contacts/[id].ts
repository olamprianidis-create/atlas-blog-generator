import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { CONTACT_COLUMNS, Contact, isDuplicateEmailError, parseContactInput } from "../../../utils/contacts";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Contact | { error: string }>
) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Missing contact id" });
  }

  const supabase = getServiceClient();

  if (req.method === "PATCH") {
    const parsed = parseContactInput(req.body);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });

    try {
      const { data, error } = await supabase
        .from("contacts")
        .update({ ...parsed.input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(CONTACT_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Contact not found" });
      return res.status(200).json(data as Contact);
    } catch (error) {
      console.error("update contact failed:", error);
      if (isDuplicateEmailError(error)) {
        return res.status(409).json({ error: "A contact with that email already exists" });
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to update contact: ${message}` });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
      return res.status(204).end();
    } catch (error) {
      console.error("delete contact failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to delete contact: ${message}` });
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
