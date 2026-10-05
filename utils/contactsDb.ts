// Server-only Contacts/list queries shared by the API routes. Uses the
// service-role client — every Contacts/email table has RLS on with no
// policies, so the anon key can't reach them at all.
import { getServiceClient } from "./supabase";
import { CONTACT_WITH_LISTS_COLUMNS, Contact, toContact } from "./contacts";

// Sets a contact's list memberships to exactly `listIds`.
export async function setContactLists(contactId: string, listIds: string[]): Promise<void> {
  const supabase = getServiceClient();
  const { error: deleteError } = await supabase.from("contact_list_members").delete().eq("contact_id", contactId);
  if (deleteError) throw deleteError;
  if (listIds.length === 0) return;
  const { error } = await supabase
    .from("contact_list_members")
    .insert(listIds.map((listId) => ({ list_id: listId, contact_id: contactId })));
  if (error) throw error;
}

export async function getContactWithLists(contactId: string): Promise<Contact | null> {
  const { data, error } = await getServiceClient()
    .from("contacts")
    .select(CONTACT_WITH_LISTS_COLUMNS)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw error;
  return data ? toContact(data) : null;
}
