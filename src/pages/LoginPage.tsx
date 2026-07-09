import { useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap, ChevronLeft, Mail, Lock, User, ShieldCheck,
  Cloud, QrCode, BarChart3, LockKeyhole, Loader2, ArrowRight,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../utils/cn";
import { OvidraLogo } from "../components/OvidraLogo";

type T = (k: string) => string;

/* ============================================================= LOGIN PAGE */
export function LoginPage({
  onClose,
  onParentPortal,
  onStudentPortal,
  onTeacherPortal,
  defaultMode,
}: {
  onClose: () => void;
  onParentPortal: () => void;
  onStudentPortal: () => void;
  onTeacherPortal: () => void;
  defaultMode: "in" | "up";
}) {
  const { t, lang } = useApp();
  const isAr = lang === "ar";

  const features = [
    { icon: Cloud, text: isAr ? "محلي أولاً مع مزامنة سحابية فورية" : "Local-first with real-time cloud sync" },
    { icon: QrCode, text: isAr ? "حضور ذكي عبر QR وأكواد الطلاب" : "Smart QR attendance & student codes" },
    { icon: BarChart3, text: isAr ? "تحليلات وتقارير مدعومة بالذكاء الاصطناعي" : "AI-powered analytics & reports" },
    { icon: LockKeyhole, text: isAr ? "صلاحيات حسب الأدوار وعزل كامل للبيانات" : "Role-based access & full data isolation" },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F7FB] p-4 dark:bg-bg sm:p-6">
      {/* subtle background orbs */}
      <div className="aurora pointer-events-none absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full bg-brand-400/15 blur-[120px]" />
      <div className="aurora pointer-events-none absolute -right-32 -bottom-32 h-[460px] w-[460px] rounded-full bg-accent-400/15 blur-[120px]" style={{ animationDelay: "3s" }} />

      {/* back button */}
      <motion.button
        initial={{ opacity: 0, x: isAr ? 12 : -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        onClick={onClose}
        className="absolute start-5 top-5 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3 py-2 text-xs font-semibold text-muted backdrop-blur transition hover:border-brand-300 hover:text-brand-600"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        {isAr ? "العودة للرئيسية" : "Back to home"}
      </motion.button>

      {/* THE CARD */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl bg-surface shadow-[0_30px_80px_-20px_rgba(15,23,42,0.2)] sm:rounded-3xl lg:grid-cols-[45%_55%]"
      >
        {/* ===== BRANDING PANEL (right in RTL) ===== */}
        <div className="noise-overlay relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-white lg:flex">
          {/* glow blobs */}
          <div className="aurora pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="aurora pointer-events-none absolute -bottom-20 -left-12 h-72 w-72 rounded-full bg-accent-400/25 blur-3xl" style={{ animationDelay: "1.5s" }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

          {/* logo */}
          <div className="relative">
            <OvidraLogo theme="dark" size="lg" className="shrink-0 select-none" />
          </div>

          {/* headline + features */}
          <div className="relative my-8">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[1.65rem] font-extrabold leading-snug"
            >
              {isAr ? "أدر مركزك التعليمي بالكامل من مكان واحد" : "Run your entire educational center from one place"}
            </motion.h2>

            <div className="mt-7 space-y-4">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isAr ? 16 : -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-3.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <span className="text-sm text-white/90">{f.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* footer line */}
          <p className="relative font-mono text-[11px] text-white/45">SQLite + Firestore</p>
        </div>

        {/* ===== LOGIN PANEL (left in RTL) ===== */}
        <LoginForm
          t={t}
          isAr={isAr}
          defaultMode={defaultMode}
          onParentPortal={onParentPortal}
          onStudentPortal={onStudentPortal}
          onTeacherPortal={onTeacherPortal}
        />
      </motion.div>
    </div>
  );
}

/* ============================================================= LOGIN FORM */
function LoginForm({ t, isAr, defaultMode, onParentPortal, onStudentPortal, onTeacherPortal }: { t: T; isAr: boolean; defaultMode: "in" | "up"; onParentPortal: () => void; onStudentPortal: () => void; onTeacherPortal: () => void }) {
  const { signIn, signUp, signInWithGoogle, demoAccess } = useApp();
  const [mode, setMode] = useState<"in" | "up">(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "up") {
        if (!name || !email || !password) { setError(t("misc.required")); setLoading(false); return; }
        const res = await signUp(name, email, password);
        if (!res.ok) { setError(t(`err.${res.error}`)); setLoading(false); }
      } else {
        const res = await signIn(email, password);
        if (!res.ok) { setError(t(`err.${res.error}`)); setLoading(false); }
      }
    } catch {
      setError(t("err.network-error"));
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center p-5 py-8 sm:p-8 lg:p-10">
      {/* heading */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {mode === "in" ? t("auth.welcome") : t("auth.createAccount")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.subtitle")}</p>
      </motion.div>

      {/* tabs */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }} className="mt-6 inline-flex w-full rounded-xl border border-line bg-elevated/60 p-1">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); }}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200",
              mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {m === "in" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        ))}
      </motion.div>

      {/* form */}
      <form onSubmit={submit} className="mt-5 space-y-3.5">
        <AnimateName show={mode === "up"} value={name} onChange={setName} placeholder={t("auth.name")} />

        <IconInput icon={Mail} type="email" placeholder={t("auth.email")} value={email} onChange={setEmail} />

        <IconInput icon={Lock} type="password" placeholder={t("auth.password")} value={password} onChange={setPassword} />

        {mode === "up" && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
          >
            {t("auth.ownerHint")}
          </motion.p>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 space-y-1.5"
          >
            <p className="font-bold">{error}</p>
            {error.includes("unauthorized") && (
              <p className="text-[11px] leading-relaxed text-rose-500 font-normal dark:text-rose-300">
                {isAr 
                  ? "💡 نصيحة: إذا كنت تستخدم تسجيل الدخول بحساب Google، تأكد من إضافة رابط هذا الموقع إلى قائمة النطاقات المصرح بها (Authorized Domains) في لوحة تحكم Firebase الخاصة بك. أو يمكنك بدلاً من ذلك تسجيل حساب جديد باستخدام البريد الإلكتروني وكلمة المرور مباشرة وهو يعمل بشكل فوري وتلقائي على أي نطاق دون أي إعدادات إضافية." 
                  : "💡 Tip: If you are using Google Sign-In, make sure to add this website's domain to the 'Authorized Domains' list in your Firebase console. Alternatively, signing up with Email and Password works instantly on any domain without any additional configuration!"}
              </p>
            )}
          </motion.div>
        )}

        {/* primary button */}
        <motion.button
          type="submit"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          className="magnetic-btn relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition disabled:opacity-60 sm:h-[50px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth.signingIn")}
            </>
          ) : (
            <>
              {mode === "in" ? t("auth.signIn") : t("auth.createAccount")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </>
          )}
        </motion.button>
      </form>

      {/* divider */}
      <div className="my-4 flex items-center gap-3 text-[11px] text-faint">
        <div className="h-px flex-1 bg-line" />
        {isAr ? "أو" : "or"}
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* google */}
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={async () => {
          setLoading(true);
          const res = await signInWithGoogle();
          if (!res.ok) { setError(t(`err.${res.error}`)); setLoading(false); }
        }}
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition hover:border-brand-300 hover:shadow-md sm:h-[50px]"
      >
        <GoogleIcon />
        {t("auth.google")}
      </motion.button>

      {/* quick access - owner */}
      <div className="mt-4">
        <motion.button
          whileHover={{ y: -1, borderColor: "rgb(109 93 252)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => demoAccess("owner")}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50/50 text-sm font-bold text-brand-700 transition dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200 sm:h-[46px]"
        >
          <GraduationCap className="h-4 w-4" />
          {t("auth.asOwner")}
        </motion.button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* student portal card */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={onStudentPortal}
          className="flex flex-col items-center justify-center gap-2 rounded-xl bg-elevated/70 p-4 text-center transition hover:bg-elevated"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-ink">{isAr ? "بوابة الطالب" : "Student Portal"}</p>
            <p className="mt-0.5 text-[10px] text-muted line-clamp-1">{isAr ? "درجاتك وحضورك الدراسي" : "Your grades & attendance"}</p>
          </div>
        </motion.button>

        {/* parent portal card */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={onParentPortal}
          className="flex flex-col items-center justify-center gap-2 rounded-xl bg-elevated/70 p-4 text-center transition hover:bg-elevated"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-ink">{t("parent.gateway")}</p>
            <p className="mt-0.5 text-[10px] text-muted line-clamp-1">{t("parent.gatewayDesc")}</p>
          </div>
        </motion.button>

        {/* teacher portal card */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={onTeacherPortal}
          className="flex flex-col items-center justify-center gap-2 rounded-xl bg-elevated/70 p-4 text-center transition hover:bg-elevated"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-ink">{isAr ? "بوابة المعلم" : "Teacher Portal"}</p>
            <p className="mt-0.5 text-[10px] text-muted line-clamp-1">{isAr ? "تسجيل الدخول كمعلم" : "Login as a teacher"}</p>
          </div>
        </motion.button>
      </div>
    </div>
  );
}

/* ============================================================= ANIMATED NAME FIELD */
function AnimateName({ show, value, onChange, placeholder }: { show: boolean; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <motion.div
      initial={false}
      animate={{ height: show ? "auto" : 0, opacity: show ? 1 : 0, marginTop: show ? undefined : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <IconInput icon={User} placeholder={placeholder} value={value} onChange={onChange} />
    </motion.div>
  );
}

/* ============================================================= ICON INPUT */
function IconInput({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="group relative">
      <Icon className="pointer-events-none absolute inset-y-0 end-3.5 my-auto h-[18px] w-[18px] text-faint transition group-focus-within:text-brand-500" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-line bg-surface px-4 pe-11 text-sm text-ink placeholder:text-faint transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 sm:h-[50px]"
      />
    </div>
  );
}

/* ============================================================= GOOGLE ICON */
function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
