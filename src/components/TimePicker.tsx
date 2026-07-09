import { useApp } from "../context/AppContext";
import { splitTime, buildTime, TIME_HOURS, TIME_MINUTES } from "../lib/constants";
import { cn } from "../utils/cn";

/**
 * 12-hour time selector: hour (1-12) · minute · AM/PM (ص / م).
 * Stores "HH:mm" 24h internally for conflict math.
 */
export function TimePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { lang } = useApp();
  const { h, m, period } = splitTime(value || "09:00");
  const isAr = lang === "ar";

  const update = (patch: Partial<{ h: number; m: number; period: "AM" | "PM" }>) =>
    onChange(buildTime(patch.h ?? h, patch.m ?? m, patch.period ?? period));

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <select
        value={h}
        onChange={(e) => update({ h: +e.target.value })}
        className="h-9 w-14 rounded-lg border border-line bg-surface px-1 text-sm text-ink focus:border-brand-400 focus:outline-none"
      >
        {TIME_HOURS.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-faint">:</span>
      <select
        value={m}
        onChange={(e) => update({ m: +e.target.value })}
        className="h-9 w-14 rounded-lg border border-line bg-surface px-1 text-sm text-ink focus:border-brand-400 focus:outline-none"
      >
        {TIME_MINUTES.map((mm) => <option key={mm} value={mm}>{String(mm).padStart(2, "0")}</option>)}
      </select>
      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {(["AM", "PM"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => update({ period: p })}
            className={cn(
              "h-9 px-2 text-xs font-bold transition",
              period === p
                ? "bg-brand-600 text-white"
                : "bg-surface text-muted hover:bg-elevated",
            )}
          >
            {isAr ? (p === "AM" ? "ص" : "م") : p}
          </button>
        ))}
      </div>
    </div>
  );
}
