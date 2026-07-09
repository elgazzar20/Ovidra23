import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { X, Check, ChevronDown, Search, Plus } from "lucide-react";
import { cn } from "../utils/cn";

/* --------------------------------- hook --------------------------------- */
function useClickOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOut]);
  return ref;
}

/* -------------------------------- Button -------------------------------- */
type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-brand-500 to-brand-700 text-white hover:from-brand-500 hover:to-brand-800 shadow-[var(--shadow-brand)]",
  secondary: "bg-elevated text-ink hover:bg-line border border-line",
  ghost: "text-muted hover:bg-elevated hover:text-ink",
  outline: "border border-line text-ink hover:bg-elevated",
  danger: "bg-gradient-to-br from-rose-500 to-rose-700 text-white hover:to-rose-800 shadow-[0_10px_24px_-10px_rgba(244,63,94,0.5)]",
  subtle:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "relative inline-flex select-none items-center justify-center overflow-hidden rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/* --------------------------------- Card --------------------------------- */
export function Card({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* -------------------------------- Inputs -------------------------------- */
const fieldBase =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:bg-elevated";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "resize-none", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, "cursor-pointer appearance-none pe-8 cp-select", className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && (
        <span className="flex items-center gap-1 text-xs font-medium text-muted">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-[11px] font-medium text-rose-500">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "start-[1.15rem]" : "start-0.5",
          )}
        />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </button>
  );
}

/* -------------------------------- Badge --------------------------------- */
type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet";
const tones: Record<Tone, string> = {
  neutral: "bg-elevated text-muted",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------- Responsive Modal ---------------------------- */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Lock scroll AND compensate the scrollbar width so the page doesn't
    // shift horizontally when the scrollbar disappears (no "shake").
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    document.documentElement.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = prevPad;
      document.documentElement.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  // Render through a portal at document.body so the modal always escapes any
  // transformed ancestor (e.g. the page's fade-in animation) that would trap
  // `position: fixed` and place the dialog in the wrong spot.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center sm:items-center sm:p-4">
      {/* solid overlay (no blur) avoids repaint flicker */}
      <div className="animate-overlay absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-modal relative flex h-full w-full flex-col overflow-hidden border border-line bg-surface shadow-[var(--shadow-lg)] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl",
          widths[size],
        )}
      >
        {/* top accent line */}
        <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-accent-500 to-brand-400" />
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="space-y-0.5">
              {title && <h3 className="text-base font-bold tracking-tight text-ink">{title}</h3>}
              {description && <p className="text-xs text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-elevated/50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------- Searchable Combobox -------------------------- */
/** Single-select combobox with search + optional custom-add. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
  renderOption,
  emptyLabel,
  addLabel,
  searchLabel,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  allowCustom?: boolean;
  renderOption?: (o: { value: string; label: string }) => ReactNode;
  emptyLabel?: string;
  addLabel?: string;
  searchLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(q.toLowerCase().trim()),
  );
  const trimmed = q.trim();
  const exists = options.some(
    (o) => o.value.toLowerCase() === trimmed.toLowerCase() || o.label.toLowerCase() === trimmed.toLowerCase(),
  );
  const canAdd = allowCustom && trimmed.length > 1 && !exists;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(fieldBase, "flex items-center justify-between gap-2 text-start", disabled && "opacity-50")}
      >
        <span className={cn("truncate", !selected && "text-faint")}>
          {selected ? (renderOption ? renderOption(selected) : selected.label) : (placeholder ?? "—")}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-faint transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-scale-in absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchLabel ?? "Search…"}
                className="w-full rounded-md border border-line bg-surface py-1.5 ps-8 pe-2 text-sm text-ink focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 && !canAdd && (
              <p className="px-3 py-4 text-center text-xs text-faint">{emptyLabel ?? "No matches"}</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm text-ink hover:bg-elevated"
              >
                <span className="truncate">{renderOption ? renderOption(o) : o.label}</span>
                {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={() => { onChange(trimmed); setOpen(false); setQ(""); }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-start text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
              >
                <Plus className="h-4 w-4" />
                {addLabel ?? "Add"} "{trimmed}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Multi-Combobox ---------------------------- */
/** Multi-select combobox with search + custom-add + "select all". */
export function MultiCombobox({
  selected,
  onChange,
  options,
  placeholder,
  searchLabel,
  selectedLabel,
  emptyLabel,
  allowCustom = false,
  addLabel = "Add",
  className,
  disabled,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchLabel?: string;
  selectedLabel?: (n: number) => string;
  emptyLabel?: string;
  allowCustom?: boolean;
  addLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const trimmed = q.trim();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(trimmed.toLowerCase()));
  const exists =
    options.some((o) => o.value.toLowerCase() === trimmed.toLowerCase()) ||
    selected.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const canAdd = allowCustom && trimmed.length > 1 && !exists;
  const label =
    selected.length === 0
      ? (placeholder ?? "—")
      : selectedLabel
        ? selectedLabel(selected.length)
        : `${selected.length} selected`;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(fieldBase, "flex items-center justify-between gap-2 text-start", disabled && "opacity-50")}
      >
        <span className={cn("truncate", selected.length === 0 && "text-faint")}>{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-faint transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-scale-in absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
          <div className="space-y-2 border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchLabel ?? "Search…"}
                className="w-full rounded-md border border-line bg-surface py-1.5 ps-8 pe-2 text-sm text-ink focus:outline-none"
              />
            </div>
            {options.length > 0 && (
              <div className="flex justify-between px-1">
                <button type="button" onClick={() => onChange(options.map((o) => o.value))} className="text-[11px] font-medium text-brand-600 hover:underline">
                  {addLabelAll()}
                </button>
                <button type="button" onClick={() => onChange([])} className="text-[11px] font-medium text-muted hover:underline">
                  {clearLabel()}
                </button>
              </div>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-faint">{emptyLabel ?? "No matches"}</p>
            )}
            {filtered.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-sm text-ink hover:bg-elevated"
                >
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-brand-500 bg-brand-500 text-white" : "border-faint")}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
            {canAdd && (
              <button
                type="button"
                onClick={() => { onChange([...selected, trimmed]); setQ(""); }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-start text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
              >
                <Plus className="h-4 w-4" />
                {addLabel} "{trimmed}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function addLabelAll() { return "Select all"; }
function clearLabel() { return "Clear"; }

/* ------------------------------ Page header ----------------------------- */
export function PageHeader({
  title,
  subtitle,
  actions,
  onBack,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronDown className="h-5 w-5 rotate-90 rtl:-rotate-90" />
          </Button>
        )}
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------ Empty state ----------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-elevated/40 px-6 py-14 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-elevated text-faint">{icon}</div>
      )}
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- Tabs --------------------------------- */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-elevated/60 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
            active === tab.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Avatar -------------------------------- */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white",
        className,
      )}
    >
      {initials}
    </div>
  );
}

/* ---------------------------- Toast system ------------------------------ */
type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}
let toastId = 0;
const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

export function pushToast(message: string, kind: ToastKind = "success") {
  const t: Toast = { id: ++toastId, message, kind };
  toasts = [...toasts, t];
  listeners.forEach((l) => l(toasts));
  window.setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    listeners.forEach((l) => l(toasts));
  }, 3000);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-fade-in pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg",
            t.kind === "success" && "bg-emerald-600",
            t.kind === "error" && "bg-rose-600",
            t.kind === "info" && "bg-brand-600",
          )}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25">
            {t.kind === "error" ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/** Small labelled filter dropdown used in filter toolbars. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const cb = useCallback((v: string) => onChange(v), [onChange]);
  return (
    <div className="flex items-center gap-2">
      {label && <span className="whitespace-nowrap text-xs text-faint">{label}</span>}
      <Select value={value} onChange={(e) => cb(e.target.value)} className="h-9 w-auto py-1.5 text-xs">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );
}
