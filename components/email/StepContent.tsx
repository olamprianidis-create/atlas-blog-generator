import { useState } from "react";
import EmailBodyEditor, { sanitizeEmailHtml } from "./EmailBodyEditor";
import { EmailPreview } from "./EmailPreviews";

export default function StepContent({
  bodyHtml,
  onChange,
  subject,
  fromName,
  previewText,
  mailingAddress,
}: {
  bodyHtml: string;
  onChange: (html: string) => void;
  subject: string;
  fromName: string;
  previewText: string;
  mailingAddress: string;
}) {
  const [brief, setBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (bodyHtml.replace(/<[^>]+>/g, "").trim() && !window.confirm("Replace what you've written with a generated draft?")) {
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/email/generate-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, subject, from_name: fromName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed");
      onChange(sanitizeEmailHtml(data.html as string));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Write the email</h2>
        <p className="mt-1 text-sm text-slate-500">
          Write it yourself or generate a draft and edit it. The ATLAS header, your mailing address and the
          unsubscribe link are added automatically.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Generate with AI</p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="What should it say? Include any links, dates and details, e.g. “Invite members to Thursday's 7pm speaker event with Jason Somers, casual tone, RSVP link: https://www.atlasnetwork.club/events/…”"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={generate}
          disabled={isGenerating || !brief.trim()}
          className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {isGenerating ? "Writing…" : "Generate draft"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <EmailBodyEditor value={bodyHtml} onChange={onChange} />
        <EmailPreview bodyHtml={bodyHtml} previewText={previewText} mailingAddress={mailingAddress} />
      </div>
    </div>
  );
}
