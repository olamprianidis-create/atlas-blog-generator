import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../utils/supabase";
import { ContactInput, parseContactInput } from "../../../utils/contacts";
import { errorMessage } from "../../../utils/errorMessage";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export interface ImportResult {
  created: number;
  alreadyExisted: number;
  invalid: number;
  addedToList: number;
}

const MAX_ROWS = 5000;
const CHUNK = 500;

// Bulk-creates contacts from rows the browser already parsed out of a CSV
// (see pages/contacts.tsx). Rows whose email already belongs to a contact
// are never overwritten — they're counted as "already existed" (and still
// added to the chosen list, if any).
export default async function handler(req: NextApiRequest, res: NextApiResponse<ImportResult | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rows: unknown[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const listId = typeof req.body?.list_id === "string" && req.body.list_id ? (req.body.list_id as string) : null;
  if (rows.length === 0) return res.status(400).json({ error: "No rows to import" });
  if (rows.length > MAX_ROWS) return res.status(400).json({ error: `Import at most ${MAX_ROWS} rows at a time` });

  const supabase = getServiceClient();

  try {
    const { data: existing, error: existingError } = await supabase.from("contacts").select("id, email");
    if (existingError) throw existingError;
    const idByEmail = new Map(
      (existing ?? []).filter((c) => c.email).map((c) => [(c.email as string).toLowerCase(), c.id as string])
    );

    let invalid = 0;
    let alreadyExisted = 0;
    const toInsert: ContactInput[] = [];
    const existingIdsForList: string[] = [];
    const seenInFile = new Set<string>();

    for (const row of rows) {
      const parsed = parseContactInput(row);
      if ("error" in parsed) {
        invalid++;
        continue;
      }
      const email = parsed.input.email;
      if (email) {
        if (seenInFile.has(email)) {
          alreadyExisted++;
          continue;
        }
        seenInFile.add(email);
        const existingId = idByEmail.get(email);
        if (existingId) {
          alreadyExisted++;
          existingIdsForList.push(existingId);
          continue;
        }
      }
      toInsert.push(parsed.input);
    }

    const createdIds: string[] = [];
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { data, error } = await supabase.from("contacts").insert(toInsert.slice(i, i + CHUNK)).select("id");
      if (error) throw error;
      createdIds.push(...(data ?? []).map((r) => r.id as string));
    }

    let addedToList = 0;
    if (listId) {
      const memberRows = [...createdIds, ...existingIdsForList].map((contactId) => ({
        list_id: listId,
        contact_id: contactId,
      }));
      for (let i = 0; i < memberRows.length; i += CHUNK) {
        const { error } = await supabase
          .from("contact_list_members")
          .upsert(memberRows.slice(i, i + CHUNK), { onConflict: "list_id,contact_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      addedToList = memberRows.length;
    }

    return res.status(200).json({ created: createdIds.length, alreadyExisted, invalid, addedToList });
  } catch (error) {
    console.error("import contacts failed:", error);
    const message = errorMessage(error);
    return res.status(502).json({ error: `Import failed: ${message}` });
  }
}
