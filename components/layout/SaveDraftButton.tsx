import { useEffect, useState } from "react";

interface SaveDraftButtonProps {
  onSave: () => Promise<void>;
  disabled: boolean;
}

export default function SaveDraftButton({ onSave, disabled }: SaveDraftButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleClick() {
    setStatus("saving");
    try {
      await onSave();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === "saving"}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved ✓"}
      {status === "error" && "Save failed — retry"}
      {status === "idle" && "Save as Draft"}
    </button>
  );
}
