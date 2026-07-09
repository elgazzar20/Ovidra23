import { ChevronLeft, ShieldCheck, Cloud, Lock, KeyRound, Database } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card } from "../components/ui";

export function Features({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const items = [
    {
      icon: ShieldCheck, gradient: "from-emerald-500 to-emerald-700",
      head: t("features.privacyHead"), body: t("features.privacyBody"),
    },
    {
      icon: Cloud, gradient: "from-brand-500 to-brand-700",
      head: t("features.localHead"), body: t("features.localBody"),
    },
    {
      icon: KeyRound, gradient: "from-violet-500 to-violet-700",
      head: t("features.rbacHead"), body: t("features.rbacBody"),
    },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-3xl space-y-5">
        <Button variant="secondary" onClick={onClose} className="mb-2">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />{t("action.back")}
        </Button>

        <Card className="mesh-brand relative overflow-hidden border-0 p-8 text-center text-white shadow-[var(--shadow-brand)]">
          <div className="orb float-soft -right-8 -top-10 h-40 w-40 bg-white/12" />
          <div className="orb float-soft -bottom-16 left-1/3 h-44 w-44 bg-accent-400/20" style={{ animationDelay: "1s" }} />
          <div className="relative">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold">{t("features.title")}</h1>
            <p className="mt-1 text-sm text-white/80">{t("features.tagline")}</p>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <Card key={i} className="card-hover p-5">
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${it.gradient} text-white shadow-lg`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-ink">{it.head}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{it.body}</p>
              </Card>
            );
          })}
        </div>

        <Card className="flex items-center gap-3 border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <Database className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300">{t("privacy.local")}</p>
        </Card>
        <Card className="flex items-center gap-3 border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <Lock className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300">{t("privacy.unique")}</p>
        </Card>
      </div>
    </div>
  );
}
