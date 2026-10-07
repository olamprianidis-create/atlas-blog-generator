import { useState } from "react";
import Link from "next/link";
import { CampaignOverview, formatPercent } from "../../../utils/emailAnalyticsShared";
import { useWidth } from "./useWidth";

// Click rate per sent campaign (oldest → newest) against the pooled
// all-campaign average. Single series: no legend, the title names it.
const COLOR = "#2a78d6";
const H = 160;
// Right padding holds the average line's label, clear of bars and tooltip.
const PAD = { top: 12, right: 92, bottom: 8, left: 40 };

export default function CampaignTrendChart({ overview }: { overview: CampaignOverview }) {
  const [containerRef, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const points = overview.series.filter((s) => s.rates.clickRate !== null);
  if (points.length === 0) return null;

  const average = overview.rates.clickRate ?? 0;
  const max = Math.max(0.05, ...points.map((p) => p.rates.clickRate ?? 0), average) * 1.15;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / points.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div ref={containerRef} className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Click rate by campaign">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
              {formatPercent(t, 0)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const value = p.rates.clickRate ?? 0;
          const cx = PAD.left + band * i + band / 2;
          const top = y(value);
          const h = Math.max(PAD.top + innerH - top, 0);
          const r = Math.min(4, h);
          return (
            <Link key={p.id} href={`/email/campaigns/${p.id}/report`}>
              {/* hit target: the whole band, taller than the bar */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${p.subject}: ${formatPercent(value)} click rate`}
              />
              {/* 4px rounded data-end, square at the baseline */}
              <path
                d={`M${cx - barW / 2},${top + h} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${top + h} Z`}
                fill={COLOR}
                opacity={hover === null || hover === i ? 1 : 0.55}
                className="pointer-events-none"
              />
            </Link>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(average)} y2={y(average)} stroke="#0b0b0b" strokeWidth={1} />
        <text x={W - PAD.right + 8} y={y(average)} dy="-0.2em" className="fill-slate-700 text-[10px] font-medium">
          Your average
        </text>
        <text x={W - PAD.right + 8} y={y(average)} dy="1.1em" className="fill-slate-500 text-[10px] tabular-nums">
          {formatPercent(average)}
        </text>
      </svg>
      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`,
            transform: hover > points.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="font-semibold text-slate-900 tabular-nums">{formatPercent(hovered.rates.clickRate)} click rate</p>
          <p className="truncate text-slate-600">{hovered.subject || "Untitled campaign"}</p>
          <p className="text-slate-400">{new Date(hovered.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
      )}
    </div>
  );
}
