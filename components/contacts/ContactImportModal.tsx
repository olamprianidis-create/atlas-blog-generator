import { ChangeEvent, useState } from "react";
import { ContactList } from "../../utils/contacts";
import { ContactField, ImportRow, detectColumns, parseCsv, rowsToContacts } from "../../utils/csv";

interface ImportResult {
  created: number;
  alreadyExisted: number;
  invalid: number;
  addedToList: number;
}

const FIELD_LABELS: Record<ContactField, string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  notes: "Notes",
};

export default function ContactImportModal({
  lists,
  defaultListId,
  onClose,
  onImported,
}: {
  lists: ContactList[];
  defaultListId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [detected, setDetected] = useState<ContactField[]>([]);
  const [listId, setListId] = useState(defaultListId);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setResult(null);
    setRows([]);
    if (!file) return;
    setFileName(file.name);

    const table = parseCsv(await file.text());
    if (table.length < 2) {
      setError("That file has no rows under the header.");
      return;
    }
    const mapping = detectColumns(table[0]);
    const fields = Object.keys(mapping) as ContactField[];
    if (!fields.some((f) => ["first_name", "last_name", "full_name", "company"].includes(f))) {
      setError('Couldn\'t find a name column. The first row needs headers like "First Name", "Last Name", "Name", or "Company".');
      return;
    }
    setDetected(fields);
    setRows(rowsToContacts(table.slice(1), mapping));
  }

  async function handleImport() {
    setIsImporting(true);
    setError(null);
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, list_id: listId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed");
      setResult(data as ImportResult);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">Import contacts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV (export from Google Sheets, Excel, or Google/Apple Contacts). The first row should be
          headers like First Name, Last Name, Email, Phone, Company. Contacts whose email already exists are
          left unchanged.
        </p>

        {result ? (
          <div className="mt-5 space-y-1 rounded-lg bg-green-50 p-4 text-sm text-green-900">
            <p className="font-semibold">Import finished</p>
            <p>{result.created} new contacts added</p>
            {result.alreadyExisted > 0 && <p>{result.alreadyExisted} already existed (left unchanged)</p>}
            {result.invalid > 0 && <p>{result.invalid} rows skipped (no name, or an invalid email)</p>}
            {listId && <p>{result.addedToList} contacts are now in the chosen list</p>}
          </div>
        ) : (
          <>
            <label className="mt-5 block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600 hover:border-slate-400">
              {fileName || "Choose a .csv file"}
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            </label>

            {rows.length > 0 && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-slate-700">
                  <span className="font-semibold">{rows.length} rows</span> found · columns detected:{" "}
                  {detected.map((f) => FIELD_LABELS[f]).join(", ")}
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-1.5 font-medium text-slate-900">
                            {`${row.first_name} ${row.last_name}`.trim() || row.company}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">{row.email}</td>
                          <td className="px-3 py-1.5 text-slate-500">{row.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && <p className="text-xs text-slate-400">Showing the first 5.</p>}
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Also add them to a list (optional)</span>
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">No list</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || isImporting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {isImporting ? "Importing…" : `Import ${rows.length || ""} contacts`.replace("  ", " ")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
