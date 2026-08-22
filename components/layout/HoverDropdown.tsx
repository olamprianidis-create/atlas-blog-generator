import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Mirrors the ATLAS Website header's hover-dropdown behavior: opens on
// hover, closes 250ms after the pointer leaves both the trigger and the
// (portaled) panel so crossing the gap between them doesn't close it
// early. Portaling to document.body avoids clipping from the header's
// own overflow/stacking context.
export default function HoverDropdown({
  trigger,
  align = "left",
  children,
}: {
  trigger: ReactNode;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 250);
  }

  function handleEnter() {
    cancelClose();
    setOpen(true);
  }

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;

    function updateCoords() {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 4, left: align === "right" ? rect.right : rect.left });
    }

    updateCoords();
    window.addEventListener("resize", updateCoords);
    return () => window.removeEventListener("resize", updateCoords);
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      cancelClose();
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0" onMouseEnter={handleEnter} onMouseLeave={scheduleClose}>
      {trigger}
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            onMouseEnter={handleEnter}
            onMouseLeave={scheduleClose}
            style={{
              position: "fixed",
              top: coords.top,
              left: align === "right" ? undefined : coords.left,
              right: align === "right" ? window.innerWidth - coords.left : undefined,
            }}
            className="z-50"
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
