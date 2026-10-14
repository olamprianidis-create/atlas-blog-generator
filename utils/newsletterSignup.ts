// Server-only: public newsletter sign-ups from the ATLAS Website landing
// page ("Join Our Newsletter", forwarded by the Website's /api/newsletter).
// Each sign-up becomes a contact on the "Newsletter" contact list (created
// on first use), so campaigns can target it like any other list.
//
// Same rules as memberSync.ts: an email that's already a contact is added
// to the list but its existing fields are never overwritten — this is an
// unauthenticated form, so it must not be able to edit someone's record.
// For the same reason it never re-subscribes an address that opted out.
import { getServiceClient } from "./supabase";

export const NEWSLETTER_LIST_NAME = "Newsletter";

export interface NewsletterSignupInput {
  firstName: string;
  email: string;
  phone: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseNewsletterSignup(body: unknown): { input: NewsletterSignupInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const firstName = typeof b.firstName === "string" ? b.firstName.trim().slice(0, 80) : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 254) : "";
  const phoneRaw = typeof b.phone === "string" ? b.phone.trim().slice(0, 40) : "";
  if (!firstName) return { error: "Please enter your first name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  return { input: { firstName, email, phone: phoneRaw || null } };
}

export async function signUpForNewsletter(input: NewsletterSignupInput): Promise<void> {
  const supabase = getServiceClient();

  let { data: list, error: listError } = await supabase
    .from("contact_lists")
    .select("id")
    .ilike("name", NEWSLETTER_LIST_NAME)
    .maybeSingle();
  if (listError) throw listError;
  if (!list) {
    const created = await supabase.from("contact_lists").insert({ name: NEWSLETTER_LIST_NAME }).select("id").single();
    if (created.error) {
      // Lost a race with another first sign-up — read the winner's row.
      const retry = await supabase.from("contact_lists").select("id").ilike("name", NEWSLETTER_LIST_NAME).single();
      if (retry.error) throw created.error;
      list = retry.data;
    } else {
      list = created.data;
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("contacts")
    .select("id")
    .eq("email", input.email) // contacts store emails lowercased
    .maybeSingle();
  if (existingError) throw existingError;

  let contactId = existing?.id as string | undefined;
  if (!contactId) {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({ first_name: input.firstName, email: input.email, phone: input.phone, notes: "Newsletter sign-up (website)" })
      .select("id")
      .single();
    if (error) throw error;
    contactId = created.id as string;
  }

  const { error: memberError } = await supabase
    .from("contact_list_members")
    .upsert({ list_id: list!.id, contact_id: contactId }, { onConflict: "list_id,contact_id", ignoreDuplicates: true });
  if (memberError) throw memberError;
}
