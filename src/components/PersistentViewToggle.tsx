import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { Pin, X } from "lucide-react";

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function savePref<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/**
 * View-mode state that remembers the user's PINNED preference per section
 * (students / teachers / classes / schedule / exams…). When the user picks a
 * view that differs from the pinned one, a small "Pin this view?" prompt asks
 * whether to make it the default for THIS section only.
 */
export function usePersistentView(section: string, defaultView: ViewMode = "table") {
  const { t } = useApp();
  const key = `cpd_view_${section}`;
  const [view, setView] = useState<ViewMode>(() => loadPref<ViewMode>(key, defaultView));
  const pinned = useRef<ViewMode>(loadPref<ViewMode>(key, defaultView));
  const [showPin, setShowPin] = useState(false);
  const pinTimer = useRef<number | null>(null);

  const change = (v: ViewMode) => {
    setView(v);
    // Auto-persist the view choice per-section so it's always remembered.
    savePref(key, v);
    pinned.current = v;
    if (v !== pinned.current) {
      setShowPin(true);
      if (pinTimer.current) window.clearTimeout(pinTimer.current);
      pinTimer.current = window.setTimeout(() => setShowPin(false), 7000);
    } else {
      setShowPin(false);
    }
  };

  const pin = () => {
    savePref(key, view);
    pinned.current = view;
    setShowPin(false);
  };
  const dismiss = () => setShowPin(false);

  useEffect(() => () => { if (pinTimer.current) window.clearTimeout(pinTimer.current); }, []);

  return { view, change, showPin, pin, dismiss, t };
}

/** View toggle with an attached "Pin this view?" mini-prompt. */
export function PersistentViewToggle({ section, defaultView }: { section: string; defaultView?: ViewMode }) {
  const { view, change, showPin, pin, dismiss, t } = usePersistentView(section, defaultView);
  return (
    <div className="relative">
      <ViewToggle value={view} onChange={change} />
      {showPin && (
        <div className="animate-scale-in absolute end-0 top-11 z-30 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">
          <span className="whitespace-nowrap text-[11px] font-medium text-ink">{t("view.pinAsk")}</span>
          <button onClick={pin} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-brand-700">
            <Pin className="h-3 w-3" />{t("view.pin")}
          </button>
          <button onClick={dismiss} className="rounded-md p-1 text-muted hover:bg-elevated">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
