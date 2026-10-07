import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { ContactList, isDuplicateEmailError } from "../../../utils/contacts";
import { errorMessage } from "../../../utils/errorMessage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContactList[] | ContactList | { error: string }>
) {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase.from("contact_lists").select("id, name, created_at").order("name");
      if (error) throw error;
      return res.status(200).json((data ?? []) as ContactList[]);
    } catch (error) {
      console.error("list contact lists failed:", error);
      const message = errorMessage(error);
      return res.status(502).json({ error: `Failed to load lists: ${message}` });
    }
  }

  if (req.method === "POST") {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "A list needs a name" });

    try {
      const { data, error } = await supabase
        .from("contact_lists")
        .insert({ name })
        .select("id, name, created_at")
        .single();
      if (error) throw error;
      return res.status(201).json(data as ContactList);
    } catch (error) {
      console.error("create contact list failed:", error);
      // Same unique-violation code as a duplicate contact email.
      if (isDuplicateEmailError(error)) return res.status(409).json({ error: "A list with that name already exists" });
      const message = errorMessage(error);
      return res.status(502).json({ error: `Failed to create list: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
