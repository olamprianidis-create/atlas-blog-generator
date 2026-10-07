import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import {
  EMAIL_ALIGNMENTS,
  EMAIL_FONTS,
  EMAIL_FONT_SIZES,
  EmailAlignment,
  EmailFont,
  FIRST_NAME_TAG,
  SectionStyle,
  fontStack,
} from "../../utils/emailCampaigns";

// Only what the email template knows how to style (utils/emailTemplate.ts).
// The header is a short line or two, so it gets inline formatting only.
const ALLOWED_TAGS = {
  header: ["p", "div", "br", "strong", "b", "em", "i", "u"],
  body: ["p", "div", "br", "h2", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"],
};

export type SectionVariant = keyof typeof ALLOWED_TAGS;

// Text typed before the first Enter isn't wrapped in any block; wrap it so
// the first line gets the same paragraph spacing as the rest in the email.
function wrapLeadingText(html: string): string {
  const firstBlock = html.search(/<(p|h2|ul|ol)[\s>]/);
  const leading = firstBlock === -1 ? html : html.slice(0, firstBlock);
  if (!leading.replace(/<br\s*\/?>/g, "").trim()) return html;
  return `<p>${leading}</p>${firstBlock === -1 ? "" : html.slice(firstBlock)}`;
}

// Every Enter is a line: empty paragraphs (<p><br></p>) are kept as blank
// lines rather than stripped — stripping them made blank lines vanish from
// the preview and the sent email.
export function sanitizeEmailHtml(html: string, variant: SectionVariant = "body"): string {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ALLOWED_TAGS[variant], ALLOWED_ATTR: ["href"] })
    // contentEditable emits <div> per line in some browsers; the template styles <p>.
    .replace(/<div>/g, "<p>")
    .replace(/<\/div>/g, "</p>");
  return wrapLeadingText(clean);
}

function ToolbarButton({
  label,
  title,
  onClick,
  active = false,
  className = "",
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-semibold ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      } ${className}`}
    >
      {label}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-slate-200" />;

const ALIGN_ICONS: Record<EmailAlignment, string> = { left: "⇤", center: "↔", right: "⇥" };

// Rich-text editor for one section of the email (header or body). Bold /
// italic / underline apply to the selection; font, size, alignment and
// background apply to the whole section. The DOM is left alone while typing
// (so the caret never jumps); only the value reported upward is sanitized.
export default function EmailSectionEditor({
  title,
  variant,
  value,
  onChange,
  style,
  onStyleChange,
  placeholder,
}: {
  title: string;
  variant: SectionVariant;
  value: string;
  onChange: (html: string) => void;
  style: SectionStyle;
  onStyleChange: (style: SectionStyle) => void;
  placeholder: string;
}) {
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
    const html = sanitizeEmailHtml(ref.current.innerHTML, variant);
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

  const selectClass = "h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none";

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p>
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-2">
          <select
            title="Font"
            value={style.fontFamily}
            onChange={(e) => onStyleChange({ ...style, fontFamily: e.target.value as EmailFont })}
            className={selectClass}
          >
            {EMAIL_FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            title="Text size"
            value={style.fontSize}
            onChange={(e) => onStyleChange({ ...style, fontSize: Number(e.target.value) })}
            className={selectClass}
          >
            {EMAIL_FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
          <Divider />
          <ToolbarButton label="B" title="Bold" onClick={() => exec("bold")} className="font-bold" />
          <ToolbarButton label="I" title="Italic" onClick={() => exec("italic")} className="italic" />
          <ToolbarButton label="U" title="Underline" onClick={() => exec("underline")} className="underline" />
          <Divider />
          {EMAIL_ALIGNMENTS.map((align) => (
            <ToolbarButton
              key={align}
              label={ALIGN_ICONS[align]}
              title={`Align ${align}`}
              active={style.align === align}
              onClick={() => onStyleChange({ ...style, align })}
            />
          ))}
          <Divider />
          <label title="Background color" className="flex h-7 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            <input
              type="color"
              value={style.backgroundColor}
              onChange={(e) => onStyleChange({ ...style, backgroundColor: e.target.value })}
              className="h-5 w-5 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
            />
            Background
          </label>
          <label title="Text color" className="flex h-7 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            <input
              type="color"
              value={style.textColor}
              onChange={(e) => onStyleChange({ ...style, textColor: e.target.value })}
              className="h-5 w-5 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
            />
            Text
          </label>
          {variant === "body" && (
            <>
              <Divider />
              <ToolbarButton label="H" title="Heading" onClick={() => exec("formatBlock", "h2")} />
              <ToolbarButton label="¶" title="Normal text" onClick={() => exec("formatBlock", "p")} />
              <ToolbarButton label="•" title="Bullet list" onClick={() => exec("insertUnorderedList")} />
              <ToolbarButton label="1." title="Numbered list" onClick={() => exec("insertOrderedList")} />
              <Divider />
              <ToolbarButton label="Link" title="Add link to selected text" onClick={addLink} />
              <ToolbarButton label="Unlink" title="Remove link" onClick={() => exec("unlink")} />
            </>
          )}
          <ToolbarButton label="Clear" title="Clear formatting" onClick={() => exec("removeFormat")} />
          <Divider />
          <ToolbarButton
            label="+ First name"
            title={`Insert ${FIRST_NAME_TAG} — replaced with each person's first name when sent ("there" if we don't have one)`}
            onClick={() => exec("insertText", FIRST_NAME_TAG)}
          />
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          data-placeholder={placeholder}
          style={{
            fontFamily: fontStack(style.fontFamily),
            fontSize: style.fontSize,
            textAlign: style.align,
            backgroundColor: style.backgroundColor,
            color: style.textColor,
          }}
          className={`${variant === "body" ? "min-h-[360px] [&_p]:mb-3" : "min-h-[72px] [&_p]:mb-0"} rounded-b-lg px-5 py-4 leading-normal focus:outline-none [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)] [&_a]:text-[#517590] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[1.25em] [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-left [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-left`}
        />
      </div>
    </div>
  );
}
