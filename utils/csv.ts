// Minimal CSV parsing for the Contacts import (pages/contacts.tsx) — no
// library needed for RFC-4180-style files (quoted fields, escaped "",
// commas/newlines inside quotes), which is what Google Sheets, Excel and
// Apple Contacts exports produce.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^﻿/, ""); // strip Excel's BOM

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export type ContactField = "first_name" | "last_name" | "full_name" | "email" | "phone" | "company" | "notes";

const HEADER_ALIASES: Record<ContactField, string[]> = {
  first_name: ["first name", "firstname", "first", "given name"],
  last_name: ["last name", "lastname", "last", "surname", "family name"],
  full_name: ["name", "full name", "fullname", "contact name"],
  email: ["email", "e-mail", "email address", "e-mail address", "e-mail 1 - value", "email 1"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "phone 1 - value", "mobile phone"],
  company: ["company", "organization", "organisation", "business", "organization 1 - name", "company name"],
  notes: ["notes", "note", "comments"],
};

// Which column index holds each field, matched on the header row.
export function detectColumns(header: string[]): Partial<Record<ContactField, number>> {
  const normalized = header.map((h) => h.trim().toLowerCase().replace(/[_]+/g, " "));
  const mapping: Partial<Record<ContactField, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ContactField, string[]][]) {
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index !== -1) mapping[field] = index;
  }
  return mapping;
}

export interface ImportRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
}

export function rowsToContacts(rows: string[][], mapping: Partial<Record<ContactField, number>>): ImportRow[] {
  const cell = (row: string[], field: ContactField) =>
    mapping[field] === undefined ? "" : (row[mapping[field] as number] ?? "").trim();

  return rows.map((row) => {
    let first = cell(row, "first_name");
    let last = cell(row, "last_name");
    // A single "Name" column: split on the last space ("Mary Ann Smith" →
    // "Mary Ann" / "Smith").
    if (!first && !last) {
      const full = cell(row, "full_name");
      const split = full.lastIndexOf(" ");
      first = split === -1 ? full : full.slice(0, split);
      last = split === -1 ? "" : full.slice(split + 1);
    }
    return {
      first_name: first,
      last_name: last,
      email: cell(row, "email"),
      phone: cell(row, "phone"),
      company: cell(row, "company"),
      notes: cell(row, "notes"),
    };
  });
}
