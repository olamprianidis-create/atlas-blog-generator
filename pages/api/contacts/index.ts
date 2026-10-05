import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import {
  CONTACT_COLUMNS,
  CONTACT_WITH_LISTS_COLUMNS,
  Contact,
  compareContacts,
  isDuplicateEmailError,
  isMissingTableError,
  parseContactInput,
  parseListIds,
  toContact,
} from "../../../utils/contacts";
import { getContactWithLists, setContactLists } from "../../../utils/contactsDb";

const MISSING_TABLE_MESSAGE =
  "The contacts table doesn't exist yet — run `npm run migrate -- 0018_contacts.sql`.";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Contact[] | Contact | { error: string }>
) {
  const supabase = getServiceClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase.from("contacts").select(CONTACT_WITH_LISTS_COLUMNS);
      if (error) throw error;
      // Sorted here rather than in SQL so the last-name → first-name →
      // company fallback matches the client's section letters exactly.
      return res.status(200).json((data ?? []).map(toContact).sort(compareContacts));
    } catch (error) {
      console.error("list contacts failed:", error);
      if (isMissingTableError(error)) return res.status(503).json({ error: MISSING_TABLE_MESSAGE });
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to load contacts: ${message}` });
    }
  }

  if (req.method === "POST") {
    const parsed = parseContactInput(req.body);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    const listIds = parseListIds(req.body);

    try {
      const { data, error } = await supabase
        .from("contacts")
        .insert(parsed.input)
        .select(CONTACT_COLUMNS)
        .single();
      if (error) throw error;
      if (listIds?.length) await setContactLists(data.id as string, listIds);
      const saved = await getContactWithLists(data.id as string);
      return res.status(201).json(saved as Contact);
    } catch (error) {
      console.error("create contact failed:", error);
      if (isMissingTableError(error)) return res.status(503).json({ error: MISSING_TABLE_MESSAGE });
      if (isDuplicateEmailError(error)) {
        return res.status(409).json({ error: "A contact with that email already exists" });
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: `Failed to create contact: ${message}` });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
