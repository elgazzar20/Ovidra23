import { LayoutGrid, Table2, Rows3 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../utils/cn";

export type ViewMode = "grid" | "table" | "compact";

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useApp();
  const modes: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: "grid", label: t("view.grid"), icon: LayoutGrid },
    { id: "table", label: t("view.table"), icon: Table2 },
    { id: "compact", label: t("view.compact"), icon: Rows3 },
  ];
  return (
    <div className="inline-flex rounded-lg border border-line bg-elevated/60 p-0.5">
      {modes.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={m.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
              active ? "bg-surface text-brand-600 shadow-sm dark:bg-surface-2" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
