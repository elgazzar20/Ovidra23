import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  FileText,
  BarChart3,
  MessageSquare,
  Sparkles,
  UserCog,
  Settings as SettingsIcon,
  Cloud,
  CloudOff,
  RefreshCw,
  Sun,
  Moon,
  Languages,
  LogOut,
  Lock,
  Menu,
  X,
  Check,
  Crown,
  ArrowRight,
  Building2,
  ChevronDown,
  CreditCard,
  ScanLine,
  LifeBuoy,
  AlertTriangle,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { useApp, type Permission } from "../context/AppContext";
import { cn } from "../utils/cn";
import { Avatar, pushToast } from "./ui";
import { OvidraLogo } from "./OvidraLogo";
import { NotificationBell } from "./NotificationBell";

export interface NavItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  section: "management" | "operations" | "insights";
  perm?: Permission;
  /** Show only for non-owner staff (secretary/admin/teacher). */
  staffOnly?: boolean;
  /** Feature gate key — hidden if subscription doesn't include it */
  featureGate?: string;
}

export const NAV: NavItem[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, section: "management" },
  { id: "branches", labelKey: "branch.title", icon: Building2, section: "management", perm: "settings.manage", featureGate: "multi_branch" },
  { id: "students", labelKey: "nav.students", icon: GraduationCap, section: "management", perm: "students.manage" },
  { id: "idcards", labelKey: "nav.idcards", icon: CreditCard, section: "management", perm: "students.manage" },
  { id: "teachers", labelKey: "nav.teachers", icon: Users, section: "management", perm: "teachers.manage" },
  { id: "classes", labelKey: "nav.classes", icon: Boxes, section: "management", perm: "classes.manage" },
  { id: "schedule", labelKey: "nav.schedule", icon: CalendarDays, section: "operations", perm: "schedule.manage" },
  { id: "attendance", labelKey: "nav.attendance", icon: ClipboardCheck, section: "operations", perm: "attendance.manage" },
  { id: "smart-attendance", labelKey: "nav.smartAttendance", icon: ScanLine, section: "operations", perm: "attendance.manage", featureGate: "smart_attendance" },
  { id: "finance", labelKey: "nav.finance", icon: Wallet, section: "operations", perm: "finance.manage" },
  { id: "exams", labelKey: "nav.exams", icon: FileText, section: "operations", perm: "exams.manage" },
  { id: "reports", labelKey: "reports.title", icon: BarChart3, section: "insights", perm: "reports.view" },
  { id: "messages", labelKey: "messages.title", icon: MessageSquare, section: "insights", staffOnly: true },
  { id: "staff", labelKey: "staff.title", icon: UserCog, section: "insights", perm: "staff.manage", featureGate: "staff_management" },
  { id: "ai", labelKey: "nav.aiAssistant", icon: Sparkles, section: "insights", perm: "ai.use", featureGate: "ai_assistant" },
  { id: "tickets", labelKey: "nav.supportTickets", icon: LifeBuoy, section: "insights" },
  { id: "settings", labelKey: "nav.settings", icon: SettingsIcon, section: "insights" },
];

const SECTION_KEYS = {
  management: "nav.groupSection",
  operations: "nav.opsSection",
  insights: "nav.intelSection",
} as const;

function BranchSwitcher() {
  const { db, t, currentBranchId, switchBranch } = useApp();
  const [open, setOpen] = useState(false);
  const current = db.branches.find((b) => b.id === currentBranchId) ?? db.branches[0];

  return (
    <div className="px-3 py-1">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-elevated/50 px-3 py-2 text-start transition hover:border-brand-300"
        >
          <Building2 className="h-4 w-4 shrink-0 text-brand-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-ink">{current?.name ?? t("branch.main")}</p>
            <p className="text-[9px] text-faint">{t("branch.title")}</p>
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-faint transition", open && "rotate-180")} />
        </button>
        {open && (
          <div className="animate-scale-in absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
            {db.branches.map((b) => {
              const active = b.id === currentBranchId;
              return (
                <button
                  key={b.id}
                  onClick={() => { switchBranch(b.id); setOpen(false); }}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-start text-xs transition", active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "hover:bg-elevated")}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate font-medium">{b.name}</span>
                  {b.isMain && <span className="rounded bg-brand-100 px-1 py-0.5 text-[8px] font-bold text-brand-600 dark:bg-brand-500/20">{t("branch.main")}</span>}
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function Layout({
  current,
  onNavigate,
  children,
}: {
  current: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  const { t, user, db, online, setOnline, syncStatus, pendingCount, lastSync, lang, toggleLang, theme, toggleTheme, signOut, can, canUseFeature, flushNow, globalSettings, subscriptionPlan, subscriptionEndDate, isSubscriptionExpired } =
    useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const items = NAV.filter((n) => {
    if (n.perm && !can(n.perm)) return false;
    // "staffOnly" items show for non-owner, non-parent staff only
    if (n.staffOnly) return !!user && user.role !== "OWNER" && user.role !== "PARENT";

    // Hide item if disabled globally by Super Admin
    if (globalSettings?.features) {
      if (n.id === "ai" && globalSettings.features.aiFeatures === false) return false;
      if (n.id === "smart-attendance" && globalSettings.features.smartAttendance === false) return false;
      if (n.id === "reports" && globalSettings.features.reports === false) return false;
      if (n.id === "messages" && globalSettings.features.notifications === false) return false;
    }

    return true;
  });
  const sections: NavItem["section"][] = ["management", "operations", "insights"];

  const go = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const sidebar = (
    <div className="flex h-full w-[266px] flex-col border-e border-line bg-surface/95 backdrop-blur-xl">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 py-4">
        <OvidraLogo theme={theme} size="md" className="shrink-0 select-none" />
        <button
          className="ms-auto rounded-lg p-1.5 text-muted hover:bg-elevated lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* branch switcher */}
      {db.branches.length > 1 && (
        <BranchSwitcher />
      )}

      {/* nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {sections.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (!sectionItems.length) return null;
          return (
            <div key={section}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
                {t(SECTION_KEYS[section])}
              </p>
              <div className="space-y-0.5">
                {sectionItems.map((item) => {
                  const active = current === item.id;
                  const Icon = item.icon;
                  const isLocked = item.featureGate && !canUseFeature(item.featureGate);
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.id)}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                        active
                          ? "bg-gradient-to-br from-brand-500/12 to-accent-500/10 text-brand-700 ring-1 ring-brand-500/15 dark:from-brand-500/20 dark:to-accent-500/15 dark:text-brand-200"
                          : "text-muted hover:bg-elevated hover:text-ink",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
                      )}
                      <Icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", active && "text-brand-600 dark:text-brand-300")} />
                      <span className="truncate flex-1 text-start">{t(item.labelKey)}</span>
                      {isLocked && <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0 ms-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Upgrade CTA */}
      <div className="px-3 pb-2">
        <button
          onClick={() => onNavigate("upgrade")}
          className="group flex w-full items-center gap-2.5 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-2.5 text-start transition hover:shadow-md dark:border-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
            <Crown className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-amber-700 dark:text-amber-300">{lang === "ar" ? "ترقية للاحترافي" : "Upgrade to Pro"}</p>
            <p className="truncate text-[9px] text-amber-600/70 dark:text-amber-400/60">{lang === "ar" ? "مميزات غير محدودة" : "Unlimited features"}</p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500 rtl:rotate-180" />
        </button>
      </div>

      {/* sync engine status */}
      <div className="px-3 pb-2">
        <div className="rounded-xl border border-line bg-elevated/60 p-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                online ? "bg-emerald-500 live-dot" : "bg-amber-500",
              )}
            />
            <span className="text-xs font-medium text-ink">
              {syncStatus === "syncing"
                ? t("status.syncing")
                : online
                  ? t("status.cloudConnected")
                  : t("status.localOnly")}
            </span>
            <button
              onClick={() => setOnline(!online)}
              className="ms-auto rounded-md p-1 text-muted hover:bg-surface hover:text-ink"
              title={online ? t("status.online") : t("status.offline")}
            >
              {online ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1 px-0.5 text-[10px] text-faint">
            {pendingCount > 0
              ? `${pendingCount} ${t("status.queued")}`
              : `${t("status.lastSync")}: ${timeAgo(lastSync, lang)}`}
          </p>
          {online && (
            <button
              onClick={() => {
                flushNow();
                pushToast(
                  lang === "ar"
                    ? "تم إرسال ومزامنة كافة التحديثات والعمليات الجارية بنجاح مع السحابة الخاصة بك"
                    : "All updates and pending operations synchronized successfully with your private cloud",
                  "success"
                );
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500/10 py-1.5 text-[10px] font-extrabold text-brand-600 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300 dark:hover:bg-brand-500/30 cursor-pointer transition active:scale-[0.98]"
            >
              <RefreshCw className={cn("h-3 w-3", syncStatus === "syncing" && "animate-spin")} />
              {lang === "ar" ? "مزامنة السجلات الآن" : "Sync Records Now"}
            </button>
          )}
        </div>
      </div>

      {/* user */}
      {user && (
        <div className="flex items-center gap-2.5 border-t border-line px-3 py-2.5">
          <Avatar name={user.displayName} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">{user.displayName}</p>
            <p className="truncate text-[11px] text-muted">{t(`role.${user.role}`)}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-rose-600"
            title={t("action.close")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* desktop sidebar */}
      {sidebarOpen && <aside className="hidden lg:block">{sidebar}</aside>}

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="animate-fade-in absolute inset-y-0 start-0">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/70 px-4 backdrop-blur-xl">
          <button
            className="rounded-lg p-2 text-muted hover:bg-elevated lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* desktop sidebar toggle */}
          <button
            className="hidden lg:inline-flex rounded-lg p-2 text-muted hover:bg-elevated cursor-pointer transition active:scale-95"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={lang === "ar" ? "إظهار/إخفاء القائمة الجانبية" : "Toggle Sidebar"}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <OvidraLogo theme={theme} size="md" className="shrink-0 select-none" />
          </div>

          <div className="ms-auto flex items-center gap-1">
            <NotificationBell />
            <a
              href="https://t.me/BooksPddf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-[#0088cc] hover:bg-elevated hover:scale-105 transition"
              title={lang === "ar" ? "تابعنا على تليجرام" : "Follow us on Telegram"}
            >
              <svg className="h-4.5 w-4.5 fill-currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.18-.08-.04-.19-.01-.27.01-.12.02-1.95 1.23-5.5 3.62-.52.36-.97.53-1.35.52-.42-.01-1.22-.24-1.82-.44-.73-.24-1.31-.37-1.26-.78.03-.22.33-.44.9-.67 3.52-1.53 5.87-2.54 7.05-3.03 3.35-1.39 4.04-1.63 4.5-.16.1.48.07.97-.04 1.48z"/>
              </svg>
            </a>
            <button
              onClick={toggleLang}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink hover:bg-elevated"
              title="Language"
            >
              <Languages className="h-4 w-4" />
              {lang === "en" ? "ع" : "EN"}
            </button>
            <button
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-elevated"
              title="Theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setOnline(!online)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-elevated",
                online ? "text-emerald-600" : "text-amber-600",
              )}
              title="Sync"
            >
              {syncStatus === "syncing" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : online ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <CloudOff className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{online ? t("status.online") : t("status.offline")}</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 cursor-pointer transition active:scale-95"
              title={lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {!online && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CloudOff className="h-4 w-4 shrink-0 animate-pulse text-amber-500" />
              <span>
                {lang === "ar"
                  ? "تنبيه: أنت تعمل في وضع الأوفلاين (بدون إنترنت). البيانات يتم حفظها محلياً على هذا الجهاز ولن يتم حفظها على السحابة حتى يتوفر اتصال بالإنترنت."
                  : "Notice: You are in offline mode. Data is saved locally on this device and will not be backed up to the cloud until connection is restored."}
              </span>
            </div>
            <button
              onClick={() => setOnline(true)}
              className="text-[10px] font-extrabold bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 rounded-md transition cursor-pointer"
            >
              {lang === "ar" ? "إعادة الاتصال" : "Connect"}
            </button>
          </div>
        )}

        {(() => {
          const daysRemaining = subscriptionEndDate ? Math.ceil((subscriptionEndDate - Date.now()) / (1000 * 60 * 60 * 24)) : null;
          const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
          const isExpired = isSubscriptionExpired || (daysRemaining !== null && daysRemaining < 0);
          
          if (isExpired && subscriptionPlan !== "free") {
            return (
              <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-rose-700 dark:text-rose-400">
                <div className="flex items-center gap-2 text-xs font-semibold animate-pulse">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>
                    {lang === "ar"
                      ? `انتهت صلاحية اشتراكك في باقة (${subscriptionPlan === "enterprise" ? "مؤسسي" : "احترافي"})! الرجاء تجديد الاشتراك لتجنب إيقاف المميزات وتفعيل وضع القراءة فقط.`
                      : `Your subscription for (${subscriptionPlan}) plan has expired! Please renew to avoid service disruption.`}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("upgrade")}
                  className="text-[10px] font-extrabold bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  {lang === "ar" ? "تجديد الآن" : "Renew Now"}
                </button>
              </div>
            );
          }
          if (isExpiringSoon && subscriptionPlan !== "free") {
            return (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Clock className="h-4 w-4 shrink-0 text-amber-500 animate-pulse" />
                  <span>
                    {lang === "ar"
                      ? `ينتهي اشتراك باقة (${subscriptionPlan === "enterprise" ? "مؤسسي" : "احترافي"}) قريباً خلال ${daysRemaining} أيام! يرجى تجديد اشتراكك لضمان عدم توقف الخدمات.`
                      : `Your (${subscriptionPlan}) subscription is expiring in ${daysRemaining} days! Please renew to prevent interruption.`}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("upgrade")}
                  className="text-[10px] font-extrabold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  {lang === "ar" ? "تجديد الاشتراك" : "Renew Now"}
                </button>
              </div>
            );
          }
          return null;
        })()}

        <main className="cp-scroll flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function timeAgo(ts: number, lang: string) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return lang === "ar" ? "الآن" : "now";
  if (s < 60) return lang === "ar" ? `قبل ${s}ث` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return lang === "ar" ? `قبل ${m}د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  return lang === "ar" ? `قبل ${h}س` : `${h}h ago`;
}
