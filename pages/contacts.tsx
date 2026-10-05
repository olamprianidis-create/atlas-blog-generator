import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import {
  Contact,
  ContactInput,
  compareContacts,
  contactDisplayName,
  contactInitials,
  contactSectionLetter,
} from "../utils/contacts";

const EMPTY_FORM: ContactInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
};

// "new" is the selection while composing a contact that isn't saved yet.
type Selection = string | "new" | null;

function toForm(contact: Contact): ContactInput {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    company: contact.company ?? "",
    notes: contact.notes ?? "",
  };
}

function Avatar({ contact, size }: { contact: Pick<Contact, "first_name" | "last_name" | "company">; size: "sm" | "lg" }) {
  const sizing = size === "lg" ? "h-40 w-40 text-7xl font-light" : "h-9 w-9 text-sm font-semibold";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-slate-400 to-slate-600 text-white ${sizing} ${
        size === "lg" ? "border border-white/40 shadow-lg" : ""
      }`}
    >
      {contactInitials(contact)}
    </span>
  );
}

function ActionButton({ href, label, disabled, children }: { href: string; label: string; disabled: boolean; children: ReactNode }) {
  const className =
    "flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30";
  if (disabled) {
    return (
      <span title={label} className={`${className} cursor-not-allowed opacity-40 hover:bg-white/20`}>
        {children}
      </span>
    );
  }
  return (
    <a href={href} title={label} className={className}>
      {children}
    </a>
  );
}

function icon(path: string) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MESSAGE_ICON = icon("M4 5h16v11H8l-4 4V5Z");
const PHONE_ICON = icon(
  "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"
);
const MAIL_ICON = icon("M4 6h16v12H4V6Zm0 0 8 7 8-7");

function FormField({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const inputClass =
    "mt-1 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/60";
  return (
    <label className="block">
      <span className="text-xs font-medium text-violet-200">{label}</span>
      {multiline ? (
        <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </label>
  );
}

function DetailRow({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="border-b border-white/10 py-2.5 last:border-b-0">
      <p className="text-xs font-medium text-violet-200">{label}</p>
      {href ? (
        <a href={href} className="text-sm text-white hover:underline">
          {value}
        </a>
      ) : (
        <p className="text-sm text-white">{value}</p>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selection>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ContactInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadContacts();
  }, []);

  async function loadContacts() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/contacts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load contacts");
      setContacts(data as Contact[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) =>
      [contactDisplayName(c), c.email, c.phone, c.company, c.notes].some((field) =>
        field?.toLowerCase().includes(needle)
      )
    );
  }, [contacts, query]);

  const sections = useMemo(() => {
    const groups = new Map<string, Contact[]>();
    for (const contact of filtered) {
      const letter = contactSectionLetter(contact);
      groups.set(letter, [...(groups.get(letter) ?? []), contact]);
    }
    // "#" sorts after Z, like Apple's list.
    return Array.from(groups.entries()).sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  }, [filtered]);

  const selectedContact = selected && selected !== "new" ? contacts.find((c) => c.id === selected) ?? null : null;

  function selectContact(id: string) {
    setSelected(id);
    setIsEditing(false);
    setFormError(null);
  }

  function startNew() {
    setSelected("new");
    setForm(EMPTY_FORM);
    setIsEditing(true);
    setFormError(null);
  }

  function startEdit() {
    if (!selectedContact) return;
    setForm(toForm(selectedContact));
    setIsEditing(true);
    setFormError(null);
  }

  function cancelEdit() {
    setIsEditing(false);
    setFormError(null);
    if (selected === "new") setSelected(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const isNew = selected === "new";
      const response = await fetch(isNew ? "/api/contacts" : `/api/contacts/${selected}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to save contact");
      const saved = data as Contact;
      setContacts((current) =>
        [...current.filter((c) => c.id !== saved.id), saved].sort(compareContacts)
      );
      setSelected(saved.id);
      setIsEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedContact) return;
    if (!window.confirm(`Delete ${contactDisplayName(selectedContact)}? This can't be undone.`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/contacts/${selectedContact.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to delete contact");
      }
      setContacts((current) => current.filter((c) => c.id !== selectedContact.id));
      setSelected(null);
      setIsEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete contact");
    } finally {
      setIsSaving(false);
    }
  }

  const previewContact = isEditing ? form : selectedContact;

  return (
    <AppLayout>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-xl font-semibold text-slate-900">Contacts</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isEditing ? cancelEdit : startEdit}
            disabled={!isEditing && !selectedContact}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            onClick={startNew}
            title="New contact"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-slate-700 transition-colors hover:bg-slate-100"
          >
            +
          </button>
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
              <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-56 rounded-full border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          {isLoading && <p className="px-6 py-4 text-sm text-slate-500">Loading contacts…</p>}
          {loadError && <p className="px-6 py-4 text-sm text-red-600">{loadError}</p>}
          {!isLoading && !loadError && contacts.length === 0 && (
            <p className="px-6 py-4 text-sm text-slate-500">No contacts yet. Click + to add one.</p>
          )}
          {!isLoading && contacts.length > 0 && filtered.length === 0 && (
            <p className="px-6 py-4 text-sm text-slate-500">No contacts match “{query}”.</p>
          )}
          {sections.map(([letter, group]) => (
            <section key={letter}>
              <p className="sticky top-0 z-10 bg-white/95 px-6 pb-1 pt-3 text-xs font-semibold text-slate-400 backdrop-blur">
                {letter}
              </p>
              <ul>
                {group.map((contact) => {
                  const isActive = contact.id === selected;
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => selectContact(contact.id)}
                        className={`flex w-full items-center gap-3 px-6 py-2 text-left transition-colors ${
                          isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                        }`}
                      >
                        <Avatar contact={contact} size="sm" />
                        <span className="min-w-0 flex-1 border-b border-slate-100 pb-2">
                          <span className={`block truncate text-sm font-semibold ${isActive ? "text-white" : "text-slate-900"}`}>
                            {contactDisplayName(contact)}
                          </span>
                          {contact.company && (contact.first_name || contact.last_name) && (
                            <span className={`block truncate text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                              {contact.company}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {!previewContact ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {contacts.length > 0 ? "Select a contact" : "No contact selected"}
            </div>
          ) : (
            <div className="mx-auto min-h-full max-w-2xl rounded-2xl bg-gradient-to-b from-slate-400 via-slate-700 to-indigo-950 px-8 py-10 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <Avatar contact={previewContact} size="lg" />
                <h2 className="mt-6 text-3xl font-bold text-white">
                  {contactDisplayName(previewContact)}
                </h2>
                {previewContact.company && (previewContact.first_name || previewContact.last_name) && (
                  <p className="mt-1 text-sm text-slate-200">{previewContact.company}</p>
                )}
                {!isEditing && selectedContact && (
                  <div className="mt-5 flex gap-3">
                    <ActionButton href={`sms:${selectedContact.phone ?? ""}`} label="Message" disabled={!selectedContact.phone}>
                      {MESSAGE_ICON}
                    </ActionButton>
                    <ActionButton href={`tel:${selectedContact.phone ?? ""}`} label="Call" disabled={!selectedContact.phone}>
                      {PHONE_ICON}
                    </ActionButton>
                    <ActionButton href={`mailto:${selectedContact.email ?? ""}`} label="Email" disabled={!selectedContact.email}>
                      {MAIL_ICON}
                    </ActionButton>
                  </div>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSave} className="mx-auto mt-8 max-w-md space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
                    <FormField label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
                  </div>
                  <FormField label="Company" value={form.company ?? ""} onChange={(v) => setForm({ ...form, company: v })} />
                  <FormField label="Email" type="email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
                  <FormField label="Phone" type="tel" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
                  <FormField label="Notes" multiline value={form.notes ?? ""} onChange={(v) => setForm({ ...form, notes: v })} />

                  {formError && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-100">{formError}</p>}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 rounded-lg bg-white py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Done"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 rounded-lg bg-white/15 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                    >
                      Cancel
                    </button>
                  </div>
                  {selected !== "new" && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving}
                      className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                      Delete Contact
                    </button>
                  )}
                </form>
              ) : (
                selectedContact && (
                  <div className="mx-auto mt-8 max-w-md space-y-3">
                    <div className="rounded-xl bg-white/10 px-4 py-1.5 backdrop-blur">
                      <DetailRow label="phone" value={selectedContact.phone} href={`tel:${selectedContact.phone}`} />
                      <DetailRow label="email" value={selectedContact.email} href={`mailto:${selectedContact.email}`} />
                      <DetailRow label="company" value={selectedContact.company} />
                      {!selectedContact.phone && !selectedContact.email && !selectedContact.company && (
                        <p className="py-2.5 text-sm text-slate-300">No contact details yet — click Edit to add some.</p>
                      )}
                    </div>
                    <div className="min-h-[7rem] rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
                      <p className="text-xs font-medium text-violet-200">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-white">{selectedContact.notes}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
