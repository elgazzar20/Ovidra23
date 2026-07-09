import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Calendar, FileText, AlertCircle, Trash2, Edit3, Plus, CheckCircle2,
  Clock, Check, Search, BellRing
} from "lucide-react";
import {
  fetchPlatformNotifications,
  createPlatformNotification,
  updatePlatformNotification,
  deletePlatformNotification,
  type PlatformNotification,
  type CenterRecord,
  PLAN_DEFINITIONS,
  type SubscriptionPlan,
  type AccountStatus
} from "../../lib/superadmin";
import { cn } from "../../utils/cn";
import { pushToast } from "../../components/ui";

interface NotificationsTabProps {
  centers: CenterRecord[];
  admin: { uid: string; email: string };
  onUpdate: () => void;
}

export function NotificationsTab({ centers, admin, onUpdate }: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<"sent" | "scheduled" | "draft">("sent");

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [targetType, setTargetType] = useState<"all" | "selected" | "plan" | "status">("all");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [targetPlan, setTargetPlan] = useState<SubscriptionPlan>("free");
  const [targetStatus, setTargetStatus] = useState<AccountStatus>("active");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const [centerSearch, setCenterSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    const data = await fetchPlatformNotifications();
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPriority("medium");
    setTargetType("all");
    setTargetIds([]);
    setTargetPlan("free");
    setTargetStatus("active");
    setIsScheduled(false);
    setScheduledDate("");
    setScheduledTime("");
    setFormError("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (notif: PlatformNotification) => {
    setEditingId(notif.id);
    setTitle(notif.title);
    setBody(notif.body);
    setPriority(notif.priority);
    setTargetType(notif.targetType);
    setTargetIds(notif.targetIds || []);
    if (notif.targetPlan) setTargetPlan(notif.targetPlan);
    if (notif.targetStatus) setTargetStatus(notif.targetStatus);

    if (notif.status === "scheduled" && notif.scheduledAt) {
      setIsScheduled(true);
      const dateObj = new Date(notif.scheduledAt);
      // yyyy-MM-dd
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const dd = String(dateObj.getDate()).padStart(2, "0");
      setScheduledDate(`${yyyy}-${mm}-${dd}`);
      // HH:mm
      const hh = String(dateObj.getHours()).padStart(2, "0");
      const min = String(dateObj.getMinutes()).padStart(2, "0");
      setScheduledTime(`${hh}:${min}`);
    } else {
      setIsScheduled(false);
      setScheduledDate("");
      setScheduledTime("");
    }

    setFormError("");
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الإشعار نهائياً؟")) return;
    try {
      await deletePlatformNotification(id, admin);
      setSuccessMsg("تم حذف الإشعار بنجاح");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadNotifications();
    } catch (e) {
      alert("فشل حذف الإشعار: " + (e as Error).message);
    }
  };

  const handleToggleSelectCenter = (centerId: string) => {
    setTargetIds(prev =>
      prev.includes(centerId)
        ? prev.filter(id => id !== centerId)
        : [...prev, centerId]
    );
  };

  const handleSave = async (asDraft: boolean) => {
    if (!title.trim() || !body.trim()) {
      setFormError("يرجى ملء عنوان ونص الإشعار.");
      return;
    }

    if (targetType === "selected" && targetIds.length === 0) {
      setFormError("يرجى اختيار سنتر واحد على الأقل.");
      return;
    }

    let schedAt: number | undefined;
    if (!asDraft && isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        setFormError("يرجى تحديد تاريخ ووقت الجدولة.");
        return;
      }
      const schedTimeObj = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(schedTimeObj.getTime())) {
        setFormError("صيغة التاريخ أو الوقت غير صالحة.");
        return;
      }
      if (schedTimeObj.getTime() <= Date.now()) {
        setFormError("يجب أن يكون وقت الجدولة في المستقبل.");
        return;
      }
      schedAt = schedTimeObj.getTime();
    }

    const finalStatus: "draft" | "scheduled" | "sent" = asDraft
      ? "draft"
      : isScheduled ? "scheduled" : "sent";

    const payload = {
      title: title.trim(),
      body: body.trim(),
      priority,
      targetType,
      targetIds: targetType === "selected" ? targetIds : undefined,
      targetPlan: targetType === "plan" ? targetPlan : undefined,
      targetStatus: targetType === "status" ? targetStatus : undefined,
      status: finalStatus,
      scheduledAt: schedAt,
      sentAt: finalStatus === "sent" ? Date.now() : undefined,
    };

    try {
      if (editingId) {
        await updatePlatformNotification(editingId, payload, admin);
        setSuccessMsg("تم تعديل الإشعار بنجاح");
        pushToast("تم تعديل الإشعار بنجاح", "success");
      } else {
        await createPlatformNotification(payload, admin);
        setSuccessMsg("تم إنشاء الإشعار بنجاح");
        pushToast("تم إنشاء الإشعار بنجاح", "success");
      }
      setTimeout(() => setSuccessMsg(""), 3000);
      setIsFormOpen(false);
      resetForm();
      loadNotifications();
      onUpdate();
    } catch (e) {
      setFormError("حدث خطأ أثناء الحفظ: " + (e as Error).message);
      pushToast("حدث خطأ أثناء حفظ الإشعار", "error");
    }
  };

  // Filters for notifications
  const filteredNotifications = notifications.filter(n => n.status === currentTab);

  const getTargetLabel = (notif: PlatformNotification) => {
    switch (notif.targetType) {
      case "all":
        return "جميع السناتر";
      case "selected":
        return `سناتر محددة (${notif.targetIds?.length || 0})`;
      case "plan":
        const pDef = PLAN_DEFINITIONS.find(p => p.id === notif.targetPlan);
        return `خطة: ${pDef?.name || notif.targetPlan}`;
      case "status":
        const statusNames: Record<string, string> = { active: "نشط", suspended: "موقوف", disabled: "محظور" };
        return `حالة: ${statusNames[notif.targetStatus || ""] || notif.targetStatus}`;
      default:
        return "غير محدد";
    }
  };

  const filteredCentersForSelection = centers.filter(c =>
    c.name?.toLowerCase().includes(centerSearch.toLowerCase()) ||
    c.ownerEmail?.toLowerCase().includes(centerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-ink">مركز الإشعارات العام (In-App Notification Center)</h2>
          <p className="text-xs text-muted">إرسال إعلانات وتنبيهات مباشرة لمالكي السناتر وتصفيتها حسب الخطة أو الحالة أو الاختيار المباشر.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-rose-700 active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> إنشاء إشعار جديد
        </button>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line pb-1">
        {(["sent", "scheduled", "draft"] as const).map((t) => {
          const counts = notifications.filter(n => n.status === t).length;
          const labels = { sent: "المرسلة", scheduled: "المجدولة", draft: "المسودات" };
          const active = currentTab === t;
          return (
            <button
              key={t}
              onClick={() => setCurrentTab(t)}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-bold transition-all relative",
                active
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-200"
                  : "text-muted hover:text-ink hover:bg-elevated/40"
              )}
            >
              {labels[t]}
              <span className={cn(
                "ms-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                active ? "bg-rose-600 text-white" : "bg-elevated text-muted"
              )}>
                {counts}
              </span>
              {active && (
                <motion.span
                  layoutId="activeNotifTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-rose-500/30 border-t-rose-600" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface py-12 text-center text-muted">
            <BellRing className="mx-auto h-8 w-8 text-faint opacity-50 mb-2" />
            <p className="text-sm">لا توجد إشعارات في هذا القسم حالياً.</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-line bg-surface p-4 shadow-sm flex flex-col justify-between gap-4 md:flex-row md:items-start"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase",
                    notif.priority === "high"
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                      : notif.priority === "medium"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                        : "bg-slate-50 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"
                  )}>
                    أولوية: {notif.priority === "high" ? "عالية" : notif.priority === "medium" ? "متوسطة" : "منخفضة"}
                  </span>
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-200">
                    المستهدف: {getTargetLabel(notif)}
                  </span>
                  {notif.status === "scheduled" && notif.scheduledAt && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                      <Clock className="h-3 w-3" />
                      مجدول للإرسال: {new Date(notif.scheduledAt).toLocaleString("ar-EG")}
                    </span>
                  )}
                  {notif.status === "sent" && notif.sentAt && (
                    <span className="text-[10px] text-faint">
                      أُرسل: {new Date(notif.sentAt).toLocaleString("ar-EG")}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-ink text-sm sm:text-base">{notif.title}</h3>
                <div className="text-xs text-muted whitespace-pre-wrap leading-relaxed max-w-4xl max-h-24 overflow-y-auto cp-scroll border-s-2 border-line pl-2 pr-1 bg-elevated/20 py-1 rounded">
                  {notif.body}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 self-end md:self-start shrink-0">
                {(notif.status === "draft" || notif.status === "scheduled") && (
                  <button
                    onClick={() => handleEdit(notif)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:text-brand-600 hover:border-brand-400"
                    title="تعديل"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-rose-50/25 text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/20"
                  title="حذف نهائي"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Creation Modal / Form Dialog */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-line bg-elevated/40 px-5 py-4">
                <div className="flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-rose-500" />
                  <h3 className="font-bold text-ink text-sm sm:text-base">
                    {editingId ? "تعديل إشعار المنصة" : "إنشاء إشعار منصة جديد"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 cp-scroll">
                {formError && (
                  <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {formError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">عنوان الإشعار</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: تحديث أمني هام لنظام الدفع والاشتراكات"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-rose-400 focus:outline-none"
                  />
                </div>

                {/* Body Content */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-muted">نص الإشعار (يدعم التنسيق الغني والسطور المتعددة)</label>
                    <span className="text-[10px] text-faint">يمكنك استخدام مسافات وتفاصيل منسقة</span>
                  </div>
                  <textarea
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="اكتب تفاصيل الإعلان هنا بوضوح..."
                    className="w-full rounded-xl border border-line bg-surface p-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-rose-400 focus:outline-none resize-y"
                  />
                </div>

                {/* Priority & Targeting Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Priority */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-muted">مستوى الأهمية (الأولوية)</label>
                    <div className="flex gap-2">
                      {(["low", "medium", "high"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-bold transition border capitalize",
                            priority === p
                              ? p === "high"
                                ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-200"
                                : p === "medium"
                                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-200"
                                  : "border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-200"
                              : "border-line bg-surface text-muted hover:bg-elevated/40"
                          )}
                        >
                          {p === "high" ? "عالية 🔴" : p === "medium" ? "متوسطة 🟡" : "منخفضة 🟢"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Type */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-muted">فئة السناتر المستهدفة</label>
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value as any)}
                      className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs sm:text-sm text-ink focus:border-rose-400 focus:outline-none"
                    >
                      <option value="all">الجميع (كافة السناتر المسجلة)</option>
                      <option value="selected">سناتر محددة يدوياً</option>
                      <option value="plan">السناتر حسب نوع الخطة (Plan)</option>
                      <option value="status">السناتر حسب حالة الحساب (Status)</option>
                    </select>
                  </div>
                </div>

                {/* Conditional targeting selectors */}
                {targetType === "selected" && (
                  <div className="rounded-xl border border-line bg-elevated/20 p-4 space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs font-bold text-ink">تحديد السناتر يدوياً ({targetIds.length} محدد):</p>
                      <div className="relative w-44">
                        <Search className="absolute right-2 top-2.5 h-3.5 w-3.5 text-faint" />
                        <input
                          type="text"
                          value={centerSearch}
                          onChange={(e) => setCenterSearch(e.target.value)}
                          placeholder="بحث..."
                          className="h-8 w-full rounded-lg border border-line bg-surface pr-7 pl-2 text-[11px] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto cp-scroll border border-line rounded-lg bg-surface divide-y divide-line">
                      {filteredCentersForSelection.map((c) => {
                        const isSelected = targetIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleToggleSelectCenter(c.id)}
                            className="flex w-full items-center justify-between px-3 py-2 text-start transition hover:bg-elevated/50 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-ink truncate">{c.name || "بدون اسم"}</p>
                              <p className="text-[10px] text-faint truncate">{c.ownerEmail}</p>
                            </div>
                            <div className={cn(
                              "h-5 w-5 rounded-md border flex items-center justify-center transition shrink-0",
                              isSelected ? "bg-rose-600 border-rose-600 text-white" : "border-line bg-surface"
                            )}>
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                          </button>
                        );
                      })}
                      {filteredCentersForSelection.length === 0 && (
                        <p className="p-3 text-center text-xs text-muted">لا توجد نتائج مطابقة</p>
                      )}
                    </div>
                  </div>
                )}

                {targetType === "plan" && (
                  <div className="rounded-xl border border-line bg-elevated/20 p-4">
                    <label className="mb-1.5 block text-xs font-bold text-muted">اختر الخطة (Plan)</label>
                    <select
                      value={targetPlan}
                      onChange={(e) => setTargetPlan(e.target.value as SubscriptionPlan)}
                      className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs sm:text-sm text-ink focus:border-rose-400 focus:outline-none"
                    >
                      {PLAN_DEFINITIONS.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                {targetType === "status" && (
                  <div className="rounded-xl border border-line bg-elevated/20 p-4">
                    <label className="mb-1.5 block text-xs font-bold text-muted">اختر حالة الحساب (Status)</label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value as AccountStatus)}
                      className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs sm:text-sm text-ink focus:border-rose-400 focus:outline-none"
                    >
                      <option value="active">نشط (Active)</option>
                      <option value="suspended">موقوف (Suspended)</option>
                      <option value="disabled">محظور (Disabled)</option>
                    </select>
                  </div>
                )}

                {/* Scheduling controls */}
                <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsScheduled(!isScheduled)}
                    className="flex w-full items-center justify-between text-xs font-bold text-ink"
                  >
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-rose-500" />
                      جدولة الإشعار ليتم إرساله تلقائياً في تاريخ مستقبلي؟
                    </span>
                    <div className={cn(
                      "h-5 w-10 rounded-full transition relative shrink-0",
                      isScheduled ? "bg-rose-500" : "bg-line"
                    )}>
                      <span className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                        isScheduled ? "left-5" : "left-0.5"
                      )} />
                    </div>
                  </button>

                  {isScheduled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-3 pt-2 overflow-hidden"
                    >
                      <div>
                        <label className="mb-1 block text-[10px] text-muted font-bold">تاريخ النشر</label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-rose-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-muted font-bold">وقت النشر</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-rose-400 focus:outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-line bg-elevated/40 px-5 py-4 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-muted hover:bg-elevated transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-brand-700 hover:bg-elevated transition cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" /> حفظ كمسودة
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-rose-700 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isScheduled ? "جدولة الإشعار" : "إرسال ونشر الآن"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
