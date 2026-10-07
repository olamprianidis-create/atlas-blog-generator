import { useEffect, useRef, useState } from "react";

// Measures a container so charts draw at real pixel size (a stretched
// viewBox would scale axis text up with the chart).
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
