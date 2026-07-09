import { useEffect, useRef, useState, type ReactNode } from "react";
import { clampNonNegative } from "../lib/analytics";

/* measure container width for responsive, crisp SVG charts */
export function useMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(cw);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

interface Series {
  name: string;
  color: string;
  values: number[];
}

export function LineAreaChart({
  labels,
  series,
  height = 210,
  formatY,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  formatY?: (v: number) => string;
}) {
  const { ref, width } = useMeasure();
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const padL = 40;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const W = Math.max(width, 240);
  const H = height;
  const innerW = clampNonNegative(W - padL - padR);
  const innerH = clampNonNegative(H - padT - padB);

  const allVals = series.flatMap((s) => s.values);
  const rawMax = Math.max(1, ...allVals);
  const rawMin = Math.min(0, ...allVals);
  const max = Math.ceil(rawMax / 100) * 100 || rawMax;
  const min = rawMin < 0 ? Math.floor(rawMin / 100) * 100 || rawMin : 0;
  const range = max - min;

  const xAt = (i: number) =>
    padL + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const yAt = (v: number) => {
    const val = range === 0 ? 0 : ((v - min) / range) * innerH;
    return padT + innerH - val;
  };

  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => min + (range / ticks) * i);

  // Build a smooth (catmull-rom → bezier) path through points.
  const smoothPath = (pts: [number, number][]) => {
    if (pts.length < 2) return `M ${pts[0]?.[0] ?? 0},${pts[0]?.[1] ?? 0}`;
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  };

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={W}
        height={H}
        className="overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.name} id={`grad-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* horizontal grid + y labels */}
        {gridY.map((g, i) => {
          const y = yAt(g);
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} className="stroke-line" strokeWidth={1} strokeDasharray={i === 0 ? "0" : "4 5"} />
              <text x={padL - 9} y={y + 3} textAnchor="end" className="fill-faint" fontSize={9}>
                {formatY ? formatY(g) : Math.round(g)}
              </text>
            </g>
          );
        })}

        {/* Zero baseline */}
        {min < 0 && (
          <line
            x1={padL}
            x2={W - padR}
            y1={yAt(0)}
            y2={yAt(0)}
            className="stroke-rose-400/50 dark:stroke-rose-500/40"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        )}

        {/* series (area + smooth line + dots) */}
        {series.map((s, si) => {
          const pts = s.values.map((v, i): [number, number] => [xAt(i), yAt(v)]);
          const line = smoothPath(pts);
          const baseY = padT + innerH;
          const area = `${line} L ${pts[pts.length - 1][0]},${baseY} L ${pts[0][0]},${baseY} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={`url(#grad-${si})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={hover?.i === i ? 4.5 : 3} fill="#fff" stroke={s.color} strokeWidth={2} style={{ transition: "r 0.15s" }} />
              ))}
            </g>
          );
        })}

        {/* hover guide */}
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={padT} y2={padT + innerH} stroke={getComputedStyle(document.documentElement).getPropertyValue("--color-brand-400")} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        )}

        {/* x labels + hover hit-areas */}
        {labels.map((l, i) => (
          <g key={i}>
            <text x={xAt(i)} y={H - 9} textAnchor="middle" className="fill-faint" fontSize={9}>
              {l}
            </text>
            <rect x={xAt(i) - innerW / labels.length / 2} y={padT} width={innerW / labels.length} height={innerH} fill="transparent" onMouseEnter={() => setHover({ i, x: xAt(i) })} />
          </g>
        ))}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] shadow-lg"
          style={{ left: hover.x, top: yAt(Math.max(...series.map((s) => s.values[hover.i] ?? 0))) }}
        >
          <p className="mb-0.5 font-semibold text-ink">{labels[hover.i]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}: <span className="font-semibold text-ink">{formatY ? formatY(s.values[hover.i] ?? 0) : s.values[hover.i]}</span>
            </p>
          ))}
        </div>
      )}

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 200,
  color = "#6366f1",
  formatVal,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatVal?: (v: number) => string;
}) {
  const { ref, width } = useMeasure();
  const padL = 30;
  const padR = 10;
  const padT = 16;
  const padB = 28;
  const W = Math.max(width, 220);
  const H = height;
  const innerW = clampNonNegative(W - padL - padR);
  const innerH = clampNonNegative(H - padT - padB);
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = clampNonNegative((innerW / data.length) * 0.55);
  const step = innerW / Math.max(1, data.length);

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H}>
        {[0, 0.5, 1].map((f, i) => {
          const y = padT + innerH - f * innerH;
          return (
            <line
              key={i}
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              className="stroke-line"
              strokeWidth={1}
              strokeDasharray={i === 2 ? "0" : "3 4"}
            />
          );
        })}
        {data.map((d, i) => {
          const h = clampNonNegative((clampNonNegative(d.value) / max) * innerH);
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + innerH - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={5}
                fill={color}
                opacity={0.9}
              />
              {d.value > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-muted"
                  fontSize={9}
                  fontWeight={600}
                >
                  {formatVal ? formatVal(d.value) : d.value}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-faint"
                fontSize={9}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Donut({
  value,
  size = 130,
  stroke = 12,
  color = "#6366f1",
  label,
  sublabel,
  children,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  children?: ReactNode;
}) {
  const r = clampNonNegative((size - stroke) / 2);
  const c = 2 * Math.PI * r;
  const pct = clampNonNegative(Math.min(100, Math.max(0, value)));
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-line"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="text-lg font-bold text-ink">{label}</span>
            {sublabel && <span className="text-[10px] text-muted">{sublabel}</span>}
          </>
        )}
      </div>
    </div>
  );
}
