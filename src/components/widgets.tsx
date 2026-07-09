import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";
import { Card } from "./ui";

type Tone = "brand" | "emerald" | "amber" | "rose" | "sky" | "violet";

const toneMap: Record<Tone, string> = {
  brand: "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 dark:from-brand-500/20 dark:to-brand-500/5 dark:text-brand-300",
  emerald: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 dark:from-emerald-500/20 dark:to-emerald-500/5 dark:text-emerald-300",
  amber: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 dark:from-amber-500/20 dark:to-amber-500/5 dark:text-amber-300",
  rose: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600 dark:from-rose-500/20 dark:to-rose-500/5 dark:text-rose-300",
  sky: "bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 dark:from-sky-500/20 dark:to-sky-500/5 dark:text-sky-300",
  violet: "bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 dark:from-violet-500/20 dark:to-violet-500/5 dark:text-violet-300",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "brand",
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: Tone;
  trend?: { value: string; up: boolean };
}) {
  const valueStr = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const len = valueStr.length;

  let fontClass = "text-base min-[360px]:text-lg min-[400px]:text-xl sm:text-2xl md:text-xl lg:text-2xl xl:text-3xl";
  if (len > 15) {
    fontClass = "text-[10px] min-[360px]:text-[11px] min-[400px]:text-xs sm:text-sm md:text-xs lg:text-sm xl:text-base";
  } else if (len > 11) {
    fontClass = "text-xs min-[360px]:text-[13px] min-[400px]:text-sm sm:text-base md:text-sm lg:text-base xl:text-lg";
  } else if (len > 8) {
    fontClass = "text-sm min-[360px]:text-base min-[400px]:text-lg sm:text-xl md:text-lg lg:text-xl xl:text-2xl";
  }

  return (
    <Card className="card-hover p-3 min-[380px]:p-4">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] min-[380px]:text-xs font-medium text-muted" title={label}>{label}</p>
          <p className={cn("mt-1 font-bold tracking-tight text-ink whitespace-nowrap truncate leading-tight", fontClass)} title={valueStr || undefined}>{value}</p>
          {sub && <p className="mt-1 truncate text-[10px] min-[380px]:text-[11px] text-faint">{sub}</p>}
        </div>
        <div className={cn("flex h-8 w-8 min-[380px]:h-10 min-[380px]:w-10 shrink-0 items-center justify-center rounded-lg min-[380px]:rounded-xl ring-1 ring-black/[0.02] transition-transform group-hover:scale-110", toneMap[tone])}>
          <Icon className="h-4 w-4 min-[380px]:h-5 min-[380px]:w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold">
          {trend.up ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
          )}
          <span className={trend.up ? "text-emerald-600" : "text-rose-600"}>{trend.value}</span>
        </div>
      )}
    </Card>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
