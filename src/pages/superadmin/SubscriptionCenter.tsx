import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Search,
  Crown,
  CreditCard,
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  Calendar,
  ChevronRight,
  Coins,
  FileText,
  History,
  Sparkles,
  Pause,
  Play,
  CheckCircle2,
  Printer,
  Percent,
} from "lucide-react";
import { cn } from "../../utils/cn";
import {
  CenterRecord,
  SubscriptionPlan,
  PLAN_DEFINITIONS,
  updateSubscription,
  applyPlanFeatures,
  PaymentRecord,
  InvoiceRecord,
  TimelineEvent,
  RenewalRecord,
  addPaymentRecord,
  addInvoiceRecord,
  addTimelineEvent,
  addRenewalRecord,
  fetchPayments,
  fetchInvoices,
  fetchTimelineEvents,
  fetchRenewals,
} from "../../lib/superadmin";

interface SubscriptionCenterProps {
  centers: CenterRecord[];
  admin: { uid: string; email: string };
  onUpdate: () => void;
}

import { pushToast } from "../../components/ui";

export function SubscriptionCenter({ centers, admin, onUpdate }: SubscriptionCenterProps) {
  const [search, setSearch] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<CenterRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"actions" | "payments" | "timeline" | "invoices" | "renewals">("actions");

  // Filter and search states
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Subcollection states for selected center
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected Invoice for printing modal
  const [viewInvoice, setViewInvoice] = useState<InvoiceRecord | null>(null);

  // Form states for various subscription operations
  const [extendDays, setExtendDays] = useState("30");
  const [trialDays, setTrialDays] = useState("7");
  const [trialPlan, setTrialPlan] = useState<SubscriptionPlan>("basic");
  const [freeDaysVal, setFreeDaysVal] = useState("5");
  const [discountVal, setDiscountVal] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [operationNotes, setOperationNotes] = useState("");

  // Plan modification form
  const [targetPlan, setTargetPlan] = useState<SubscriptionPlan>("basic");

  // Activate / Deactivate form
  const [activatePlan, setActivatePlan] = useState<SubscriptionPlan>("basic");
  const [activateDays, setActivateDays] = useState("30");
  const [activatePrice, setActivatePrice] = useState("150");
  const [activateMethod, setActivateMethod] = useState("InstaPay");
  const [activateTxId, setActivateTxId] = useState("");

  // Message toaster/banner state
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    pushToast(text, type);
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Automatically refresh selected center details when tab or selection changes
  const loadCenterDetails = async (centerId: string) => {
    setLoadingHistory(true);
    try {
      const [p, inv, t, r] = await Promise.all([
        fetchPayments(centerId),
        fetchInvoices(centerId),
        fetchTimelineEvents(centerId),
        fetchRenewals(centerId),
      ]);
      setPayments(p);
      setInvoices(inv);
      setTimeline(t);
      setRenewals(r);
    } catch (err) {
      console.error("Error loading subcollections:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedCenter) {
      loadCenterDetails(selectedCenter.id);
    }
  }, [selectedCenter]);

  // Handle outside reference change
  const currentCenter = (selectedCenter
    ? (centers.find((c) => c.id === selectedCenter.id) || selectedCenter)
    : {}) as CenterRecord;

  // Plan ordering to decide upgrade or downgrade
  const planOrder: Record<SubscriptionPlan, number> = {
    free: 0,
    basic: 1,
    pro: 2,
    enterprise: 3,
  };

  // 1. Upgrade / Downgrade Plan
  const handlePlanChange = async () => {
    if (!currentCenter) return;
    try {
      const isUpgrade = planOrder[targetPlan] > planOrder[currentCenter.subscriptionPlan];
      const actionType = isUpgrade ? "upgrade" : "downgrade";
      const actionLabel = isUpgrade ? "ترقية الخطة" : "تنزيل الخطة";

      const previousPlan = currentCenter.subscriptionPlan;
      const now = Date.now();

      // Update basic details on the center
      await updateSubscription(
        currentCenter.id,
        {
          subscriptionPlan: targetPlan,
          subscriptionStatus: "active",
          subscriptionStartDate: now,
          subscriptionEndDate: now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        },
        admin
      );
      await applyPlanFeatures(currentCenter.id, targetPlan, admin);

      // Log in timeline subcollection
      await addTimelineEvent(
        currentCenter.id,
        {
          type: actionType,
          title: `${actionLabel} إلى ${targetPlan.toUpperCase()}`,
          description: `تم تغيير خطة السنتر من ${previousPlan.toUpperCase()} إلى ${targetPlan.toUpperCase()}.${
            operationNotes ? ` ملاحظات: ${operationNotes}` : ""
          }`,
          previousPlan,
          newPlan: targetPlan,
        },
        admin
      );

      // Create an automatic invoice for history transparency
      const planPrice = PLAN_DEFINITIONS.find((p) => p.id === targetPlan)?.price || 0;
      await addInvoiceRecord(
        currentCenter.id,
        {
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          date: now,
          plan: targetPlan,
          amount: Number(planPrice),
          currency: "ج.م",
          status: "paid",
          billingEmail: currentCenter.ownerEmail,
          billingName: currentCenter.name,
        },
        admin
      );

      showToast(`تم ${actionLabel} بنجاح إلى الخطة الجديدة!`);
      setOperationNotes("");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("حدث خطأ أثناء تغيير الخطة.", "error");
    }
  };

  // 2. Extend Subscription
  const handleExtend = async () => {
    if (!currentCenter) return;
    const days = parseInt(extendDays);
    if (isNaN(days) || days <= 0) {
      showToast("يرجى إدخال عدد أيام صحيح.", "error");
      return;
    }

    try {
      const now = Date.now();
      const currentEnd = currentCenter.subscriptionEndDate || now;
      const baseDate = Math.max(currentEnd, now);
      const newEnd = baseDate + days * 86400000;

      await updateSubscription(
        currentCenter.id,
        {
          subscriptionStatus: "active",
          subscriptionEndDate: newEnd,
        },
        admin
      );

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "extend",
          title: "تمديد فترة الاشتراك",
          description: `تم تمديد فترة الاشتراك لمدة ${days} يوم إضافية. تاريخ الانتهاء الجديد: ${new Date(
            newEnd
          ).toLocaleDateString("ar-EG")}.${operationNotes ? ` ملاحظات: ${operationNotes}` : ""}`,
          daysAdded: days,
        },
        admin
      );

      // Add renewal record
      await addRenewalRecord(
        currentCenter.id,
        {
          plan: currentCenter.subscriptionPlan,
          previousExpiry: currentCenter.subscriptionEndDate,
          newExpiry: newEnd,
        },
        admin
      );

      showToast(`تم تمديد الاشتراك بنجاح لـ ${days} يوم!`);
      setOperationNotes("");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل تمديد الاشتراك.", "error");
    }
  };

  // 3. Pause Subscription
  const handlePause = async () => {
    if (!currentCenter) return;
    try {
      await updateSubscription(
        currentCenter.id,
        {
          subscriptionStatus: "paused",
        },
        admin
      );

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "pause",
          title: "إيقاف الاشتراك مؤقتاً",
          description: `قام المدير بإيقاف اشتراك السنتر بشكل مؤقت. الميزات معطلة الآن.`,
          previousStatus: currentCenter.subscriptionStatus,
          newStatus: "paused",
        },
        admin
      );

      showToast("تم إيقاف الاشتراك مؤقتاً بنجاح.");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل إيقاف الاشتراك مؤقتاً.", "error");
    }
  };

  // 4. Resume Subscription
  const handleResume = async () => {
    if (!currentCenter) return;
    try {
      await updateSubscription(
        currentCenter.id,
        {
          subscriptionStatus: "active",
        },
        admin
      );

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "resume",
          title: "استئناف تفعيل الاشتراك",
          description: `تم استئناف الاشتراك وإعادة تفعيل ميزات السنتر.`,
          previousStatus: currentCenter.subscriptionStatus,
          newStatus: "active",
        },
        admin
      );

      showToast("تم استئناف تفعيل الاشتراك بنجاح.");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل استئناف الاشتراك.", "error");
    }
  };

  // 5. Activate Subscription
  const handleActivate = async () => {
    if (!currentCenter) return;
    const days = parseInt(activateDays);
    const amount = parseFloat(activatePrice);

    if (isNaN(days) || days <= 0) {
      showToast("يرجى إدخال عدد أيام صحيح.", "error");
      return;
    }

    try {
      const now = Date.now();
      const endDate = now + days * 86400000;

      await updateSubscription(
        currentCenter.id,
        {
          subscriptionPlan: activatePlan,
          subscriptionStatus: "active",
          subscriptionStartDate: now,
          subscriptionEndDate: endDate,
        },
        admin
      );
      await applyPlanFeatures(currentCenter.id, activatePlan, admin);

      // Create Payment log
      await addPaymentRecord(
        currentCenter.id,
        {
          amount,
          currency: "ج.م",
          plan: activatePlan,
          date: now,
          method: activateMethod,
          transactionId: activateTxId || undefined,
          notes: operationNotes || undefined,
        },
        admin
      );

      // Create Invoice log
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      await addInvoiceRecord(
        currentCenter.id,
        {
          invoiceNumber: invNum,
          date: now,
          plan: activatePlan,
          amount,
          currency: "ج.م",
          status: "paid",
          paymentMethod: activateMethod,
          billingEmail: currentCenter.ownerEmail,
          billingName: currentCenter.name,
        },
        admin
      );

      // Create timeline event
      await addTimelineEvent(
        currentCenter.id,
        {
          type: "activate",
          title: `تفعيل خطة جديدة: ${activatePlan.toUpperCase()}`,
          description: `تم تفعيل اشتراك نشط لمدة ${days} يوم مدفوع عبر (${activateMethod}). رقم العملية: ${
            activateTxId || "غير متوفر"
          }.`,
          newPlan: activatePlan,
          newStatus: "active",
        },
        admin
      );

      showToast("تم تفعيل وتنشيط الاشتراك وتوليد الفاتورة بنجاح!");
      setOperationNotes("");
      setActivateTxId("");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل تنشيط الاشتراك.", "error");
    }
  };

  // 6. Deactivate Subscription
  const handleDeactivate = async () => {
    if (!currentCenter) return;
    try {
      await updateSubscription(
        currentCenter.id,
        {
          subscriptionStatus: "expired",
        },
        admin
      );

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "deactivate",
          title: "إلغاء تنشيط الاشتراك",
          description: `تم إنهاء وإلغاء تفعيل اشتراك السنتر من قبل الإدارة.`,
          previousStatus: currentCenter.subscriptionStatus,
          newStatus: "expired",
        },
        admin
      );

      showToast("تم إلغاء تنشيط الاشتراك بنجاح.");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل إلغاء تنشيط الاشتراك.", "error");
    }
  };

  // 7. Give Free Trial
  const handleGiveTrial = async () => {
    if (!currentCenter) return;
    const days = parseInt(trialDays);
    if (isNaN(days) || days <= 0) {
      showToast("يرجى إدخال عدد أيام صحيح.", "error");
      return;
    }

    try {
      const now = Date.now();
      const endDate = now + days * 86400000;

      await updateSubscription(
        currentCenter.id,
        {
          subscriptionPlan: trialPlan,
          subscriptionStatus: "trialing",
          subscriptionStartDate: now,
          subscriptionEndDate: endDate,
        },
        admin
      );
      await applyPlanFeatures(currentCenter.id, trialPlan, admin);

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "trial",
          title: `منح فترة تجريبية: ${trialPlan.toUpperCase()}`,
          description: `تم منح فترة تجريبية مجانية لخطة ${trialPlan.toUpperCase()} لمدة ${days} يوم. تاريخ انتهاء التجربة: ${new Date(
            endDate
          ).toLocaleDateString("ar-EG")}.`,
          newPlan: trialPlan,
          newStatus: "trialing",
          daysAdded: days,
        },
        admin
      );

      showToast(`تم منح فترة تجريبية مجانية لـ ${days} يوم بنجاح!`);
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل تفعيل الفترة التجريبية.", "error");
    }
  };

  // 8. Give Free Days
  const handleGiveFreeDays = async () => {
    if (!currentCenter) return;
    const days = parseInt(freeDaysVal);
    if (isNaN(days) || days <= 0) {
      showToast("يرجى إدخال عدد أيام صحيح.", "error");
      return;
    }

    try {
      const now = Date.now();
      const currentEnd = currentCenter.subscriptionEndDate || now;
      const baseDate = Math.max(currentEnd, now);
      const newEnd = baseDate + days * 86400000;

      await updateSubscription(
        currentCenter.id,
        {
          subscriptionEndDate: newEnd,
        },
        admin
      );

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "free_days",
          title: `منح أيام إضافية مجاناً`,
          description: `تمت إضافة ${days} يوم تعويضية/مجانية دون تكلفة للعميل. تاريخ الانتهاء الجديد: ${new Date(
            newEnd
          ).toLocaleDateString("ar-EG")}.${operationNotes ? ` السبب: ${operationNotes}` : ""}`,
          daysAdded: days,
        },
        admin
      );

      showToast(`تمت إضافة ${days} يوم مجانية للسنتر بنجاح.`);
      setOperationNotes("");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل منح الأيام المجانية.", "error");
    }
  };

  // 9. Apply Manual Discount
  const handleApplyDiscount = async () => {
    if (!currentCenter) return;
    const amount = parseFloat(discountVal);
    if (isNaN(amount) || amount <= 0) {
      showToast("يرجى إدخال قيمة خصم صحيحة.", "error");
      return;
    }
    if (!discountReason) {
      showToast("يرجى إدخال سبب تطبيق الخصم.", "error");
      return;
    }

    try {
      await updateSubscription(
        currentCenter.id,
        {
          discountAmount: amount,
          discountReason: discountReason,
        },
        admin
      );

      await addTimelineEvent(
        currentCenter.id,
        {
          type: "discount",
          title: `تطبيق خصم يدوي: -${amount} ج.م`,
          description: `تم تسجيل وتطبيق خصم يدوي بقيمة ${amount} ج.م على السنتر. السبب: ${discountReason}`,
          discountAmount: amount,
        },
        admin
      );

      showToast(`تم تسجيل وتطبيق الخصم اليدوي بقيمة -${amount} ج.م بنجاح.`);
      setDiscountVal("");
      setDiscountReason("");
      onUpdate();
      loadCenterDetails(currentCenter.id);
    } catch (err) {
      showToast("فشل تطبيق الخصم اليدوي.", "error");
    }
  };

  // Handle printing of receipt
  const printReceipt = () => {
    const printContent = document.getElementById("invoice-print-area");
    if (!printContent) return;

    const style = `
      <style>
        body { direction: rtl; font-family: 'Inter', 'Cairo', sans-serif; padding: 40px; color: #1e293b; background: white !important; }
        .receipt-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 650px; margin: 0 auto; }
        .receipt-header { display: flex; justify-content: space-between; border-b: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: bold; color: #0f172a; }
        .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .meta-item { font-size: 14px; }
        .meta-item span { font-weight: bold; }
        .items-table { w-full: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .items-table th { background: #f8fafc; text-align: right; padding: 10px; border-bottom: 2px solid #cbd5e1; }
        .items-table td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .total-box { text-align: left; font-size: 18px; font-weight: bold; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 12px; }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #64748b; }
      </style>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>وصل اشتراك - سنتر بلس</title>
            ${style}
          </head>
          <body>
            <div class="receipt-card">
              ${printContent.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  // Searching and Filtering main list
  const filteredCenters = centers.filter((c) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerEmail?.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "all" || c.subscriptionPlan === planFilter;
    const matchesStatus = statusFilter === "all" || c.subscriptionStatus === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  return (
    <div className="relative space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={cn(
              "fixed left-1/2 top-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-xl border text-sm font-bold",
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800"
            )}
            style={{ left: "50%" }}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-500" />
            )}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!selectedCenter ? (
          /* ============================== LIST VIEW ============================== */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Control & Filter Strip */}
            <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm md:grid-cols-4 md:items-center">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم السنتر أو البريد الإلكتروني للمالك..."
                  className="h-10 w-full rounded-xl border border-line bg-elevated/40 ps-9 pe-3 text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none"
                />
              </div>

              {/* Plan Filter */}
              <div>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand-400 focus:outline-none"
                >
                  <option value="all">كل الخطط</option>
                  <option value="free">مجاني (Free)</option>
                  <option value="basic">أساسي (Basic)</option>
                  <option value="pro">احترافي (Pro)</option>
                  <option value="enterprise">مؤسسي (Enterprise)</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand-400 focus:outline-none"
                >
                  <option value="all">كل حالات الاشتراك</option>
                  <option value="active">نشط (Active)</option>
                  <option value="trialing">تجريبي (Trialing)</option>
                  <option value="paused">موقوف مؤقتاً (Paused)</option>
                  <option value="canceled">ملغي (Canceled)</option>
                  <option value="expired">منتهي (Expired)</option>
                </select>
              </div>
            </div>

            {/* Subscriptions Table Card */}
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-elevated/20 text-[11px] uppercase text-faint">
                      <th className="px-4 py-3 text-start font-semibold">السنتر والمالك</th>
                      <th className="px-4 py-3 text-center font-semibold">الخطة الحالية</th>
                      <th className="px-4 py-3 text-center font-semibold">حالة الاشتراك</th>
                      <th className="px-4 py-3 text-center font-semibold">تاريخ الانتهاء</th>
                      <th className="px-4 py-3 text-center font-semibold">الطلاب / المعلمون</th>
                      <th className="px-4 py-3 text-end font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCenters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Building2 className="mx-auto mb-3 h-10 w-10 text-faint" />
                          <p className="text-sm font-medium text-muted">لا توجد سناتر تطابق فلاتر البحث</p>
                        </td>
                      </tr>
                    ) : (
                      filteredCenters.map((c) => {
                        const isExpired = c.subscriptionEndDate && c.subscriptionEndDate < Date.now();
                        return (
                          <tr
                            key={c.id}
                            className="border-b border-line/50 last:border-0 hover:bg-elevated/20 transition-all cursor-pointer"
                            onClick={() => setSelectedCenter(c)}
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-semibold text-ink leading-tight">{c.name || "بدون اسم"}</p>
                                  <p className="text-[10px] text-faint mt-0.5">{c.ownerEmail}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  c.subscriptionPlan === "enterprise"
                                    ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300"
                                    : c.subscriptionPlan === "pro"
                                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                                    : c.subscriptionPlan === "basic"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                    : "bg-faint/10 text-muted"
                                )}
                              >
                                {c.subscriptionPlan ? c.subscriptionPlan.toUpperCase() : "FREE"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                  c.subscriptionStatus === "active" && !isExpired
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                    : c.subscriptionStatus === "trialing" && !isExpired
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                    : c.subscriptionStatus === "paused"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                )}
                              >
                                {c.subscriptionStatus === "active" && !isExpired
                                  ? "نشط"
                                  : c.subscriptionStatus === "trialing" && !isExpired
                                  ? "تجريبي"
                                  : c.subscriptionStatus === "paused"
                                  ? "موقوف مؤقتاً"
                                  : isExpired
                                  ? "منتهي الصلاحية"
                                  : "غير نشط"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center text-xs text-muted">
                              {c.subscriptionEndDate ? (
                                <span className={cn(isExpired && "text-rose-500 font-semibold")}>
                                  {new Date(c.subscriptionEndDate).toLocaleDateString("ar-EG")}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center text-xs text-muted">
                              <span className="font-semibold text-ink">{c.studentCount || 0}</span> طالب /{" "}
                              <span className="font-semibold text-ink">{c.teacherCount || 0}</span> معلم
                            </td>
                            <td className="px-4 py-3.5 text-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCenter(c);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-line bg-elevated/40 px-2.5 py-1 text-xs font-bold text-muted transition hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/5"
                              >
                                إدارة الاشتراكات <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ============================== DETAIL WORKSPACE VIEW ============================== */
          <motion.div
            key="details"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="grid gap-6 lg:grid-cols-3"
          >
            {/* Left/Main Column: Center Info & Core Operations (Col-span 2) */}
            <div className="space-y-6 lg:col-span-2">
              {/* Back & Title Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedCenter(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-muted transition hover:bg-elevated/30 hover:text-ink"
                >
                  <ChevronRight className="h-4 w-4" /> العودة للوحة الاشتراكات
                </button>

                <button
                  onClick={() => currentCenter && loadCenterDetails(currentCenter.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink transition"
                  title="تحديث البيانات"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Main Info Card */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-brand-500 to-rose-500" />
                <div className="flex flex-wrap items-start justify-between gap-4 mt-1">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-ink leading-snug">{currentCenter.name}</h2>
                      <p className="text-xs text-faint">{currentCenter.ownerEmail}</p>
                      <p className="text-[10px] text-faint mt-1">المعرف: {currentCenter.id}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-faint uppercase font-bold tracking-widest">الخطة الحالية:</span>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-black uppercase text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                        {currentCenter.subscriptionPlan ? currentCenter.subscriptionPlan.toUpperCase() : "FREE"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-faint uppercase font-bold tracking-widest">حالة الاشتراك:</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                          currentCenter.subscriptionStatus === "active"
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : currentCenter.subscriptionStatus === "trialing"
                            ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                            : currentCenter.subscriptionStatus === "paused"
                            ? "bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300"
                            : "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300"
                        )}
                      >
                        {currentCenter.subscriptionStatus === "active"
                          ? "نشط"
                          : currentCenter.subscriptionStatus === "trialing"
                          ? "فترة تجريبية"
                          : currentCenter.subscriptionStatus === "paused"
                          ? "موقوف مؤقتاً"
                          : "منتهي / معطل"}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      ينتهي في:{" "}
                      <span className="font-semibold text-ink">
                        {currentCenter.subscriptionEndDate
                          ? new Date(currentCenter.subscriptionEndDate).toLocaleDateString("ar-EG")
                          : "غير محدد"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Subcollection Tabs Menu */}
              <div className="flex gap-1.5 border-b border-line pb-px overflow-x-auto">
                <button
                  onClick={() => setActiveTab("actions")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap",
                    activeTab === "actions"
                      ? "border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  <Plus className="h-4 w-4" /> عمليات التحكم والاشتراكات
                </button>
                <button
                  onClick={() => setActiveTab("payments")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap",
                    activeTab === "payments"
                      ? "border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  <CreditCard className="h-4 w-4" /> سجل المدفوعات ({payments.length})
                </button>
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap",
                    activeTab === "timeline"
                      ? "border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  <History className="h-4 w-4" /> الخط الزمني ({timeline.length})
                </button>
                <button
                  onClick={() => setActiveTab("invoices")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap",
                    activeTab === "invoices"
                      ? "border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  <FileText className="h-4 w-4" /> الفواتير ({invoices.length})
                </button>
                <button
                  onClick={() => setActiveTab("renewals")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap",
                    activeTab === "renewals"
                      ? "border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border-transparent text-muted hover:text-ink"
                  )}
                >
                  <RefreshCw className="h-4 w-4" /> تجديدات الاشتراك ({renewals.length})
                </button>
              </div>

              {/* Dynamic Sub-tab Panel */}
              <div className="min-h-[300px]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    {/* 1. OPERATIONS PANEL */}
                    {activeTab === "actions" && (
                      <motion.div
                        key="actions"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-6"
                      >
                        {/* Notes input */}
                        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                          <label className="block text-xs font-bold text-ink mb-1.5">
                            ملاحظات العملية (يتم تسجيلها تلقائياً في سجل الرقابة):
                          </label>
                          <textarea
                            value={operationNotes}
                            onChange={(e) => setOperationNotes(e.target.value)}
                            placeholder="أدخل سبباً أو ملاحظة إدارية لهذه المعاملة..."
                            className="w-full rounded-xl border border-line bg-elevated/40 p-2.5 text-xs text-ink focus:border-brand-400 focus:outline-none h-16 resize-none"
                          />
                        </div>

                        {/* Grid of Actions */}
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Upgrade / Downgrade Plan */}
                          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Crown className="h-5 w-5 text-purple-500" />
                                <h3 className="text-sm font-black text-ink">تعديل الخطة (ترقية / خفض)</h3>
                              </div>
                              <p className="text-xs text-muted mb-4 leading-relaxed">
                                تغيير خطة سنتر العميل بشكل فوري مع حفظ تاريخ الانتهاء الحالي. سيتم تحرير فاتورة بقيمة
                                الفرق أو الخطة تلقائياً.
                              </p>

                              <label className="block text-[11px] font-bold text-faint mb-1">اختر الخطة المطلوبة:</label>
                              <select
                                value={targetPlan}
                                onChange={(e) => setTargetPlan(e.target.value as SubscriptionPlan)}
                                className="h-9 w-full rounded-xl border border-line bg-surface px-2 text-xs text-ink mb-4"
                              >
                                <option value="free">مجاني (Free)</option>
                                <option value="basic">أساسي (Basic)</option>
                                <option value="pro">احترافي (Pro)</option>
                                <option value="enterprise">مؤسسي (Enterprise)</option>
                              </select>
                            </div>

                            <button
                              onClick={handlePlanChange}
                              className="w-full rounded-xl bg-brand-500 py-2 text-xs font-bold text-white hover:bg-brand-600 transition"
                            >
                              حفظ الخطة وتحديث الميزات
                            </button>
                          </div>

                          {/* Extend Subscription */}
                          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Calendar className="h-5 w-5 text-blue-500" />
                                <h3 className="text-sm font-black text-ink">تمديد فترة الاشتراك</h3>
                              </div>
                              <p className="text-xs text-muted mb-4 leading-relaxed">
                                إضافة أيام تمديد إضافية لاشتراك العميل الحالي. يتم الحساب ابتداءً من تاريخ الانتهاء
                                الحالي أو اليوم (أيهما أحدث).
                              </p>

                              <label className="block text-[11px] font-bold text-faint mb-1">عدد الأيام للتمديد:</label>
                              <div className="flex gap-2 mb-4">
                                <input
                                  type="number"
                                  value={extendDays}
                                  onChange={(e) => setExtendDays(e.target.value)}
                                  className="h-9 flex-1 rounded-xl border border-line bg-surface px-3 text-xs text-ink"
                                />
                                <div className="flex gap-1">
                                  {["30", "90", "365"].map((d) => (
                                    <button
                                      key={d}
                                      onClick={() => setExtendDays(d)}
                                      className="h-9 px-2 text-[10px] font-bold bg-elevated/40 border border-line rounded-xl text-muted hover:bg-elevated hover:text-ink transition"
                                    >
                                      {d === "365" ? "سنة" : `${d} يوم`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={handleExtend}
                              className="w-full rounded-xl bg-blue-500 py-2 text-xs font-bold text-white hover:bg-blue-600 transition"
                            >
                              تطبيق التمديد الزمني
                            </button>
                          </div>

                          {/* Pause / Resume Subscription */}
                          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Pause className="h-5 w-5 text-amber-500" />
                                <h3 className="text-sm font-black text-ink">إيقاف مؤقت / استئناف</h3>
                              </div>
                              <p className="text-xs text-muted mb-4 leading-relaxed">
                                يمكنك تعليق تفعيل السنتر بشكل مؤقت (سيعطل جميع ميزات النظام للطلاب والمعلمين)، أو استئناف
                                العمل في أي وقت.
                              </p>
                            </div>

                            <div className="flex gap-2">
                              {currentCenter.subscriptionStatus === "paused" ? (
                                <button
                                  onClick={handleResume}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition"
                                >
                                  <Play className="h-4 w-4" /> استئناف التفعيل
                                </button>
                              ) : (
                                <button
                                  onClick={handlePause}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white hover:bg-amber-600 transition"
                                >
                                  <Pause className="h-4 w-4" /> إيقاف مؤقت
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Give Free Trial */}
                          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-5 w-5 text-yellow-500" />
                                <h3 className="text-sm font-black text-ink">منح فترة تجريبية مجانية</h3>
                              </div>
                              <p className="text-xs text-muted mb-3 leading-relaxed">
                                تفعيل وصول تجريبي مجاني لسنتر العميل. يقوم بتعيين حالة الاشتراك إلى "تجريبي" ويمنحه أيام
                                للتشغيل.
                              </p>

                              <div className="grid grid-cols-2 gap-2 mb-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-faint mb-1">الخطة التجريبية:</label>
                                  <select
                                    value={trialPlan}
                                    onChange={(e) => setTrialPlan(e.target.value as SubscriptionPlan)}
                                    className="h-8 w-full rounded-lg border border-line bg-surface px-1 text-xs text-ink"
                                  >
                                    <option value="basic">أساسي (Basic)</option>
                                    <option value="pro">احترافي (Pro)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-faint mb-1">الأيام الممنوحة:</label>
                                  <input
                                    type="number"
                                    value={trialDays}
                                    onChange={(e) => setTrialDays(e.target.value)}
                                    className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={handleGiveTrial}
                              className="w-full rounded-xl bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
                            >
                              تفعيل التجريب المجاني
                            </button>
                          </div>

                          {/* Give Free Days */}
                          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Percent className="h-5 w-5 text-emerald-500" />
                                <h3 className="text-sm font-black text-ink">منح أيام تعويضية مجانية</h3>
                              </div>
                              <p className="text-xs text-muted mb-4 leading-relaxed">
                                إضافة عدد محدود من الأيام التعويضية المجانية دون تكلفة أو تحرير فواتير، تقديراً لخدمة
                                العملاء أو التعويض.
                              </p>

                              <label className="block text-[11px] font-bold text-faint mb-1">عدد الأيام المجانية:</label>
                              <div className="flex gap-2 mb-4">
                                <input
                                  type="number"
                                  value={freeDaysVal}
                                  onChange={(e) => setFreeDaysVal(e.target.value)}
                                  className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink"
                                />
                              </div>
                            </div>

                            <button
                              onClick={handleGiveFreeDays}
                              className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                            >
                              إضافة أيام تعويضية مجانية
                            </button>
                          </div>

                          {/* Manual Discount registration */}
                          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Coins className="h-5 w-5 text-indigo-500" />
                                <h3 className="text-sm font-black text-ink">تسجيل خصم يدوي خاص</h3>
                              </div>
                              <p className="text-xs text-muted mb-3 leading-relaxed">
                                تطبيق وتسجيل خصم نقدي خاص على معاملات السنتر المستقبلية أو للتسوية الإدارية.
                              </p>

                              <div className="grid grid-cols-2 gap-2 mb-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-faint mb-1">قيمة الخصم (ج.م):</label>
                                  <input
                                    type="number"
                                    value={discountVal}
                                    onChange={(e) => setDiscountVal(e.target.value)}
                                    placeholder="مثال: 50"
                                    className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-faint mb-1">السبب / الكود:</label>
                                  <input
                                    type="text"
                                    value={discountReason}
                                    onChange={(e) => setDiscountReason(e.target.value)}
                                    placeholder="كود تسويقي أو تعويض"
                                    className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={handleApplyDiscount}
                              className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                            >
                              تسجيل الخصم اليدوي
                            </button>
                          </div>
                        </div>

                        {/* Complete Activate / Manual Settlement Card */}
                        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm relative">
                          <div className="absolute top-3 left-3 bg-rose-500/10 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            تنشيط متكامل
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="h-5 w-5 text-rose-500" />
                            <h3 className="text-sm font-black text-ink">تنشيط اشتراك متكامل (مع إصدار إيصال مالي وفاتورة)</h3>
                          </div>
                          <p className="text-xs text-muted mb-4 leading-relaxed">
                            لتأكيد تحصيل المبالغ يدوياً خارج المنصة (إيداعات فودافون كاش، إنستا باي، تبرعات، تحويل بنكي)،
                            سيقوم هذا الإجراء بتعيين الاشتراك إلى "نشط"، وتوليد فاتورة رسمية للمشترك، وإضافة قيد مالي في سجل
                            المدفوعات لتسوية الحسابات.
                          </p>

                          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 mb-5">
                            <div>
                              <label className="block text-[11px] font-bold text-muted mb-1">الخطة المدفوعة:</label>
                              <select
                                value={activatePlan}
                                onChange={(e) => setActivatePlan(e.target.value as SubscriptionPlan)}
                                className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                              >
                                <option value="basic">أساسي (Basic)</option>
                                <option value="pro">احترافي (Pro)</option>
                                <option value="enterprise">مؤسسي (Enterprise)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-muted mb-1">مدة الاشتراك (أيام):</label>
                              <input
                                type="number"
                                value={activateDays}
                                onChange={(e) => setActivateDays(e.target.value)}
                                className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-muted mb-1">المبلغ المحصل (ج.م):</label>
                              <input
                                type="number"
                                value={activatePrice}
                                onChange={(e) => setActivatePrice(e.target.value)}
                                className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-muted mb-1">وسيلة الدفع يدوياً:</label>
                              <select
                                value={activateMethod}
                                onChange={(e) => setActivateMethod(e.target.value)}
                                className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                              >
                                <option value="Vodafone Cash">Vodafone Cash</option>
                                <option value="InstaPay">InstaPay</option>
                                <option value="Bank Transfer">تحويل بنكي</option>
                                <option value="Cash">كاش يدوياً</option>
                                <option value="Other">وسيلة أخرى</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-muted mb-1">رقم المعاملة / مراجعة:</label>
                              <input
                                type="text"
                                value={activateTxId}
                                onChange={(e) => setActivateTxId(e.target.value)}
                                placeholder="اختياري"
                                className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleActivate}
                              className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-xs font-black text-white hover:shadow-lg transition"
                            >
                              تنشيط متكامل وتوليد السجلات والفواتير يدوياً
                            </button>

                            <button
                              onClick={handleDeactivate}
                              className="px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                            >
                              إلغاء تنشيط الاشتراك (تعطيل يدوي)
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* 2. PAYMENTS TAB */}
                    {activeTab === "payments" && (
                      <motion.div
                        key="payments"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-line bg-elevated/20 text-[11px] uppercase text-faint">
                                <th className="px-4 py-3 text-start font-semibold">تاريخ العملية</th>
                                <th className="px-4 py-3 text-center font-semibold">الخطة</th>
                                <th className="px-4 py-3 text-center font-semibold">المبلغ المسدد</th>
                                <th className="px-4 py-3 text-center font-semibold">طريقة التحصيل</th>
                                <th className="px-4 py-3 text-center font-semibold">معرف المعاملة</th>
                                <th className="px-4 py-3 text-end font-semibold">ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-12 text-center text-muted text-xs">
                                    <CreditCard className="mx-auto mb-3 h-8 w-8 text-faint" />
                                    لا توجد مدفوعات مسجلة يدوياً بعد للسنتر. يمكنك إضافة مدفوعات جديدة عبر قسم التنشيط
                                    المتكامل.
                                  </td>
                                </tr>
                              ) : (
                                payments.map((p) => (
                                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-elevated/10">
                                    <td className="px-4 py-3.5 text-xs text-ink font-medium">
                                      {new Date(p.date).toLocaleString("ar-EG")}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs">
                                      <span className="font-bold uppercase text-brand-600 dark:text-brand-400">
                                        {p.plan.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs font-bold text-emerald-600">
                                      {p.amount} {p.currency}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs text-muted font-medium">
                                      {p.method}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs font-mono text-faint">
                                      {p.transactionId || "—"}
                                    </td>
                                    <td className="px-4 py-3.5 text-end text-xs text-muted max-w-[200px] truncate">
                                      {p.notes || "—"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}

                    {/* 3. TIMELINE TAB */}
                    {activeTab === "timeline" && (
                      <motion.div
                        key="timeline"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border border-line bg-surface p-6 shadow-sm space-y-6"
                      >
                        {timeline.length === 0 ? (
                          <div className="py-12 text-center text-muted text-xs">
                            <History className="mx-auto mb-3 h-8 w-8 text-faint" />
                            لا توجد سجلات خط زمني مسجلة بعد لهذا السنتر.
                          </div>
                        ) : (
                          <div className="relative border-s border-line pr-4 space-y-8 mr-2">
                            {timeline.map((evt) => (
                              <div key={evt.id} className="relative">
                                {/* Dot indicator */}
                                <span
                                  className={cn(
                                    "absolute -start-[26px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-surface",
                                    evt.type === "upgrade" || evt.type === "activate"
                                      ? "bg-emerald-500 text-white"
                                      : evt.type === "downgrade" || evt.type === "deactivate"
                                      ? "bg-rose-500 text-white"
                                      : evt.type === "pause"
                                      ? "bg-amber-500 text-white"
                                      : evt.type === "free_days" || evt.type === "trial"
                                      ? "bg-yellow-500 text-white"
                                      : "bg-brand-500 text-white"
                                  )}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                </span>

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-black text-ink leading-none">{evt.title}</h4>
                                    <span className="text-[10px] text-faint font-medium">
                                      {new Date(evt.timestamp).toLocaleString("ar-EG")}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted leading-relaxed">{evt.description}</p>
                                  <div className="flex items-center gap-2 pt-1 text-[10px] text-faint">
                                    <span>بواسطة: {evt.adminEmail}</span>
                                    {evt.previousPlan && (
                                      <span>
                                        · الخطة السابقة:{" "}
                                        <span className="uppercase font-semibold">{evt.previousPlan}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* 4. INVOICES TAB */}
                    {activeTab === "invoices" && (
                      <motion.div
                        key="invoices"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-line bg-elevated/20 text-[11px] uppercase text-faint">
                                <th className="px-4 py-3 text-start font-semibold">رقم الفاتورة</th>
                                <th className="px-4 py-3 text-center font-semibold">تاريخ الفاتورة</th>
                                <th className="px-4 py-3 text-center font-semibold">الخطة</th>
                                <th className="px-4 py-3 text-center font-semibold">المبلغ الإجمالي</th>
                                <th className="px-4 py-3 text-center font-semibold">حالة الدفع</th>
                                <th className="px-4 py-3 text-end font-semibold">الوصول</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-12 text-center text-muted text-xs">
                                    <FileText className="mx-auto mb-3 h-8 w-8 text-faint" />
                                    لا توجد فواتير أو وصولات محررة للسنتر بعد.
                                  </td>
                                </tr>
                              ) : (
                                invoices.map((inv) => (
                                  <tr
                                    key={inv.id}
                                    className="border-b border-line/50 last:border-0 hover:bg-elevated/10"
                                  >
                                    <td className="px-4 py-3.5 text-xs font-mono font-bold text-ink">
                                      {inv.invoiceNumber}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs text-muted">
                                      {new Date(inv.date).toLocaleDateString("ar-EG")}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs font-semibold uppercase text-ink">
                                      {inv.plan.toUpperCase()}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs font-extrabold text-brand-600">
                                      {inv.amount} {inv.currency}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs">
                                      <span
                                        className={cn(
                                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold",
                                          inv.status === "paid"
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                            : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                        )}
                                      >
                                        {inv.status === "paid" ? "مدفوع" : "غير مدفوع"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-end text-xs">
                                      <button
                                        onClick={() => setViewInvoice(inv)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated/30 px-2.5 py-1 text-[11px] font-bold text-muted transition hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                                      >
                                        <Printer className="h-3.5 w-3.5" /> عرض وطباعة الإيصال
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}

                    {/* 5. RENEWALS TAB */}
                    {activeTab === "renewals" && (
                      <motion.div
                        key="renewals"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-line bg-elevated/20 text-[11px] uppercase text-faint">
                                <th className="px-4 py-3 text-start font-semibold">تاريخ التجديد</th>
                                <th className="px-4 py-3 text-center font-semibold">الخطة المعنية</th>
                                <th className="px-4 py-3 text-center font-semibold">الانتهاء السابق</th>
                                <th className="px-4 py-3 text-center font-semibold">الانتهاء الجديد</th>
                                <th className="px-4 py-3 text-end font-semibold">المدير المسؤول</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renewals.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="py-12 text-center text-muted text-xs">
                                    <RefreshCw className="mx-auto mb-3 h-8 w-8 text-faint" />
                                    لا توجد تجديدات اشتراك مسبقة مسجلة.
                                  </td>
                                </tr>
                              ) : (
                                renewals.map((r) => (
                                  <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-elevated/10">
                                    <td className="px-4 py-3.5 text-xs text-ink font-medium">
                                      {new Date(r.date).toLocaleString("ar-EG")}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs font-bold uppercase text-brand-600 dark:text-brand-400">
                                      {r.plan.toUpperCase()}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs text-muted font-medium">
                                      {r.previousExpiry
                                        ? new Date(r.previousExpiry).toLocaleDateString("ar-EG")
                                        : "—"}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs font-bold text-emerald-600">
                                      {new Date(r.newExpiry).toLocaleDateString("ar-EG")}
                                    </td>
                                    <td className="px-4 py-3.5 text-end text-xs text-faint font-mono">
                                      {r.adminEmail}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Right Column: Quick Stats & Center Details Sidebar */}
            <div className="space-y-6">
              {/* Plan limits detail card */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <h3 className="text-sm font-black text-ink mb-3 border-b border-line pb-2 flex items-center gap-1.5">
                  <Crown className="h-4 w-4 text-brand-500" /> حدود السنتر وقدراته الحالية
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">الطلاب المسجلون</span>
                      <span className="font-bold text-ink">
                        {currentCenter.studentCount || 0}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">المعلمون النشطون</span>
                      <span className="font-bold text-ink">
                        {currentCenter.teacherCount || 0}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-line pt-3 mt-3">
                    <p className="text-[10px] text-faint mb-2">حدود الخطة الافتراضية للسنتر:</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-elevated/30 p-2 rounded-lg">
                        <span className="text-faint block">أقصى عدد طلاب:</span>
                        <span className="font-bold text-ink text-xs">
                          {currentCenter.customLimits?.maxStudents || "افتراضي"}
                        </span>
                      </div>
                      <div className="bg-elevated/30 p-2 rounded-lg">
                        <span className="text-faint block">أقصى عدد معلمين:</span>
                        <span className="font-bold text-ink text-xs">
                          {currentCenter.customLimits?.maxTeachers || "افتراضي"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick instructions / Help guide */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <h3 className="text-sm font-black text-ink mb-3 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-brand-500" /> دليل العمليات الآلي
                </h3>
                <ul className="text-xs text-muted space-y-2 list-disc pr-4 leading-relaxed">
                  <li>يتم تسجيل وتوثيق كل معاملة وتعديل تلقائياً في الخط الزمني وقسم الأمان.</li>
                  <li>عند تمديد الاشتراك، يتم الحساب فوراً وإخطار العميل بصفحة إشعاراته.</li>
                  <li>تنشيط الاشتراك المتكامل سيضيف قيداً مالياً في سجل الخزينة، مما يجعله مثالياً لمراجعة الحسابات اليدوية.</li>
                  <li>الخصومات اليدوية المسجلة تظهر للمشرف لمتابعة كفاءة وتنافسية العروض الممنوحة.</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INVOICE PRINT MODAL */}
      <AnimatePresence>
        {viewInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl overflow-hidden"
            >
              <button
                onClick={() => setViewInvoice(null)}
                className="absolute top-4 left-4 h-8 w-8 flex items-center justify-center rounded-xl bg-elevated/50 text-muted hover:text-ink transition"
              >
                <X className="h-4 w-4" />
              </button>

              <h2 className="text-md font-black text-ink mb-6 pb-2 border-b border-line flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-500" /> تفاصيل إيصال الاشتراك الرسمي
              </h2>

              {/* Printable Area */}
              <div id="invoice-print-area" className="p-4 rounded-xl border border-line bg-elevated/10">
                <div className="flex justify-between items-start border-b border-line pb-4 mb-6">
                  <div>
                    <h3 className="text-xl font-black text-brand-600">سنتر بلس - CenterPlus</h3>
                    <p className="text-xs text-faint mt-1">منصة الإدارة والتعليم الذكي للسناتر والمجمعات التعليمية</p>
                    <p className="text-[10px] text-faint">مصر · القاهرة · البريد الإلكتروني: support@centerplus.com</p>
                  </div>
                  <div className="text-left">
                    <span className="inline-block bg-emerald-500/10 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full mb-2">
                      مكتملة الدفع (PAID)
                    </span>
                    <p className="text-xs text-muted">
                      رقم الإيصال: <span className="font-mono font-bold text-ink">{viewInvoice.invoiceNumber}</span>
                    </p>
                    <p className="text-xs text-muted">
                      تاريخ المعاملة: <span className="font-bold text-ink">{new Date(viewInvoice.date).toLocaleDateString("ar-EG")}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                  <div>
                    <span className="text-faint block font-bold mb-1">الجهة المصدرة للطلب:</span>
                    <p className="font-bold text-ink">{viewInvoice.billingName || "سنتر تعليمي مشترك"}</p>
                    <p className="text-muted">{viewInvoice.billingEmail}</p>
                  </div>
                  <div>
                    <span className="text-faint block font-bold mb-1">وسيلة الدفع والتحصيل:</span>
                    <p className="font-semibold text-ink">{viewInvoice.paymentMethod || "دفع إلكتروني يدوياً"}</p>
                    <p className="text-muted">المنشئ: {admin.email}</p>
                  </div>
                </div>

                <table className="w-full text-xs text-right border-collapse mb-6">
                  <thead>
                    <tr className="bg-elevated border-b border-line/60">
                      <th className="p-2 font-bold">بند الخدمة واشتراك النظام</th>
                      <th className="p-2 font-bold text-center">الخطة الممنوحة</th>
                      <th className="p-2 font-bold text-left">قيمة المعاملة الإجمالية</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line/30">
                      <td className="p-3">
                        <p className="font-bold text-ink">اشتراك وتنشيط حزمة سنتر بلس السحابية</p>
                        <p className="text-[10px] text-faint">يشمل كافة التراخيص والوصول الفوري لجميع المميزات المتاحة بالخطة.</p>
                      </td>
                      <td className="p-3 text-center uppercase font-bold text-ink">{viewInvoice.plan}</td>
                      <td className="p-3 text-left font-bold text-ink">{viewInvoice.amount} {viewInvoice.currency}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between items-center border-t border-line pt-4 text-sm font-bold">
                  <span className="text-ink">المبلغ الإجمالي المسدد:</span>
                  <span className="text-lg font-black text-emerald-600">{viewInvoice.amount} {viewInvoice.currency}</span>
                </div>

                <div className="text-center mt-8 pt-4 border-t border-line/30 text-[10px] text-faint">
                  شكراً لثقتكم واختياركم منصة سنتر بلس. هذا الإيصال تم توليده آلياً ولا يتطلب توقيعاً رسمياً.
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  onClick={() => setViewInvoice(null)}
                  className="px-4 py-2 rounded-xl border border-line bg-surface text-xs font-bold text-muted hover:bg-elevated transition"
                >
                  إغلاق النافذة
                </button>
                <button
                  onClick={printReceipt}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-bold text-white flex items-center gap-1.5 transition"
                >
                  <Printer className="h-4 w-4" /> طباعة الإيصال الفوري
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
