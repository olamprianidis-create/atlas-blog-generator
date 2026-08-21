import { useEffect, useRef } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const TEXT_COLORS = ["#0f172a", "#dc2626", "#2563eb", "#16a34a", "#7c3aed", "#ea580c"];
const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];

const BLOCK_TAGS = new Set(["div", "p", "ul", "ol", "blockquote", "h1", "h2", "h3"]);

// Converts the contentEditable DOM back into the same plain-text shape
// utils/outlineSerialize.ts expects (line-per-block, "- "/"1. " list
// prefixes) — rich formatting (bold/color/etc.) lives only in the editor,
// it isn't carried into the plain outlineText the rest of the app uses.
function domToPlainText(root: Node): string {
  let text = "";

  function walk(node: Node, listType: "ul" | "ol" | null, listIndex: { n: number }) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      text += "\n";
      return;
    }

    if (tag === "li") {
      text += listType === "ol" ? `${listIndex.n++}. ` : "- ";
      for (const child of Array.from(el.childNodes)) walk(child, null, { n: 1 });
      if (!text.endsWith("\n")) text += "\n";
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const idx = { n: 1 };
      for (const child of Array.from(el.childNodes)) walk(child, tag, idx);
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      for (const child of Array.from(el.childNodes)) walk(child, listType, listIndex);
      if (!text.endsWith("\n")) text += "\n";
      return;
    }

    // Inline formatting elements (b, i, u, span, font, strong, em, etc.) —
    // just recurse, the formatting itself is dropped in plain text.
    for (const child of Array.from(el.childNodes)) walk(child, listType, listIndex);
  }

  for (const child of Array.from(root.childNodes)) walk(child, null, { n: 1 });

  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

function textToDom(container: HTMLElement, text: string) {
  container.innerHTML = "";
  for (const line of text.split("\n")) {
    const div = document.createElement("div");
    if (line.length === 0) {
      div.appendChild(document.createElement("br"));
    } else {
      div.textContent = line;
    }
    container.appendChild(div);
  }
}

function ToolbarButton({
  label,
  title,
  onClick,
  className = "",
}: {
  label: string;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 ${className}`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
}

export default function RichTextEditor({ value, onChange, className = "" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>(value);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
    } catch {
      // Non-standard API — no-op if the browser doesn't support it.
    }
    if (editorRef.current) {
      textToDom(editorRef.current, value);
    }
    // Only populate from the initial value on mount — see the effect
    // below for syncing later external changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value === lastValueRef.current) return;
    if (!editorRef.current) return;
    textToDom(editorRef.current, value);
    lastValueRef.current = value;
  }, [value]);

  function handleInput() {
    if (!editorRef.current) return;
    const text = domToPlainText(editorRef.current);
    lastValueRef.current = text;
    onChange(text);
  }

  function exec(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    handleInput();
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-2">
        <ToolbarButton label="B" title="Bold" onClick={() => exec("bold")} className="font-bold" />
        <ToolbarButton label="I" title="Italic" onClick={() => exec("italic")} className="italic" />
        <ToolbarButton label="U" title="Underline" onClick={() => exec("underline")} className="underline" />
        <Divider />
        <ToolbarButton label="•" title="Bullet list" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton label="1." title="Numbered list" onClick={() => exec("insertOrderedList")} />
        <Divider />
        <ToolbarButton label="→" title="Indent" onClick={() => exec("indent")} />
        <ToolbarButton label="←" title="Outdent" onClick={() => exec("outdent")} />
        <Divider />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">Text</span>
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={`Text color ${color}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => exec("foreColor", color)}
              style={{ backgroundColor: color }}
              className="h-4 w-4 rounded-full border border-slate-200"
            />
          ))}
        </div>
        <Divider />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">Highlight</span>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={`Highlight ${color}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => exec("hiliteColor", color)}
              style={{ backgroundColor: color }}
              className="h-4 w-4 rounded-full border border-slate-200"
            />
          ))}
        </div>
        <Divider />
        <ToolbarButton label="Clear" title="Clear formatting" onClick={() => exec("removeFormat")} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        spellCheck={false}
        className="min-h-[520px] max-h-[720px] overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-sm leading-relaxed text-slate-900 focus:outline-none"
      />
    </div>
  );
}
