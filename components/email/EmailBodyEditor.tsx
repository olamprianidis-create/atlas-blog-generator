import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";

// Only what the email template knows how to style (utils/emailTemplate.ts).
const ALLOWED_TAGS = ["p", "div", "br", "h2", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"];

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ["href"] })
    // contentEditable emits <div> per line; the template styles <p>.
    .replace(/<div>/g, "<p>")
    .replace(/<\/div>/g, "</p>")
    .replace(/<p><br><\/p>/g, "");
}

function ToolbarButton({ label, title, onClick, className = "" }: { label: string; title: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 ${className}`}
    >
      {label}
    </button>
  );
}

// HTML editor for the email body. The DOM is left alone while typing (so
// the caret never jumps); only the value reported upward is sanitized.
export default function EmailBodyEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Non-standard API — no-op if unsupported.
    }
  }, []);

  // Sync only external changes (initial load, "Generate"), not our own edits.
  useEffect(() => {
    if (ref.current && value !== lastEmitted.current) {
      ref.current.innerHTML = value;
      lastEmitted.current = value;
    }
  }, [value]);

  function emit() {
    if (!ref.current) return;
    const html = sanitizeEmailHtml(ref.current.innerHTML);
    lastEmitted.current = html;
    onChange(html);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function addLink() {
    const url = window.prompt("Link URL (https://…):")?.trim();
    if (!url) return;
    exec("createLink", /^https?:\/\//i.test(url) || url.startsWith("mailto:") ? url : `https://${url}`);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-2">
        <ToolbarButton label="B" title="Bold" onClick={() => exec("bold")} className="font-bold" />
        <ToolbarButton label="I" title="Italic" onClick={() => exec("italic")} className="italic" />
        <ToolbarButton label="U" title="Underline" onClick={() => exec("underline")} className="underline" />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton label="H" title="Heading" onClick={() => exec("formatBlock", "h2")} />
        <ToolbarButton label="¶" title="Normal text" onClick={() => exec("formatBlock", "p")} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton label="•" title="Bullet list" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton label="1." title="Numbered list" onClick={() => exec("insertOrderedList")} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton label="Link" title="Add link to selected text" onClick={addLink} />
        <ToolbarButton label="Unlink" title="Remove link" onClick={() => exec("unlink")} />
        <ToolbarButton label="Clear" title="Clear formatting" onClick={() => exec("removeFormat")} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder="Write your email here…"
        className="min-h-[360px] px-5 py-4 text-[15px] leading-relaxed text-slate-900 focus:outline-none [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)] [&_a]:text-[#517590] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
