import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

export interface UploadedDocument {
  name: string;
  extractedText: string;
  charCount: number;
}

interface DocumentUploadProps {
  documents: UploadedDocument[];
  onChange: (documents: UploadedDocument[]) => void;
}

const ACCEPT = ".pdf,.docx,.txt,.md,.csv";

export default function DocumentUpload({ documents, onChange }: DocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setIsProcessing(true);

    try {
      for (const file of Array.from(files)) {
        const blob = await upload(`reference-docs/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload-document",
        });

        const response = await fetch("/api/extract-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: blob.url, filename: file.name }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(`${file.name}: ${data.error ?? "extraction failed"}`);
        }

        onChange([
          ...documents,
          { name: file.name, extractedText: data.text as string, charCount: data.charCount as number },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed for an unknown reason.");
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove(name: string) {
    onChange(documents.filter((d) => d.name !== name));
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProcessing ? "Reading document…" : "Upload documents"}
        </button>
        <span className="text-xs text-slate-400">PDF, Word (.docx), text/Markdown, or CSV</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {documents.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {documents.map((doc) => (
            <li
              key={doc.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="truncate text-slate-700">{doc.name}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {doc.charCount.toLocaleString()} chars extracted
              </span>
              <button
                type="button"
                onClick={() => handleRemove(doc.name)}
                className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
