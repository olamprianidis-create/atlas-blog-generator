import { useState } from "react";
import { InboxPreview } from "./EmailPreviews";

export interface SubjectValue {
  from_name: string;
  subject: string;
  preview_text: string;
}

interface SubjectOption {
  subject: string;
  previewText: string;
}

export default function StepSubject({
  value,
  onChange,
  fromAddress,
  replyTo,
  bodyHtml,
}: {
  value: SubjectValue;
  onChange: (next: SubjectValue) => void;
  fromAddress: string;
  replyTo: string;
  bodyHtml: string;
}) {
  const [brief, setBrief] = useState("");
  const [options, setOptions] = useState<SubjectOption[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/email/generate-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, body_html: bodyHtml, from_name: value.from_name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      setOptions(data.options as SubjectOption[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Subject line & sender</h2>
          <p className="mt-1 text-sm text-slate-500">This is everything people see in their inbox before opening.</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Sender name</span>
          <input
            value={value.from_name}
            onChange={(e) => onChange({ ...value, from_name: e.target.value })}
            placeholder="e.g. Odysseas with Christie's International"
            maxLength={80}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Sent from {fromAddress} · replies go to {replyTo}
          </span>
        </label>

        <label className="block">
          <span className="mb-1 flex justify-between text-xs font-medium text-slate-500">
            Subject line <span className={value.subject.length > 60 ? "text-amber-600" : ""}>{value.subject.length}/60</span>
          </span>
          <input
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value })}
            placeholder="What's the email about?"
            maxLength={150}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Preview line</span>
          <input
            value={value.preview_text}
            onChange={(e) => onChange({ ...value, preview_text: e.target.value })}
            placeholder="The grey text shown after the subject in the inbox"
            maxLength={150}
            className={inputClass}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Generate with AI</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Describe the email{bodyHtml ? " (your written content is used too)" : ""} and get 5 subject lines to pick from.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="e.g. Invite members to Thursday's speaker event with a real estate founder"
            className={`${inputClass} mt-3`}
          />
          <button
            type="button"
            onClick={generate}
            disabled={isGenerating || (!brief.trim() && !bodyHtml)}
            className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {isGenerating ? "Generating…" : options.length ? "Generate again" : "Generate subject lines"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {options.length > 0 && (
            <ul className="mt-4 space-y-2">
              {options.map((option) => (
                <li key={option.subject}>
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, subject: option.subject, preview_text: option.previewText })}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      value.subject === option.subject
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{option.subject}</p>
                    <p className="text-xs text-slate-500">{option.previewText}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-0 lg:self-start">
        <InboxPreview
          fromName={value.from_name}
          fromAddress={fromAddress}
          subject={value.subject}
          previewText={value.preview_text}
        />
      </div>
    </div>
  );
}
