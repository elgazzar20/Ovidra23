import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check, Crown, Sparkles, MessageCircle, ArrowLeft, Shield,
  CheckCircle2, Copy, Database, Users, GraduationCap,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, Badge } from "../components/ui";
import { PLAN_DEFINITIONS, PAYMENT_DETAILS } from "../lib/superadmin";
import { cn } from "../utils/cn";

export function Upgrade({ onClose }: { onClose: () => void }) {
  const { lang, subscriptionPlan, subscriptionEndDate, discountAmount, discountReason, db, isSubscriptionExpired, activateLicenseKey } = useApp();
  const isAr = lang === "ar";

  const planOrder: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };
  const currentLevel = planOrder[subscriptionPlan] ?? 0;

  const initialSelectedPlan = PLAN_DEFINITIONS.find((p) => p.id !== "free")?.id ?? "pro";
  const [selectedPlanId, setSelectedPlanId] = useState<"pro" | "enterprise">(initialSelectedPlan as "pro" | "enterprise");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [activationError, setActivationError] = useState("");
  const [activationSuccess, setActivationSuccess] = useState(false);

  const copyNumber = () => {
    navigator.clipboard?.writeText(PAYMENT_DETAILS.paymentNumber);
  };

  // Build a reliable WhatsApp deep link. wa.me works on web + mobile + desktop
  // (the old api.whatsapp.com/send endpoint often fails on the static host).
  const waLink = (text: string) => {
    const phone = (PAYMENT_DETAILS.whatsappNumber || "").replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const openWhatsApp = (planName: string) => {
    const periodName = billingCycle === "monthly" ? (isAr ? "الشهري" : "Monthly") : (isAr ? "السنوي (مع خصم 10%)" : "Annual (with 10% discount)");
    const msg = isAr
      ? `السلام عليكم، أريد ترقية الاشتراك إلى الخطة ${planName} - الاشتراك ${periodName}`
      : `Hello, I want to upgrade to the ${planName} plan - ${periodName} subscription`;
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
  };

  const handleActivateLicense = () => {
    setActivationError("");
    setActivationSuccess(false);
    if (!licenseKeyInput.trim()) {
      setActivationError(isAr ? "الرجاء إدخال مفتاح الترخيص" : "Please enter the license key");
      return;
    }
    const res = activateLicenseKey ? activateLicenseKey(licenseKeyInput.trim()) : { ok: false, error: isAr ? "الرجاء تحديث الصفحة" : "Please refresh the page" };
    if (res.ok) {
      setActivationSuccess(true);
      setLicenseKeyInput("");
    } else {
      setActivationError(res.error || (isAr ? "فشل التفعيل، تأكد من صحة كود التفعيل ومطابقته لبيانات هذا المركز" : "Activation failed. Please check the license key details."));
    }
  };

  const openWhatsAppService = () => {
    const msg = isAr
      ? "السلام عليكم، أريد خدمة نقل البيانات. سنتر بلس ديسكتوب"
      : "Hello, I want the data migration service. Center Plus Desktop";
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
  };

  const studentCount = db.students.length;
  const teacherCount = db.teachers.length;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {isAr ? "رجوع" : "Back"}
          </button>
          <div className="ms-auto flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h1 className="text-sm font-bold text-ink">{isAr ? "ترقية الاشتراك" : "Upgrade"}</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Expiry Warning Screen */}
        {isSubscriptionExpired && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 border border-rose-500/30 bg-rose-500/10 p-5 rounded-2xl text-center"
          >
            <Shield className="mx-auto h-8 w-8 text-rose-500 mb-2 animate-pulse" />
            <h3 className="text-lg font-bold text-rose-700 dark:text-rose-400">
              {isAr ? "انتهت فترة اشتراكك الحالية!" : "Your current subscription has expired!"}
            </h3>
            <p className="mt-1 text-sm text-rose-600 dark:text-rose-300">
              {isAr
                ? `لقد انتهت خطتك المدفوعة قبل ${Math.max(1, Math.ceil((Date.now() - (subscriptionEndDate ?? 0)) / 86400000))} يوم. تم الانتقال تلقائيًا لوضع القراءة فقط.`
                : `Your paid plan expired ${Math.max(1, Math.ceil((Date.now() - (subscriptionEndDate ?? 0)) / 86400000))} day(s) ago. Read-only mode is active.`}
            </p>
            <p className="mt-2 text-xs text-rose-500 max-w-xl mx-auto">
              {isAr
                ? "يمكنك تصفح، والبحث في، وتصدير كل السجلات والبيانات بشكل كامل ومجاني، ولكن تم تعليق الإضافة والتعديل مؤقتًا حتى يتم تفعيل أو تجديد الاشتراك."
                : "You can search, view, and export all records for free, but creating/editing is paused until a valid license is activated."}
            </p>
          </motion.div>
        )}

        {/* Plan Extension / Free Days Banner (shown when plan is active and was recently updated by admin) */}
        {!isSubscriptionExpired && subscriptionPlan !== "free" && subscriptionEndDate && subscriptionEndDate > Date.now() && (() => {
          const daysLeft = Math.ceil((subscriptionEndDate - Date.now()) / 86400000);
          const planName = subscriptionPlan === "pro" ? (isAr ? "الاحترافية" : "Pro") : subscriptionPlan === "enterprise" ? (isAr ? "المؤسسية" : "Enterprise") : subscriptionPlan;
          return (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 border border-brand-500/30 bg-gradient-to-br from-brand-50 to-violet-50 p-5 rounded-2xl text-center dark:from-brand-500/10 dark:to-violet-500/10 relative overflow-hidden"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-300/20 blur-2xl" />
              <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-violet-300/20 blur-2xl" />
              <div className="relative">
                <Crown className="mx-auto h-7 w-7 text-brand-600 dark:text-brand-400 mb-2" />
                <h3 className="text-base font-bold text-brand-700 dark:text-brand-300">
                  {isAr ? `خطة ${planName} مفعّلة ✨` : `${planName} Plan Active ✨`}
                </h3>
                <p className="mt-1 text-sm text-brand-600 dark:text-brand-300">
                  {isAr
                    ? `متبقي ${daysLeft} يوم على انتهاء اشتراكك. تاريخ الانتهاء: ${new Date(subscriptionEndDate).toLocaleDateString("ar-EG")}`
                    : `${daysLeft} days remaining. Expires: ${new Date(subscriptionEndDate).toLocaleDateString()}`}
                </p>
              </div>
            </motion.div>
          );
        })()}

        {/* Special Discount Alert Banner */}
        {discountAmount && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 border border-emerald-500/30 bg-emerald-500/10 p-5 rounded-2xl text-right relative overflow-hidden"
            dir="rtl"
          >
            <div className="absolute left-4 top-4 rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              {isAr ? "تهانينا! لديك خصم إداري خاص مفعّل 🎉" : "Congratulations! Special discount active 🎉"}
            </h3>
            <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">
              {isAr
                ? `تم تطبيق خصم بقيمة ${discountAmount} ج.م على خطتك الاشتراكية.`
                : `A special discount of ${discountAmount} EGP has been applied to your plan.`}
            </p>
            {discountReason && (
              <p className="mt-2 text-xs text-emerald-500/80 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10 inline-block">
                {isAr ? `سبب الخصم: ${discountReason}` : `Reason: ${discountReason}`}
              </p>
            )}
          </motion.div>
        )}

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {isAr ? "اكتشف المزيد من المميزات القوية" : "Discover More Powerful Features"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {isAr
              ? `خطتك الحالية: ${subscriptionPlan === "free" ? "مجانية" : subscriptionPlan === "pro" ? "احترافية" : "مؤسسية"} — ${studentCount} طالب، ${teacherCount} معلم`
              : `Current plan: ${subscriptionPlan} — ${studentCount} students, ${teacherCount} teachers`}
          </p>
        </motion.div>

        {/* Billing Cycle Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface p-1 shadow-sm">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer",
                billingCycle === "monthly"
                  ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {isAr ? "شهرياً" : "Monthly"}
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "relative rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1",
                billingCycle === "annual"
                  ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              <span>{isAr ? "سنوياً" : "Annually"}</span>
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-600 dark:text-amber-400">
                10% {isAr ? "خصم" : "OFF"}
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid - Show ALL plans */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PLAN_DEFINITIONS.map((plan, i) => {
            const isCurrentPlan = plan.id === subscriptionPlan;
            const canUpgrade = planOrder[plan.id] > currentLevel;
            const isEnterprise = plan.id === "enterprise";
            const isSelected = selectedPlanId === (plan.id as any) && plan.id !== "free";
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => { if (plan.id !== "free") setSelectedPlanId(plan.id as "pro" | "enterprise"); }}
                className={cn(
                  "relative rounded-2xl border-2 p-5 pt-7 cursor-pointer transition-all duration-200 select-none flex flex-col",
                  isEnterprise
                    ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 shadow-xl shadow-amber-500/20 dark:border-amber-500/40 dark:from-amber-500/10 dark:via-surface dark:to-amber-500/5"
                    : "bg-surface shadow-sm",
                  !isEnterprise && (isSelected
                    ? "border-brand-500 ring-2 ring-brand-500/20 shadow-lg shadow-brand-500/10"
                    : isCurrentPlan
                      ? "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-600/40"
                      : "border-line hover:border-brand-300 hover:shadow-md"),
                  isSelected && isEnterprise && "ring-2 ring-amber-400/50",
                )}
              >
                {/* premium glow for enterprise (contained so it won't clip badges) */}
                {isEnterprise && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-amber-300/40 blur-3xl" />
                    <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-orange-300/20 blur-3xl" />
                  </div>
                )}
                {/* Badges — placed inside top so they're never clipped */}
                <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                  {isCurrentPlan ? (
                    <Badge tone="success" className="px-3 py-1 text-[11px]">{isAr ? "خطتك الحالية" : "Current Plan"}</Badge>
                  ) : isEnterprise ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-[11px] font-bold text-white shadow-lg shadow-amber-500/40">
                      <Crown className="h-3 w-3" />{isAr ? "الأفضل" : "Best Value"}
                    </span>
                  ) : plan.id === "pro" ? (
                    <Badge tone="brand" className="px-3 py-1 text-[11px]">{isAr ? "الأكثر شيوعاً" : "Most Popular"}</Badge>
                  ) : null}
                </div>

                {/* Plan Name & Price */}
                <div className="text-center pt-1">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold", isEnterprise ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : plan.color)}>
                    {isEnterprise && <Crown className="h-3 w-3" />}{plan.name}
                  </span>
                  <div className="mt-3 flex items-baseline justify-center gap-1">
                    <span className={cn("text-4xl font-extrabold", isEnterprise ? "bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-400" : "text-ink")}>
                      {plan.id === "free" ? 0 : billingCycle === "monthly" ? plan.price : Math.round(plan.price * 12 * 0.9)}
                    </span>
                    <span className="text-sm text-muted">{isAr ? "ج.م" : "EGP"}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {plan.id === "free" 
                      ? (isAr ? "مجاني للأبد" : "Free forever") 
                      : billingCycle === "monthly" 
                        ? (isAr ? "شهرياً" : "/month") 
                        : (isAr ? "سنوياً" : "/year")}
                  </p>
                  {plan.id !== "free" && billingCycle === "annual" && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {isAr ? `توفير ${Math.round(plan.price * 12 * 0.1)} ج.م (خصم 10%)` : `Save EGP ${Math.round(plan.price * 12 * 0.1)} (10% off)`}
                    </p>
                  )}
                  {plan.id !== "free" && (
                    <div className="mt-3 border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 rounded-xl text-center">
                      <p className="text-[9px] text-faint">
                        {isAr ? "سيعمل الاشتراك حتى:" : "Will run until:"}
                      </p>
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {new Date(Date.now() + (billingCycle === "monthly" ? 30 : 365) * 24 * 60 * 60 * 1000).toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Limits */}
                <div className="mt-4 flex gap-2 justify-center">
                  <div className="flex items-center gap-1.5 rounded-lg bg-elevated/60 px-2.5 py-1.5 text-[11px]">
                    <Users className="h-3.5 w-3.5 text-brand-500" />
                    <span className="text-ink font-semibold">{plan.maxStudents === 99999 ? (isAr ? "غير محدود" : "Unlimited") : `${plan.maxStudents}`}</span>
                    <span className="text-faint">{isAr ? "طالب" : "students"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-elevated/60 px-2.5 py-1.5 text-[11px]">
                    <GraduationCap className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-ink font-semibold">{plan.maxTeachers === 99999 ? (isAr ? "غير محدود" : "Unlimited") : `${plan.maxTeachers}`}</span>
                    <span className="text-faint">{isAr ? "معلم" : "teachers"}</span>
                  </div>
                </div>

                {/* Usage bar (only for current plan) */}
                {isCurrentPlan && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-faint">{isAr ? "الطلاب" : "Students"}</span>
                      <span className="text-muted">{studentCount}/{plan.maxStudents === 99999 ? "∞" : plan.maxStudents}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all"
                        style={{ width: `${plan.maxStudents === 99999 ? 0 : Math.min(100, (studentCount / plan.maxStudents) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-faint">{isAr ? "المعلمين" : "Teachers"}</span>
                      <span className="text-muted">{teacherCount}/{plan.maxTeachers === 99999 ? "∞" : plan.maxTeachers}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                        style={{ width: `${plan.maxTeachers === 99999 ? 0 : Math.min(100, (teacherCount / plan.maxTeachers) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Features */}
                <ul className="mt-5 space-y-2 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-ink">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <div className="mt-5">
                  {isCurrentPlan ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-elevated/60 px-4 py-3 text-sm font-bold text-muted">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {isAr ? "خطتك الحالية" : "Your Plan"}
                    </div>
                  ) : canUpgrade && plan.id !== "free" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); openWhatsApp(plan.name); }}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 cursor-pointer",
                        isEnterprise
                          ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30"
                          : "bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand-500/20",
                      )}
                    >
                      <Crown className="h-4 w-4" />
                      {isAr ? "اشترك الآن" : "Subscribe Now"}
                    </button>
                  ) : plan.id === "free" && subscriptionPlan === "free" ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-elevated/60 px-4 py-3 text-sm font-bold text-muted">
                      {isAr ? "خطتك الحالية" : "Current Plan"}
                    </div>
                  ) : null}

                  {plan.id === "enterprise" && isCurrentPlan && subscriptionEndDate && (
                    <p className="mt-2 text-center text-[11px] text-emerald-600 dark:text-emerald-400">
                      {isAr
                        ? `تاريخ الانتهاء: ${new Date(subscriptionEndDate).toLocaleDateString("ar-EG")}`
                        : `Ends: ${new Date(subscriptionEndDate).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ───── Data Migration Service ───── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-10"
        >
          <Card className="overflow-hidden border-brand-200/60 dark:border-brand-500/20">
            <div className="mesh-brand pointer-events-none absolute inset-0 opacity-[0.03]" />
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg">
                  <Database className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-ink">
                    {isAr ? "خدمة نقل البيانات" : "Data Migration Service"}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {isAr
                      ? "نقل بيانات طلابك ومعلميك عن طريق فريق مدرب وتسليمك المشروع دون تعب. نقوم بترحيل كل بيانات سنترك السابقة إلى النظام الجديد باحترافية."
                      : "Our trained team migrates your student and teacher data, delivering a fully-setup project without any effort on your side."}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm dark:bg-amber-500/10">
                      <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">1000</span>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{isAr ? "ج.م" : "EGP"}</span>
                    </div>
                    <Badge tone="neutral" className="text-[11px]">
                      {isAr ? "قابل للزيادة حسب حجم البيانات" : "May increase based on data size"}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={openWhatsAppService}
                  className="shrink-0 flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="h-5 w-5" />
                  {isAr ? "طلب الخدمة" : "Request Service"}
                </button>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ───── License Activation ───── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shadow-sm">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-ink">{isAr ? "تفعيل بمفتاح ترخيص" : "Activate with License Key"}</h3>
                    <p className="text-xs text-muted">{isAr ? "فعّل اشتراكك فوراً باستخدام كود تفعيل" : "Instantly activate with an activation code"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted">{isAr ? "كود التفعيل (License Key):" : "Activation Code (License Key):"}</label>
                    <textarea
                      value={licenseKeyInput}
                      onChange={(e) => {
                        setLicenseKeyInput(e.target.value);
                        setActivationError("");
                        setActivationSuccess(false);
                      }}
                      placeholder={isAr ? "أدخل الكود المشفر الطويل هنا..." : "Paste the long encoded key here..."}
                      className="w-full h-24 rounded-xl border border-line bg-elevated/40 p-3 text-xs font-mono text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 resize-none"
                    />
                  </div>

                  {activationError && (
                    <div className="text-xs font-bold text-rose-500 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                      {activationError}
                    </div>
                  )}

                  {activationSuccess && (
                    <div className="text-xs font-bold text-emerald-600 bg-emerald-500/10 p-2.5 rounded-lg flex items-center gap-1.5 justify-center border border-emerald-500/20">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 animate-bounce" />
                      <span>{isAr ? "تم تفعيل الترخيص والاشتراك بنجاح! شكراً لك." : "License activated successfully! Thank you."}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleActivateLicense}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white font-bold py-3.5 shadow-lg shadow-brand-500/10 transition active:scale-95 cursor-pointer text-sm"
              >
                <Check className="h-4 w-4" />
                {isAr ? "تفعيل الترخيص الآن" : "Activate License Now"}
              </button>
            </Card>
          </motion.div>

          {/* ───── Payment Details ───── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="overflow-hidden h-full flex flex-col justify-between">
              <div>
                <div className="mesh-brand relative px-6 py-5 text-center text-white">
                  <div className="relative">
                    <h3 className="text-lg font-bold">{isAr ? "تفاصيل الدفع" : "Payment Details"}</h3>
                    <p className="text-xs text-white/80">{isAr ? "حوّل المبلغ ثم أرسل إثبات التحويل" : "Transfer then send proof"}</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid gap-3 grid-cols-2">
                    {/* Amount */}
                    <div className="rounded-xl border border-line p-3 text-center bg-elevated/20">
                      <p className="text-[10px] text-muted">
                        {billingCycle === "monthly" 
                          ? (isAr ? "المبلغ الشهري" : "Monthly Amount") 
                          : (isAr ? "المبلغ السنوي (شامل الخصم)" : "Annual Amount (with discount)")}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-brand-600">
                        {selectedPlanId === "pro" 
                          ? (billingCycle === "monthly" ? "150" : "1620") 
                          : (billingCycle === "monthly" ? "400" : "4320")}{" "}
                        <span className="text-xs">{isAr ? "ج.م" : "EGP"}</span>
                      </p>
                      <p className="mt-1 text-[9px] text-faint">
                        {selectedPlanId === "pro"
                          ? (isAr ? "للخطة الاحترافية" : "Pro plan")
                          : (isAr ? "للخطة المؤسسية" : "Enterprise plan")}
                      </p>
                    </div>
                    {/* Payment Number */}
                    <div className="rounded-xl border border-line p-3 text-center bg-elevated/20">
                      <p className="text-[10px] text-muted">{isAr ? "رقم التحويل" : "Transfer To"}</p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <p className="text-base font-extrabold font-mono text-ink" dir="ltr">01140617424</p>
                        <button onClick={copyNumber} className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 text-[9px] text-faint">{isAr ? "إنستا باي / محفظة كاش" : "InstaPay / Cash Wallet"}</p>
                    </div>
                  </div>

                  {/* Methods */}
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {PAYMENT_DETAILS.paymentMethods.map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line bg-elevated/60 px-2.5 py-0.5 text-[10px] font-medium text-muted">
                        <Check className="h-3 w-3 text-emerald-500" />
                        {m}
                      </span>
                    ))}
                  </div>

                  {/* Note */}
                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    {isAr ? "أرسل سكرين شوت التحويل على واتساب لتفعيل الاشتراك" : "Send transfer screenshot on WhatsApp to activate"}
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                {/* WhatsApp Button */}
                <button
                  onClick={() => openWhatsApp(selectedPlanId === "pro" ? (isAr ? "الاحترافية" : "Pro") : (isAr ? "المؤسسية" : "Enterprise"))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="h-5 w-5" />
                  {isAr ? "إرسال إثبات التحويل" : "Send Payment Proof"}
                </button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}