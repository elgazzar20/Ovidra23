import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, GraduationCap, UserCog, CreditCard, BarChart3,
  ScrollText, Search, LogOut, ShieldCheck, Ban, CheckCircle2, Trash2,
  TrendingUp, DollarSign, AlertCircle, Loader2, RefreshCw, Flag,
  CalendarPlus, Zap, Eye, SlidersHorizontal, Send,
  ArrowLeft, Mail, Crown, Star, MessageSquare, Check, BellRing, LifeBuoy,
  Key, Settings, Sparkles, Gift, Clock, Download, History
} from "lucide-react";
import {
  fetchAllCenters, fetchAuditLogs,
  updateCenterStatus, deleteCenterRecord, toggleFeatureFlag,
  fetchCenterFeatures, updateCenterLimits, sendOwnerMessage,
  applyPlanFeatures, getFeaturesForPlan, syncUsersToCenters,
  grantFreeDays, quickPlanSwitch, fetchTimelineEvents,
  FEATURE_FLAGS, PLAN_DEFINITIONS, DEFAULT_LIMITS,
  type CenterRecord, type AuditLog, type TimelineEvent,
  type AccountStatus, type SubscriptionPlan, type CenterLimits,
} from "../../lib/superadmin";
import { cn } from "../../utils/cn";
import { pushToast } from "../../components/ui";
import { getTestimonials, approveTestimonial, deleteTestimonial, type Testimonial } from "../../lib/testimonials";
import { db as firestoreDb, FIREBASE_ENABLED } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { BiDashboard } from "./BiDashboard";
import { RbacManager } from "./RbacManager";
import { AuditLogCenter } from "./AuditLogCenter";
import { NotificationsTab } from "./NotificationsTab";
import { TicketsTab } from "./TicketsTab";
import { LicensesTab } from "./LicensesTab";
import { GlobalSettingsTab } from "./GlobalSettingsTab";
import { AiCopilotTab } from "./AiCopilotTab";

type Tab = "bi" | "users" | "notifications" | "testimonials" | "rbac" | "audit" | "tickets" | "licenses" | "settings" | "ai_copilot";

/** Gets feature label in Arabic */
function fl(f: { label: string; labelAr: string }) { return f.labelAr; }
function fd(f: { description: string; descriptionAr: string }) { return f.descriptionAr; }

const planLabels: Record<string, string> = { free: "مجاني", basic: "أساسي", pro: "احترافي", enterprise: "مؤسسي", all: "الكل" };

/* ============================== MAIN ============================== */
export function SuperAdminDashboard({
  adminUid,
  adminEmail,
  onSignOut,
}: {
  adminUid: string;
  adminEmail: string;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<Tab>("bi");
  const [centers, setCenters] = useState<CenterRecord[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCenter, setSelectedCenter] = useState<CenterRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const admin = useMemo(() => ({ uid: adminUid, email: adminEmail }), [adminUid, adminEmail]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSyncing(true);
      const result = await syncUsersToCenters(admin);
      if (result.created > 0) setSyncMsg(`تم إنشاء ${result.created} سنتر جديد`);
      setSyncing(false);
    } catch { setSyncing(false); }
    const [c, l] = await Promise.all([fetchAllCenters(), fetchAuditLogs()]);
    setCenters(c);
    setLogs(l);
    setLoading(false);
  }, [admin]);

  useEffect(() => { refresh(); }, [refresh]);

  const nav: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "bi", label: "لوحة التحكم", icon: BarChart3 },
    { id: "users", label: "المستخدمون والاشتراكات", icon: Building2 },
    { id: "notifications", label: "الإشعارات", icon: BellRing },
    { id: "tickets", label: "تذاكر الدعم الفني", icon: LifeBuoy },
    { id: "licenses", label: "التراخيص", icon: Key },
    { id: "testimonials", label: "التقييمات", icon: Star },
    { id: "rbac", label: "الصلاحيات (RBAC)", icon: UserCog },
    { id: "ai_copilot", label: "المساعد الذكي", icon: Sparkles },
    { id: "settings", label: "إعدادات المنصة", icon: Settings },
    { id: "audit", label: "السجلات", icon: ScrollText },
  ];

  if (selectedCenter) {
    return <CenterDetailDrawer center={selectedCenter} admin={admin} onClose={() => setSelectedCenter(null)} onUpdate={refresh} />;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-e border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-600/30">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Super Admin</p>
            <p className="text-[10px] text-muted">Platform Control</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active ? "bg-gradient-to-br from-rose-500/10 to-rose-600/5 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200" : "text-muted hover:bg-elevated hover:text-ink")}>
                <Icon className={cn("h-[18px] w-[18px]", active && "text-rose-600 dark:text-rose-300")} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-elevated/60 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-[10px] font-bold text-white">SA</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{adminEmail}</p>
              <p className="text-[9px] text-muted">Super Admin</p>
            </div>
          </div>
          <button onClick={onSignOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2 md:hidden">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition", tab === n.id ? "bg-rose-600 text-white" : "text-muted")}>
              {n.label}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{nav.find((n) => n.id === tab)?.label}</h1>
              <p className="mt-0.5 text-xs text-muted">{centers.length} سنتر مسجل · إدارة شاملة لمنصة سنتر بلس</p>
            </div>
            <div className="flex items-center gap-2">
              {syncMsg && <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{syncMsg}</span>}
              <button onClick={async () => { setSyncMsg(""); await refresh(); }} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted transition hover:text-ink">
                <RefreshCw className={cn("h-3.5 w-3.5", (loading || syncing) && "animate-spin")} />
                {syncing ? "جارٍ المزامنة..." : "مزامنة + تحديث"}
              </button>
              <button onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-3 py-2 text-xs font-semibold transition active:scale-95">
                <LogOut className="h-3.5 w-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-500" /></div>
          ) : (
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {tab === "bi" && <><Overview centers={centers} /><BiDashboard centers={centers} /></>}
              {tab === "users" && <CentersTab centers={centers} admin={admin} onUpdate={refresh} onView={setSelectedCenter} />}
              {tab === "notifications" && <NotificationsTab centers={centers} admin={admin} onUpdate={refresh} />}
              {tab === "testimonials" && <TestimonialsTab />}
              {tab === "rbac" && <RbacManager admin={admin} onUpdate={refresh} />}
              {tab === "tickets" && <TicketsTab admin={admin} />}
              {tab === "licenses" && <LicensesTab admin={admin} centers={centers} />}
              {tab === "ai_copilot" && <AiCopilotTab admin={admin} centers={centers} />}
              {tab === "settings" && <GlobalSettingsTab admin={admin} />}
              {tab === "audit" && <AuditLogCenter logs={logs} onRefresh={refresh} />}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ============================== OVERVIEW ============================== */
function Overview({ centers }: { centers: CenterRecord[] }) {
  const totalStudents = centers.reduce((s, c) => s + (c.studentCount || 0), 0);
  const totalTeachers = centers.reduce((s, c) => s + (c.teacherCount || 0), 0);
  const activeSubs = centers.filter((c) => c.subscriptionStatus === "active").length;
  const expiredSubs = centers.filter((c) => c.subscriptionStatus === "expired" || c.subscriptionStatus === "canceled").length;
  const blocked = centers.filter((c) => c.status === "suspended" || c.status === "disabled").length;

  const monthlyRevenue = centers.filter((c) => c.subscriptionStatus === "active")
    .reduce((s, c) => { const plan = PLAN_DEFINITIONS.find((p) => p.id === c.subscriptionPlan); return s + (plan?.price ?? 0); }, 0);

  const stats = [
    { label: "إجمالي السناتر", value: centers.length, icon: Building2, tone: "from-brand-500 to-brand-600" },
    { label: "إجمالي الطلاب", value: totalStudents, icon: GraduationCap, tone: "from-emerald-500 to-green-600" },
    { label: "إجمالي المعلمين", value: totalTeachers, icon: UserCog, tone: "from-sky-500 to-blue-600" },
    { label: "الإيراد الشهري", value: `${monthlyRevenue} ج.م`, icon: DollarSign, tone: "from-amber-500 to-orange-600" },
    { label: "اشتراكات نشطة", value: activeSubs, icon: CreditCard, tone: "from-teal-500 to-cyan-600" },
    { label: "حسابات موقوفة", value: blocked, icon: Ban, tone: "from-rose-500 to-pink-600" },
    { label: "اشتراكات منتهية", value: expiredSubs, icon: AlertCircle, tone: "from-red-400 to-red-600" },
    { label: "خطط مؤسسية", value: centers.filter(c => c.subscriptionPlan === "enterprise").length, icon: Crown, tone: "from-violet-500 to-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", s.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-ink">{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </motion.div>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-emerald-50 to-teal-50 p-5 dark:from-emerald-500/5 dark:to-teal-500/5 lg:col-span-2">
          <div className="mb-2 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" /><h3 className="text-sm font-bold text-ink">الإيراد السنوي المقدر</h3></div>
          <p className="text-4xl font-extrabold text-emerald-600">{monthlyRevenue * 12} <span className="text-lg font-normal">ج.م</span></p>
          <p className="mt-1 text-xs text-muted">بناءً على {activeSubs} اشتراك نشط</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center gap-2"><Building2 className="h-5 w-5 text-brand-500" /><h3 className="text-sm font-bold text-ink">حالة السناتر</h3></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs text-muted">نشط</span><span className="text-lg font-bold text-emerald-600">{centers.filter(c => c.status === "active").length}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-muted">موقوف</span><span className="text-lg font-bold text-amber-600">{centers.filter(c => c.status === "suspended").length}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-muted">محظور</span><span className="text-lg font-bold text-rose-600">{centers.filter(c => c.status === "disabled").length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== CENTERS + USERS COMBINED ============================== */
function CentersTab({ centers, admin, onUpdate, onView }: {
  centers: CenterRecord[];
  admin: { uid: string; email: string };
  onUpdate: () => void;
  onView: (c: CenterRecord) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  const filtered = centers.filter((c) => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ||
      c.id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchPlan = !planFilter || c.subscriptionPlan === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const act = async (c: CenterRecord, status: AccountStatus) => { await updateCenterStatus(c.id, status, admin); onUpdate(); };
  const del = async (c: CenterRecord) => {
    if (window.confirm(`⚠️ تحذير مهم: هل أنت متأكد من رغبتك في حذف السنتر "${c.name || "هذا السنتر"}" والمستخدم المرتبط به نهائياً؟ 

سيؤدي هذا الإجراء إلى حذف الحساب تماماً من قاعدة البيانات ولن يتمكن المستخدم من تسجيل الدخول مجدداً.`)) {
      try {
        await deleteCenterRecord(c.id, admin);
        window.alert(`تم حذف السنتر والمستخدم المرتبط به بنجاح.`);
        onUpdate();
      } catch (err) {
        console.error("Error deleting center:", err);
        window.alert("حدث خطأ أثناء عملية الحذف.");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد أو ID..."
            className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-xs text-ink">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="suspended">موقوف</option>
          <option value="disabled">محظور</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-xs text-ink">
          <option value="">كل الخطط</option>
          {PLAN_DEFINITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Responsive Cards Grid instead of Table */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-line bg-surface py-12 text-center text-muted">لا توجد نتائج</div>
        ) : filtered.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">{(c.name || "C")[0]}</div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{c.name || "بدون اسم"}</p>
                  <p className="truncate text-[10px] text-faint">{c.ownerEmail || "—"}</p>
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            {/* Plan + Stats */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <PlanBadge plan={c.subscriptionPlan} />
              <div className="flex gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-0.5"><GraduationCap className="h-3 w-3" />{c.studentCount || 0}</span>
                <span className="flex items-center gap-0.5"><UserCog className="h-3 w-3" />{c.teacherCount || 0}</span>
              </div>
            </div>
            {/* Actions */}
            <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
              <button onClick={() => onView(c)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-xs font-bold text-white transition hover:bg-brand-700">
                <Eye className="h-3.5 w-3.5" /> فتح الملف
              </button>
              {c.status === "active" ? (
                <ActionBtn icon={Ban} color="amber" onClick={() => act(c, "suspended")} title="إيقاف" />
              ) : (
                <ActionBtn icon={CheckCircle2} color="emerald" onClick={() => act(c, "active")} title="تفعيل" />
              )}
              <ActionBtn icon={Trash2} color="rose" onClick={() => del(c)} title="حذف" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============================== CENTER DETAIL DRAWER ============================== */
function CenterDetailDrawer({ center: initialCenter, admin, onClose, onUpdate }: {
  center: CenterRecord;
  admin: { uid: string; email: string };
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "subscription" | "features" | "limits" | "history" | "message">("overview");
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loadingF, setLoadingF] = useState(true);
  
  // Real-time center state
  const [currentCenter, setCurrentCenter] = useState<CenterRecord>(initialCenter);
  
  const [limits, setLimits] = useState<CenterLimits>(
    initialCenter.customLimits ?? DEFAULT_LIMITS[initialCenter.subscriptionPlan || "free"] ?? DEFAULT_LIMITS.free
  );
  const [msg, setMsg] = useState("");

  // Subscription management state
  const [freeDays, setFreeDays] = useState(1);
  const [freeDaysPlan, setFreeDaysPlan] = useState<SubscriptionPlan>(initialCenter.subscriptionPlan || "pro");
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [grantingDays, setGrantingDays] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Sync center details in real-time from Firestore
  useEffect(() => {
    setCurrentCenter(initialCenter);
  }, [initialCenter]);

  useEffect(() => {
    if (!FIREBASE_ENABLED || !firestoreDb) return;
    const unsub = onSnapshot(doc(firestoreDb, "centers", initialCenter.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentCenter((prev) => ({
          ...prev,
          ...data,
          id: snap.id,
        }) as CenterRecord);
      }
    });
    return unsub;
  }, [initialCenter.id]);

  // Keep limits and plan in sync with local input fields
  useEffect(() => {
    setLimits(
      currentCenter.customLimits ?? DEFAULT_LIMITS[currentCenter.subscriptionPlan || "free"] ?? DEFAULT_LIMITS.free
    );
    if (currentCenter.subscriptionPlan !== "free") {
      setFreeDaysPlan(currentCenter.subscriptionPlan || "pro");
    }
  }, [currentCenter.customLimits, currentCenter.subscriptionPlan]);

  // Real-time custom features listener
  useEffect(() => {
    if (!FIREBASE_ENABLED || !firestoreDb) {
      setLoadingF(true);
      fetchCenterFeatures(initialCenter.id).then((f) => {
        setFeatures(f);
        setLoadingF(false);
      });
      return;
    }
    setLoadingF(true);
    const unsub = onSnapshot(
      doc(firestoreDb, "centers", initialCenter.id, "config", "features"),
      (snap) => {
        if (snap.exists()) {
          setFeatures(snap.data() as Record<string, boolean>);
        } else {
          setFeatures({});
        }
        setLoadingF(false);
      },
      () => setLoadingF(false)
    );
    return unsub;
  }, [initialCenter.id]);

  // Load timeline when history tab is active
  useEffect(() => {
    if (tab === "history" || tab === "subscription") {
      setLoadingTimeline(true);
      fetchTimelineEvents(currentCenter.id).then((events) => {
        setTimeline(events);
        setLoadingTimeline(false);
      }).catch(() => setLoadingTimeline(false));
    }
  }, [tab, currentCenter.id]);

  const toggleF = async (key: string) => {
    const newVal = !features[key];
    setFeatures((p) => ({ ...p, [key]: newVal }));
    await toggleFeatureFlag(currentCenter.id, key, newVal, admin);
  };

  const saveLimits = async () => {
    await updateCenterLimits(currentCenter.id, limits, admin);
    onUpdate();
    pushToast("تم حفظ الحدود بنجاح!");
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    await sendOwnerMessage(currentCenter.id, currentCenter.ownerId, msg.trim(), admin);
    setMsg("");
    pushToast("تم إرسال الرسالة بنجاح!");
  };

  const doApplyPlan = async (p: SubscriptionPlan) => {
    setLoadingF(true);
    await applyPlanFeatures(currentCenter.id, p, admin);
    setFeatures(getFeaturesForPlan(p));
    setLoadingF(false);
  };

  const handleQuickPlanSwitch = async (plan: SubscriptionPlan) => {
    if (switchingPlan) return;
    setSwitchingPlan(true);
    try {
      await quickPlanSwitch(currentCenter.id, plan, admin);
      pushToast(`تم تبديل الخطة إلى ${planLabels[plan]} بنجاح! 🎉`);
      onUpdate();
    } catch (e) {
      pushToast("فشل تبديل الخطة. حاول مرة أخرى.");
      console.error(e);
    } finally {
      setSwitchingPlan(false);
    }
  };

  const handleGrantFreeDays = async () => {
    if (grantingDays) return;
    setGrantingDays(true);
    try {
      const { newEndDate } = await grantFreeDays(currentCenter.id, freeDays, freeDaysPlan, admin);
      pushToast(`تم منح ${freeDays} أيام مجانية! تاريخ الانتهاء الجديد: ${new Date(newEndDate).toLocaleDateString("ar-EG")} 🎁`);
      onUpdate();
    } catch (e) {
      pushToast("فشل منح الأيام المجانية. حاول مرة أخرى.");
      console.error(e);
    } finally {
      setGrantingDays(false);
    }
  };

  const handleExportCenter = () => {
    const data = JSON.stringify(currentCenter, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `center_${currentCenter.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("تم تصدير بيانات السنتر!");
  };

  const tabs = [
    { id: "overview" as const, label: "معلومات", icon: Eye },
    { id: "subscription" as const, label: "إدارة الخطة", icon: Crown },
    { id: "features" as const, label: "المميزات", icon: Flag },
    { id: "limits" as const, label: "الحدود", icon: SlidersHorizontal },
    { id: "history" as const, label: "السجل", icon: History },
    { id: "message" as const, label: "رسالة", icon: Mail },
  ];

  const currentPlanDef = PLAN_DEFINITIONS.find(p => p.id === currentCenter.subscriptionPlan) || PLAN_DEFINITIONS[0];
  const daysRemaining = currentCenter.subscriptionEndDate ? Math.max(0, Math.ceil((currentCenter.subscriptionEndDate - Date.now()) / 86400000)) : null;

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> رجوع
          </button>
          <div className="ms-auto flex items-center gap-2">
            <button onClick={handleExportCenter} title="تصدير بيانات السنتر" className="rounded-lg border border-line p-2 text-muted hover:text-ink hover:bg-elevated transition">
              <Download className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-lg">{(currentCenter.name || "C")[0]}</div>
            <div><p className="text-sm font-bold text-ink">{currentCenter.name || "بدون اسم"}</p><p className="text-[10px] text-muted">{currentCenter.ownerEmail}</p></div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition",
                tab === t.id ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:text-ink")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {tab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <StatCard label="الطلاب" value={currentCenter.studentCount || 0} icon={GraduationCap} tone="from-emerald-500 to-green-600" />
                  <StatCard label="المعلمون" value={currentCenter.teacherCount || 0} icon={UserCog} tone="from-sky-500 to-blue-600" />
                  <StatCard label="الحالة" value={currentCenter.status === "active" ? "نشط" : currentCenter.status === "suspended" ? "موقوف" : "محظور"} icon={ShieldCheck} tone="from-violet-500 to-purple-600" />
                  <StatCard label="الخطة" value={planLabels[currentCenter.subscriptionPlan || "free"]} icon={CreditCard} tone="from-amber-500 to-orange-600" />
                  <StatCard label="حالة الاشتراك" value={currentCenter.subscriptionStatus === "active" ? "نشط" : currentCenter.subscriptionStatus === "trialing" ? "تجريبي" : currentCenter.subscriptionStatus || "—"} icon={CheckCircle2} tone="from-teal-500 to-cyan-600" />
                  <StatCard label="تاريخ الانتهاء" value={currentCenter.subscriptionEndDate ? new Date(currentCenter.subscriptionEndDate).toLocaleDateString("ar-EG") : "—"} icon={CalendarPlus} tone="from-rose-500 to-pink-600" />
                </div>
                {/* Quick Actions */}
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> إجراءات سريعة</h3>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setTab("subscription")} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                      <Crown className="h-3.5 w-3.5" /> إدارة الخطة
                    </button>
                    <button onClick={() => setTab("features")} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                      <Flag className="h-3.5 w-3.5" /> تعديل المميزات
                    </button>
                    <button onClick={handleExportCenter} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
                      <Download className="h-3.5 w-3.5" /> تصدير البيانات
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============== SUBSCRIPTION MANAGEMENT TAB ============== */}
            {tab === "subscription" && (
              <div className="space-y-6">
                {/* Current Plan Summary */}
                <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50/50 to-violet-50/50 p-5 dark:from-brand-500/5 dark:to-violet-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> الخطة الحالية</h3>
                      <div className="mt-2 flex items-center gap-3">
                        <span className={cn("rounded-full px-3 py-1 text-sm font-extrabold", currentPlanDef.color)}>{currentPlanDef.name}</span>
                        {daysRemaining !== null && daysRemaining > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Clock className="h-3.5 w-3.5" />
                            متبقي {daysRemaining} يوم
                          </span>
                        )}
                        {daysRemaining !== null && daysRemaining === 0 && (
                          <span className="flex items-center gap-1 text-xs font-bold text-rose-600">⚠️ منتهي</span>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-muted">حالة الاشتراك</p>
                      <span className={cn("text-xs font-bold", currentCenter.subscriptionStatus === "active" ? "text-emerald-600" : "text-amber-600")}>
                        {currentCenter.subscriptionStatus === "active" ? "نشط ✅" : currentCenter.subscriptionStatus === "trialing" ? "تجريبي" : currentCenter.subscriptionStatus || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Plan Switch */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <h3 className="text-sm font-black text-ink mb-4 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-brand-500" /> تبديل الخطة لحظياً
                  </h3>
                  <p className="text-xs text-muted mb-4">اختر خطة لتطبيقها فوراً على هذا السنتر. سيتم تحديث المميزات والحدود تلقائياً وإرسال إشعار لحظي للمستخدم.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {PLAN_DEFINITIONS.map((plan) => {
                      const isCurrent = plan.id === currentCenter.subscriptionPlan;
                      return (
                        <motion.button
                          key={plan.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => !isCurrent && handleQuickPlanSwitch(plan.id)}
                          disabled={isCurrent || switchingPlan}
                          className={cn(
                            "relative rounded-xl border-2 p-4 text-center transition-all",
                            isCurrent
                              ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                              : "border-line hover:border-brand-400 hover:shadow-md cursor-pointer",
                            switchingPlan && !isCurrent && "opacity-50"
                          )}
                        >
                          {isCurrent && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-bold text-white">الحالية</span>
                          )}
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", plan.color)}>
                            {plan.id === "enterprise" && <Crown className="h-3 w-3" />}{plan.name}
                          </span>
                          <p className="mt-2 text-xl font-extrabold text-ink">{plan.price}<span className="text-xs text-muted"> ج.م/شهر</span></p>
                          <p className="mt-1 text-[10px] text-muted">
                            {plan.maxStudents === 99999 ? "طلاب غير محدودين" : `حتى ${plan.maxStudents} طالب`}
                          </p>
                          {switchingPlan && !isCurrent && <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin text-brand-500" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Grant Free Days */}
                <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-5 dark:border-amber-500/30 dark:bg-amber-500/5">
                  <h3 className="text-sm font-black text-ink mb-3 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-amber-500" /> منح أيام مجانية
                  </h3>
                  <p className="text-xs text-muted mb-4">أضف أيام مجانية للمستخدم مع اختيار الخطة. سيتم تمديد تاريخ الانتهاء وإرسال إشعار فوري.</p>
                  
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    {/* Plan selector */}
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-bold text-muted">الخطة المراد تمديدها</label>
                      <select
                        value={freeDaysPlan}
                        onChange={(e) => setFreeDaysPlan(e.target.value as SubscriptionPlan)}
                        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand-400 focus:outline-none"
                      >
                        {PLAN_DEFINITIONS.filter(p => p.id !== "free").map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Days selector */}
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-bold text-muted">عدد الأيام</label>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 5, 7, 14, 30].map((d) => (
                          <button
                            key={d}
                            onClick={() => setFreeDays(d)}
                            className={cn(
                              "h-10 rounded-lg border px-3 text-xs font-bold transition",
                              freeDays === d
                                ? "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200"
                                : "border-line bg-surface text-muted hover:border-amber-300 hover:text-ink"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grant button */}
                    <button
                      onClick={handleGrantFreeDays}
                      disabled={grantingDays}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-60"
                    >
                      {grantingDays ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      منح {freeDays} يوم
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="mt-4 rounded-xl bg-amber-100/50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="font-bold">معاينة:</p>
                    <p>سيتم مد خطة <strong>{PLAN_DEFINITIONS.find(p => p.id === freeDaysPlan)?.name}</strong> لمدة <strong>{freeDays} يوم</strong></p>
                    <p>تاريخ الانتهاء الجديد المتوقع: <strong>{new Date(Math.max(currentCenter.subscriptionEndDate || Date.now(), Date.now()) + freeDays * 86400000).toLocaleDateString("ar-EG")}</strong></p>
                  </div>
                </div>

                {/* Plan Limits Preview */}
                <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand-500" /> حدود الخطة الحالية</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {([
                      { key: "maxStudents" as const, label: "أقصى عدد طلاب", icon: GraduationCap },
                      { key: "maxTeachers" as const, label: "أقصى عدد معلمين", icon: UserCog },
                      { key: "maxStaff" as const, label: "أقصى عدد موظفين", icon: UserCog },
                      { key: "maxGroups" as const, label: "مجموعات", icon: Building2 },
                      { key: "maxClassrooms" as const, label: "قاعات", icon: Building2 },
                      { key: "maxSchedules" as const, label: "حصص", icon: CalendarPlus },
                    ]).map((item) => {
                      const val = currentCenter.customLimits?.[item.key] ?? DEFAULT_LIMITS[currentCenter.subscriptionPlan || "free"]?.[item.key] ?? 0;
                      return (
                        <div key={item.key} className="rounded-xl bg-elevated/40 p-3 text-center">
                          <item.icon className="mx-auto h-4 w-4 text-brand-500 mb-1" />
                          <p className="text-lg font-extrabold text-ink">{val === 99999 ? "∞" : val}</p>
                          <p className="text-[10px] text-muted">{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Timeline */}
                {timeline.length > 0 && (
                  <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2"><History className="h-4 w-4 text-brand-500" /> آخر العمليات</h3>
                    <div className="space-y-2">
                      {timeline.slice(0, 5).map((evt) => (
                        <div key={evt.id} className="flex items-center gap-3 rounded-lg bg-elevated/30 p-2.5">
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold",
                            evt.type === "upgrade" ? "bg-emerald-500" : evt.type === "free_days" ? "bg-amber-500" : evt.type === "downgrade" ? "bg-rose-500" : "bg-brand-500"
                          )}>
                            {evt.type === "upgrade" ? "↑" : evt.type === "free_days" ? "🎁" : evt.type === "downgrade" ? "↓" : "•"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-ink truncate">{evt.title}</p>
                            <p className="text-[10px] text-muted truncate">{evt.description}</p>
                          </div>
                          <span className="text-[10px] text-faint whitespace-nowrap">{new Date(evt.timestamp).toLocaleDateString("ar-EG")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "features" && (
              loadingF ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div> : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-elevated/50 p-3">
                    <span className="text-xs text-muted">تطبيق خطة بسرعة:</span>
                    {(["free", "pro", "enterprise"] as const).map((p) => (
                      <button key={p} onClick={() => doApplyPlan(p)} className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                        {planLabels[p]}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {FEATURE_FLAGS.map((f) => {
                      const enabled = features[f.key] ?? false;
                      return (
                        <div key={f.key} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", enabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15" : "bg-elevated text-faint")}>
                            <Zap className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">{fl(f)}</p>
                            <p className="text-[11px] text-muted">{fd(f)}</p>
                            <span className="mt-0.5 inline-block rounded bg-elevated px-1.5 py-0.5 text-[9px] font-bold">{planLabels[f.plan] || f.plan}</span>
                          </div>
                          <button onClick={() => toggleF(f.key)} className={cn("relative h-6 w-11 rounded-full transition", enabled ? "bg-emerald-500" : "bg-line")}>
                            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", enabled ? "start-[1.4rem]" : "start-0.5")} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {tab === "limits" && (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-brand-500" /><h3 className="text-sm font-bold text-ink">الحدود المخصصة للسنتر</h3></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    { key: "maxStudents" as const, label: "أقصى عدد طلاب" },
                    { key: "maxTeachers" as const, label: "أقصى عدد معلمين" },
                    { key: "maxStaff" as const, label: "أقصى عدد موظفين" },
                    { key: "maxGroups" as const, label: "أقصى عدد مجموعات" },
                    { key: "maxClassrooms" as const, label: "أقصى عدد قاعات" },
                    { key: "maxSchedules" as const, label: "أقصى عدد حصص" },
                  ]).map((item) => (
                    <div key={item.key}>
                      <label className="mb-1.5 block text-xs font-medium text-muted">{item.label}</label>
                      <input type="number" value={limits[item.key] ?? 0} onChange={(e) => setLimits((p) => ({ ...p, [item.key]: +e.target.value }))}
                        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                  ))}
                </div>
                <button onClick={saveLimits} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-brand-700">
                  <CheckCircle2 className="h-4 w-4" /> حفظ الحدود
                </button>
              </div>
            )}

            {/* ============== HISTORY/AUDIT TAB ============== */}
            {tab === "history" && (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="mb-4 flex items-center gap-2"><History className="h-4 w-4 text-brand-500" /><h3 className="text-sm font-bold text-ink">سجل العمليات الإدارية</h3></div>
                {loadingTimeline ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
                ) : timeline.length === 0 ? (
                  <div className="py-10 text-center text-muted">
                    <History className="mx-auto h-8 w-8 text-faint mb-2" />
                    <p className="text-xs">لا توجد عمليات مسجلة لهذا السنتر بعد.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeline.map((evt) => (
                      <div key={evt.id} className="flex items-start gap-3 rounded-xl border border-line bg-elevated/20 p-3">
                        <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold",
                          evt.type === "upgrade" ? "bg-emerald-500" : evt.type === "free_days" ? "bg-amber-500" : evt.type === "downgrade" ? "bg-rose-500" : evt.type === "activate" ? "bg-brand-500" : evt.type === "discount" ? "bg-violet-500" : "bg-slate-500"
                        )}>
                          {evt.type === "upgrade" ? "↑" : evt.type === "free_days" ? "🎁" : evt.type === "downgrade" ? "↓" : evt.type === "activate" ? "✓" : "•"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink">{evt.title}</p>
                          <p className="text-xs text-muted mt-0.5">{evt.description}</p>
                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-faint">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(evt.timestamp).toLocaleString("ar-EG")}</span>
                            <span>بواسطة: {evt.adminEmail}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "message" && (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="mb-3 flex items-center gap-2"><Mail className="h-4 w-4 text-brand-500" /><h3 className="text-sm font-bold text-ink">إرسال رسالة لمالك السنتر</h3></div>
                <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="اكتب رسالتك هنا..."
                  className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                <button onClick={sendMessage} disabled={!msg.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-50">
                  <Send className="h-4 w-4" /> إرسال
                </button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}



/* ============================== SHARED ============================== */
function StatCard({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: typeof Eye; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold text-ink capitalize">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function PlanBadge({ plan }: { plan: SubscriptionPlan | undefined }) {
  const def = PLAN_DEFINITIONS.find((p) => p.id === plan);
  if (!def) return <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-bold">مجاني</span>;
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", def.color)}>{def.name}</span>;
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : status === "suspended" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
    : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  const label = status === "active" ? "نشط" : status === "suspended" ? "موقوف" : "محظور";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tone)}>{label}</span>;
}

function ActionBtn({ icon: Icon, color, onClick, title }: { icon: typeof Ban; color: "amber" | "emerald" | "rose" | "brand"; onClick: () => void; title: string }) {
  const colors = {
    amber: "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10",
    emerald: "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
    rose: "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10",
    brand: "text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10",
  };
  return <button onClick={onClick} title={title} className={cn("rounded-lg p-1.5 transition", colors[color])}><Icon className="h-4 w-4" /></button>;
}

/* ============================================================= TESTIMONIALS TAB */
function TestimonialsTab() {
  const [list, setList] = useState<Testimonial[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "pending" | "approved">("all");

  const load = () => {
    setList(getTestimonials());
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = (id: string) => {
    approveTestimonial(id);
    load();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("هل أنت متأكد من رغبتك في حذف هذا التقييم نهائياً؟")) {
      deleteTestimonial(id);
      load();
    }
  };

  const filtered = list.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      item.name.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q) ||
      item.text.toLowerCase().includes(q);

    if (filterType === "pending") return matchSearch && !item.approved;
    if (filterType === "approved") return matchSearch && item.approved;
    return matchSearch;
  });

  const pendingCount = list.filter((t) => !t.approved).length;
  const approvedCount = list.filter((t) => t.approved).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-[11px] font-bold text-muted uppercase tracking-wider">إجمالي التقييمات</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{list.length}</p>
          <p className="mt-1 text-xs text-muted">المنشورة والمعلقة في المنصة</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/5 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">المنشورة حالياً</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
          <p className="mt-1 text-xs text-muted">تظهر للزوار على الصفحة الرئيسية</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-50/5 p-5 shadow-sm relative overflow-hidden">
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">بانتظار الموافقة</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </p>
          {pendingCount > 0 && (
            <span className="absolute top-4 left-4 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          )}
          <p className="mt-1 text-xs text-muted">تعليقات مضافة حديثاً تحتاج لمراجعة</p>
        </div>
      </div>

      {/* Control panel & Filter bar */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="البحث بالاسم، المسمى الوظيفي، أو نص التعليق..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface pr-10 pl-4 py-2 text-sm text-ink outline-none focus:border-brand-500 transition"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 bg-elevated/40 p-1 rounded-xl ring-1 ring-line-soft">
            <button
              onClick={() => setFilterType("all")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                filterType === "all" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              الكل ({list.length})
            </button>
            <button
              onClick={() => setFilterType("pending")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                filterType === "pending" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-muted hover:text-ink"
              )}
            >
              المعلقة ({pendingCount})
            </button>
            <button
              onClick={() => setFilterType("approved")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                filterType === "approved" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-muted hover:text-ink"
              )}
            >
              المنشورة ({approvedCount})
            </button>
          </div>
        </div>

        {/* Testimonials List */}
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-faint" />
              <p className="mt-2 text-sm font-semibold text-muted">لا توجد تعليقات مطابقة للبحث أو الفلتر المختار.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filtered.map((item) => (
                <div key={item.id} className="p-5 hover:bg-elevated/20 transition duration-150">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink text-sm">{item.name}</span>
                        <span className="text-xs text-muted">({item.role})</span>
                        <span className="inline-flex items-center gap-0.5">
                          {[...Array(item.rating || 5)].map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                          ))}
                        </span>
                        {item.approved ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            منشور وموافق عليه
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            بانتظار المراجعة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted leading-relaxed max-w-3xl">
                        “{item.text}”
                      </p>
                      <p className="text-[10px] text-faint">
                        تاريخ الإرسال: {new Date(item.createdAt).toLocaleString("ar-EG")}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 border-t border-line-soft pt-3 sm:border-0 sm:pt-0">
                      {!item.approved && (
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          موافقة ونشر
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف نهائي
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
