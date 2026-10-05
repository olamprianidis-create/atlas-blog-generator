// Shared by the Contacts API routes and pages/contacts.tsx.

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export type ContactInput = Pick<Contact, "first_name" | "last_name" | "email" | "phone" | "company" | "notes">;

export const CONTACT_COLUMNS = "id, first_name, last_name, email, phone, company, notes, subscribed, created_at, updated_at";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// Validates a create/update body. Returns either the cleaned row or an
// error message suitable for a 400 response.
export function parseContactInput(body: unknown): { input: ContactInput } | { error: string } {
  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const input: ContactInput = {
    first_name: cleanText(raw.first_name) ?? "",
    last_name: cleanText(raw.last_name) ?? "",
    email: cleanText(raw.email)?.toLowerCase() ?? null,
    phone: cleanText(raw.phone),
    company: cleanText(raw.company),
    notes: cleanText(raw.notes),
  };

  if (!input.first_name && !input.last_name && !input.company) {
    return { error: "A contact needs a first name, last name, or company" };
  }
  if (input.email && !EMAIL_PATTERN.test(input.email)) {
    return { error: "That email address doesn't look valid" };
  }
  return { input };
}

export function contactDisplayName(contact: Pick<Contact, "first_name" | "last_name" | "company">): string {
  const name = `${contact.first_name} ${contact.last_name}`.trim();
  return name || contact.company || "No Name";
}

export function contactInitials(contact: Pick<Contact, "first_name" | "last_name" | "company">): string {
  const first = contact.first_name.charAt(0);
  const last = contact.last_name.charAt(0);
  const initials = `${first}${last}`.trim() || (contact.company ?? "").charAt(0);
  return initials.toUpperCase() || "?";
}

// Apple Contacts ordering: by last name, falling back to first name, then
// company, for contacts that only have one of them.
export function contactSortKey(contact: Pick<Contact, "first_name" | "last_name" | "company">): string {
  return (contact.last_name || contact.first_name || contact.company || "").toLowerCase();
}

export function compareContacts(a: Contact, b: Contact): number {
  return (
    contactSortKey(a).localeCompare(contactSortKey(b)) ||
    a.first_name.toLowerCase().localeCompare(b.first_name.toLowerCase())
  );
}

// Section letter for the alphabetical list; anything not starting with a
// letter (numbers, emoji, blank) groups under "#", like Apple does.
export function contactSectionLetter(contact: Contact): string {
  const letter = contactSortKey(contact).charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
}

// Supabase/Postgres error for "table doesn't exist" — i.e. migration
// 0018_contacts.sql hasn't been run yet.
export function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205";
}

export function isDuplicateEmailError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}
