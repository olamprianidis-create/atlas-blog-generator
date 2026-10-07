import type { NextApiRequest, NextApiResponse } from "next";
import { getServiceClient } from "../../../../utils/supabase";
import { ContactActivityItem, getContactActivity } from "../../../../utils/emailAnalytics";

// The Contacts page's "Email activity" panel.
export default async function handler(req: NextApiRequest, res: NextApiResponse<ContactActivityItem[] | { error: string }>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Missing contact id" });
  try {
    const { data: contact, error } = await getServiceClient().from("contacts").select("id, email").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    return res.status(200).json(await getContactActivity(contact.id as string, contact.email as string | null));
  } catch (error) {
    console.error("contact activity failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: `Failed to load activity: ${message}` });
  }
}
