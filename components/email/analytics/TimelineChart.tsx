import { useState } from "react";
import { TimelineBucket } from "../../../utils/emailAnalyticsShared";
import { useWidth } from "./useWidth";

// Two-series line chart: people opening / clicking for the first time per
// hour (first 72h) or per day. Same unit on both, so one y-axis.
// Colors are the dataviz reference slots 1 & 2, validated on white.
const SERIES = [
  { key: "opens" as const, label: "First opens", color: "#2a78d6" },
  { key: "clicks" as const, label: "First clicks", color: "#eb6834" },
];

const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / step) * step;
}

function formatBucket(iso: string, granularity: "hour" | "day"): string {
  const d = new Date(iso);
  return granularity === "hour"
    ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TimelineChart({ buckets, granularity }: { buckets: TimelineBucket[]; granularity: "hour" | "day" }) {
  const [containerRef, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const max = niceMax(Math.max(1, ...buckets.map((b) => Math.max(b.opens, b.clicks))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(W / 110))));

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.left) / innerW;
    setHover(Math.min(buckets.length - 1, Math.max(0, Math.round(ratio * (buckets.length - 1)))));
  }

  const hovered = hover !== null ? buckets[hover] : null;

  return (
    <div ref={containerRef}>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <button type="button" onClick={() => setShowTable((v) => !v)} className="ml-auto text-slate-500 underline hover:text-slate-900">
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{granularity === "hour" ? "Hour" : "Day"}</th>
                <th className="px-3 py-2 font-medium">First opens</th>
                <th className="px-3 py-2 font-medium">First clicks</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.start} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-600">{formatBucket(b.start, granularity)}</td>
                  <td className="px-3 py-1.5 text-slate-900">{b.opens}</td>
                  <td className="px-3 py-1.5 text-slate-900">{b.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block touch-none"
            role="img"
            aria-label={`First opens and clicks per ${granularity}`}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
                  {Number.isInteger(t) ? t : t.toFixed(1)}
                </text>
              </g>
            ))}
            {buckets.map((b, i) =>
              i % labelEvery === 0 ? (
                <text key={b.start} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {formatBucket(b.start, granularity)}
                </text>
              ) : null
            )}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#898781" strokeWidth={1} />}
            {SERIES.map((s) => (
              <g key={s.key}>
                <polyline
                  points={buckets.map((b, i) => `${x(i)},${y(b[s.key])}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {hover !== null && (
                  <circle cx={x(hover)} cy={y(buckets[hover][s.key])} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2} />
                )}
              </g>
            ))}
          </svg>
          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: x(hover) > W * 0.65 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              }}
            >
              <p className="mb-1 text-slate-500">{formatBucket(hovered.start, granularity)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} />
                  <span className="font-semibold text-slate-900 tabular-nums">{hovered[s.key]}</span>
                  <span className="text-slate-500">{s.label.toLowerCase()}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
