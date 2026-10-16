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

export interface MemberContactUpdateResult {
  updated: string[]; // member emails whose contact was updated this run
}

// Pushes members' email/phone changes (made on the Website's Profile
// Editor) to their contact. Runs with the ~10-min cron for everyone, and
// instantly for one member via POST /api/members/sync-contact, which the
// Website calls right after a change. The Website database is the source
// of truth — nothing from the request is trusted.
//
// - First time a member is seen here: just records their current email /
//   phone as the baseline (and links the contact by email if the original
//   sync didn't store one). Nothing is changed.
// - After that, only a change since the last sync is pushed, so edits made
//   to the contact inside Stat.ATLAS aren't overwritten.
// - New email already belongs to another contact: that contact is linked
//   and added to the members list instead (contacts are unique by email).
// - An unsubscribe follows the member to their new email.
// - A contact deleted by hand (contact_id null) is left deleted.
export async function syncMemberContactChanges(onlyUserId?: string): Promise<MemberContactUpdateResult> {
  const supabase = getServiceClient();
  const members = (await listMembersForContactSync()).filter((m) => !onlyUserId || m.id === onlyUserId);
  if (members.length === 0) return { updated: [] };

  let query = supabase.from("member_contact_syncs").select("website_user_id, contact_id, synced_email, synced_phone");
  if (onlyUserId) query = query.eq("website_user_id", onlyUserId);
  const { data: rows, error } = await query;
  if (error) throw error;
  const rowById = new Map((rows ?? []).map((r) => [r.website_user_id as string, r]));

  const updated: string[] = [];
  for (const member of members) {
    const row = rowById.get(member.id);
    if (!row) continue; // not added to Contacts yet — syncNewMembersToContacts handles it

    let contactId = (row.contact_id as string | null) ?? null;
    const syncedEmail = (row.synced_email as string | null) ?? null;
    const syncedPhone = (row.synced_phone as string | null) ?? null;

    if (syncedEmail === null) {
      if (!contactId) {
        const { data: byEmail } = await supabase.from("contacts").select("id").ilike("email", member.email).maybeSingle();
        contactId = (byEmail?.id as string | undefined) ?? null;
      }
      await supabase
        .from("member_contact_syncs")
        .update({ contact_id: contactId, synced_email: member.email, synced_phone: member.phone })
        .eq("website_user_id", member.id);
      continue;
    }

    const emailChanged = member.email !== syncedEmail;
    const phoneChanged = (member.phone ?? null) !== (syncedPhone ?? null);
    if (!emailChanged && !phoneChanged) continue;

    if (contactId) {
      const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (phoneChanged) changes.phone = member.phone;
      if (emailChanged) {
        const { data: clash } = await supabase
          .from("contacts")
          .select("id")
          .ilike("email", member.email)
          .neq("id", contactId)
          .maybeSingle();
        if (clash) {
          contactId = clash.id as string;
          const { data: list } = await supabase
            .from("contact_lists")
            .select("id")
            .ilike("name", MEMBERS_LIST_NAME)
            .maybeSingle();
          if (list) {
            await supabase
              .from("contact_list_members")
              .upsert({ list_id: list.id, contact_id: contactId }, { onConflict: "list_id,contact_id", ignoreDuplicates: true });
          }
        } else {
          changes.email = member.email;
        }
      }
      const { error: updateError } = await supabase.from("contacts").update(changes).eq("id", contactId);
      if (updateError) throw updateError;

      if (emailChanged) {
        const { data: unsubscribed } = await supabase
          .from("email_unsubscribes")
          .select("email")
          .eq("email", syncedEmail)
          .maybeSingle();
        if (unsubscribed) {
          await supabase.from("email_unsubscribes").upsert({ email: member.email }, { onConflict: "email", ignoreDuplicates: true });
        }
      }
      updated.push(member.email);
    }

    const { error: syncError } = await supabase
      .from("member_contact_syncs")
      .update({ contact_id: contactId, synced_email: member.email, synced_phone: member.phone })
      .eq("website_user_id", member.id);
    if (syncError) throw syncError;
  }
  return { updated };
}
