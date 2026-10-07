// Server-only: copies new ATLAS Website members into Contacts and the
// "ATLAS Network" contact list. Runs from the every-~10-min cron
// (pages/api/cron/publish-scheduled.ts) and right before a campaign
// freezes its recipients (utils/emailSend.ts), so a send never misses
// someone who just signed up.
//
// Each member is handled once (member_contact_syncs): taking someone off
// the list by hand sticks. If their email is already a contact (e.g. from
// a CSV import), that contact is added to the list instead of duplicated,
// and its fields are left alone.
import { getServiceClient } from "./supabase";
import { listMembersForContactSync } from "./websiteDb";

export const MEMBERS_LIST_NAME = "ATLAS Network";

export interface MemberSyncResult {
  added: string[]; // emails added to the list this run
}

export async function syncNewMembersToContacts(): Promise<MemberSyncResult> {
  const supabase = getServiceClient();

  const { data: list, error: listError } = await supabase
    .from("contact_lists")
    .select("id")
    .ilike("name", MEMBERS_LIST_NAME)
    .maybeSingle();
  if (listError) throw listError;
  if (!list) {
    console.warn(`[memberSync] No "${MEMBERS_LIST_NAME}" contact list — skipping.`);
    return { added: [] };
  }

  const [members, syncedResult] = await Promise.all([
    listMembersForContactSync(),
    supabase.from("member_contact_syncs").select("website_user_id"),
  ]);
  if (syncedResult.error) throw syncedResult.error;
  const synced = new Set((syncedResult.data ?? []).map((r) => r.website_user_id as string));
  const pending = members.filter((m) => !synced.has(m.id));
  if (pending.length === 0) return { added: [] };

  const { data: existing, error: existingError } = await supabase
    .from("contacts")
    .select("id, email")
    .in(
      "email",
      pending.map((m) => m.email)
    );
  if (existingError) throw existingError;
  const contactIdByEmail = new Map((existing ?? []).map((c) => [(c.email as string).toLowerCase(), c.id as string]));

  const added: string[] = [];
  for (const member of pending) {
    let contactId = contactIdByEmail.get(member.email);
    if (!contactId) {
      const { data: created, error } = await supabase
        .from("contacts")
        .insert({ first_name: member.firstName, last_name: member.lastName, email: member.email, phone: member.phone })
        .select("id")
        .single();
      if (error) throw error;
      contactId = created.id as string;
    }

    const { error: memberError } = await supabase
      .from("contact_list_members")
      .upsert({ list_id: list.id, contact_id: contactId }, { onConflict: "list_id,contact_id", ignoreDuplicates: true });
    if (memberError) throw memberError;

    // Recorded last, so a failure above is simply retried next run.
    const { error: syncError } = await supabase
      .from("member_contact_syncs")
      .insert({ website_user_id: member.id, contact_id: contactId });
    if (syncError) throw syncError;
    added.push(member.email);
  }
  return { added };
}
