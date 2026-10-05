// Server-only: turns a campaign's audience selection into the actual
// recipient list. Used for the live count in the wizard, the count stored
// at scheduling time, and (later) the real send — so all three always
// agree on who's included.
import { getServiceClient } from "./supabase";
import { listMembersForEmail } from "./websiteDb";
import { AudienceOptions, AudienceSelection, AudienceStats } from "./emailCampaigns";

export interface Recipient {
  email: string;
  firstName: string;
  lastName: string;
  contactId: string | null;
}

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  subscribed: boolean;
}

async function listContactsForAudience(selection: AudienceSelection): Promise<ContactRow[]> {
  const supabase = getServiceClient();
  const columns = "id, first_name, last_name, email, subscribed";

  if (selection.include_all_contacts) {
    const { data, error } = await supabase.from("contacts").select(columns);
    if (error) throw error;
    return (data ?? []) as ContactRow[];
  }
  if (selection.audience_list_ids.length === 0) return [];

  const { data, error } = await supabase
    .from("contact_list_members")
    .select(`contacts(${columns})`)
    .in("list_id", selection.audience_list_ids);
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as unknown as { contacts: ContactRow | null }).contacts)
    .filter((c): c is ContactRow => c !== null);
}

async function listUnsubscribedEmails(): Promise<Set<string>> {
  const { data, error } = await getServiceClient().from("email_unsubscribes").select("email");
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r.email as string).toLowerCase()));
}

export async function resolveAudience(
  selection: AudienceSelection
): Promise<{ recipients: Recipient[]; stats: AudienceStats }> {
  const [contacts, members, unsubscribed] = await Promise.all([
    listContactsForAudience(selection),
    selection.include_all_members ? listMembersForEmail() : Promise.resolve([]),
    listUnsubscribedEmails(),
  ]);

  const byEmail = new Map<string, Recipient>();
  let duplicatesMerged = 0;
  let unsubscribedRemoved = 0;
  let missingEmail = 0;
  const removedEmails = new Set<string>();

  const candidates: (Recipient & { optedOut: boolean })[] = [
    ...contacts.map((c) => ({
      email: (c.email ?? "").trim().toLowerCase(),
      firstName: c.first_name,
      lastName: c.last_name,
      contactId: c.id,
      optedOut: !c.subscribed,
    })),
    ...members.map((m) => ({
      email: m.email.trim().toLowerCase(),
      firstName: m.firstName,
      lastName: m.lastName,
      contactId: null,
      optedOut: false,
    })),
  ];

  for (const { optedOut, ...candidate } of candidates) {
    if (!candidate.email) {
      missingEmail++;
      continue;
    }
    if (optedOut || unsubscribed.has(candidate.email)) {
      if (!removedEmails.has(candidate.email)) unsubscribedRemoved++;
      removedEmails.add(candidate.email);
      byEmail.delete(candidate.email);
      continue;
    }
    if (removedEmails.has(candidate.email)) continue;
    if (byEmail.has(candidate.email)) {
      duplicatesMerged++;
      // Prefer the Contacts row (it carries a contact id for reporting).
      if (candidate.contactId && !byEmail.get(candidate.email)!.contactId) byEmail.set(candidate.email, candidate);
      continue;
    }
    byEmail.set(candidate.email, candidate);
  }

  return {
    recipients: Array.from(byEmail.values()),
    stats: { recipients: byEmail.size, unsubscribedRemoved, duplicatesMerged, missingEmail },
  };
}

// Counts for each checkbox on the wizard's Audience step.
export async function getAudienceOptions(): Promise<AudienceOptions> {
  const supabase = getServiceClient();
  const [members, contactsResult, listsResult, membershipsResult] = await Promise.all([
    listMembersForEmail(),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("contact_lists").select("id, name").order("name"),
    supabase.from("contact_list_members").select("list_id"),
  ]);
  for (const result of [contactsResult, listsResult, membershipsResult]) {
    if (result.error) throw result.error;
  }

  const countByList = new Map<string, number>();
  for (const row of membershipsResult.data ?? []) {
    countByList.set(row.list_id as string, (countByList.get(row.list_id as string) ?? 0) + 1);
  }

  return {
    memberCount: members.length,
    contactCount: contactsResult.count ?? 0,
    lists: (listsResult.data ?? []).map((l) => ({
      id: l.id as string,
      name: l.name as string,
      count: countByList.get(l.id as string) ?? 0,
    })),
  };
}
