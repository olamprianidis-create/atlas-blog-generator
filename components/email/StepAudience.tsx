import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AudienceOptions, AudienceSelection, AudienceStats, hasAudience } from "../../utils/emailCampaigns";
import { Contact, contactDisplayName } from "../../utils/contacts";

function Option({
  checked,
  disabled = false,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        checked ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-slate-900"
      />
      <span className="flex-1 text-sm font-medium text-slate-900">{title}</span>
      <span className="text-xs text-slate-500">{detail}</span>
    </label>
  );
}

// Search box for hand-picking individual contacts. Picked people show as
// removable chips above the search; results are capped so a long address
// book doesn't flood the step.
function SpecificPeople({
  contacts,
  selectedIds,
  disabled,
  onChange,
}: {
  contacts: Contact[];
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = contacts.filter((c) => selectedIds.includes(c.id));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return contacts
      .filter((c) =>
        [contactDisplayName(c), c.email, c.company].some((v) => v && v.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [contacts, query]);

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id));
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-3 pr-1 text-xs font-medium text-white"
            >
              {contactDisplayName(c)}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(c.id, false)}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-700"
                aria-label={`Remove ${contactDisplayName(c)}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={disabled ? "Everyone is already included via All Contacts" : "Search contacts by name, email, or company"}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none disabled:cursor-not-allowed"
      />
      {query.trim() && !disabled && (
        <ul className="mt-2 divide-y divide-slate-100">
          {matches.length === 0 ? (
            <li className="py-2 text-sm text-slate-500">No contacts match “{query.trim()}”.</li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="flex-1 text-sm text-slate-900">{contactDisplayName(c)}</span>
                  <span className="text-xs text-slate-500">{c.email ?? "No email"}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function StepAudience({
  selection,
  onChange,
}: {
  selection: AudienceSelection;
  onChange: (next: AudienceSelection) => void;
}) {
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/contacts")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setContacts(data as Contact[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contacts"));
    fetch("/api/email/audience")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setOptions(data as AudienceOptions);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audience"));
  }, []);

  // Live, de-duplicated recipient count (debounced while clicking around).
  useEffect(() => {
    if (!hasAudience(selection)) {
      setStats(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch("/api/email/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          setStats(data as AudienceStats);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to count recipients"));
    }, 300);
    return () => clearTimeout(timer);
  }, [selection]);

  function toggleList(id: string, checked: boolean) {
    const ids = checked
      ? [...selection.audience_list_ids, id]
      : selection.audience_list_ids.filter((x) => x !== id);
    onChange({ ...selection, audience_list_ids: ids });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Who should get this email?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick one or more. Anyone on several lists gets it once, and unsubscribed people are always left out.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!options ? (
        <p className="text-sm text-slate-500">Loading audiences…</p>
      ) : (
        <div className="space-y-2">
          <Option
            checked={selection.include_all_contacts}
            onChange={(checked) => onChange({ ...selection, include_all_contacts: checked })}
            title="All Contacts"
            detail={`${options.contactCount} contacts`}
          />
          <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Your lists</p>
          {options.lists.length === 0 ? (
            <p className="text-sm text-slate-500">
              No lists yet —{" "}
              <Link href="/contacts" className="font-medium text-slate-900 underline">
                create them in Contacts
              </Link>
              .
            </p>
          ) : (
            options.lists.map((list) => (
              <Option
                key={list.id}
                checked={selection.include_all_contacts || selection.audience_list_ids.includes(list.id)}
                disabled={selection.include_all_contacts}
                onChange={(checked) => toggleList(list.id, checked)}
                title={list.name}
                detail={`${list.count} ${list.count === 1 ? "contact" : "contacts"}`}
              />
            ))
          )}
          <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Specific people</p>
          <SpecificPeople
            contacts={contacts}
            selectedIds={selection.audience_contact_ids}
            disabled={selection.include_all_contacts}
            onChange={(ids) => onChange({ ...selection, audience_contact_ids: ids })}
          />
        </div>
      )}

      <div className="rounded-xl bg-slate-900 px-5 py-4 text-white">
        {!hasAudience(selection) ? (
          <p className="text-sm text-slate-300">Nothing selected yet.</p>
        ) : !stats ? (
          <p className="text-sm text-slate-300">Counting…</p>
        ) : (
          <>
            <p className="text-2xl font-bold">
              {stats.recipients} {stats.recipients === 1 ? "recipient" : "recipients"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {[
                stats.unsubscribedRemoved && `${stats.unsubscribedRemoved} unsubscribed removed`,
                stats.duplicatesMerged && `${stats.duplicatesMerged} duplicates merged`,
                stats.missingEmail && `${stats.missingEmail} without an email skipped`,
              ]
                .filter(Boolean)
                .join(" · ") || "No duplicates or unsubscribes in this selection."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
