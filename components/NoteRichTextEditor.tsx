import { useEffect, useRef } from "react";

interface NoteRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const TOOLBAR_BUTTONS: { label: string; command: string; value?: string; title: string; className?: string }[] = [
  { label: "B", command: "bold", title: "Bold", className: "font-bold" },
  { label: "I", command: "italic", title: "Italic", className: "italic" },
  { label: "U", command: "underline", title: "Underline", className: "underline" },
  { label: "H", command: "hiliteColor", value: "#86efac", title: "Highlight" },
  { label: "•", command: "insertUnorderedList", title: "Bullet list" },
  { label: "1.", command: "insertOrderedList", title: "Numbered list" },
];

// A lightweight contentEditable-based rich text editor that stores raw
// HTML (unlike components/RichTextEditor.tsx, which serializes to the
// plain-text outline format — different contract, different component).
// Used for the Content Calendar note description. Uses the browser's
// built-in execCommand, which is deprecated but still broadly supported
// for this exact use case and is overkill to replace with a full editor
// library for a single admin's short notes.
export default function NoteRichTextEditor({ value, onChange, placeholder }: NoteRichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (ref.current && !isFocused.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    ref.current?.focus();
    document.execCommand(command, false, commandValue);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 p-1.5">
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.command + (btn.value ?? "")}
            type="button"
            title={btn.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand(btn.command, btn.value)}
            className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 ${btn.className ?? ""}`}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => (isFocused.current = true)}
        onBlur={() => (isFocused.current = false)}
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[4.5rem] px-3 py-2 text-sm text-slate-900 focus:outline-none [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}
