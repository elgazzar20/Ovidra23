import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Sun, Moon, Languages, Cloud, ShieldCheck, Wallet,
  QrCode, BarChart3, Sparkles, Users2, CalendarRange, DatabaseBackup,
  FileText, MessageCircle, Star, ArrowRight, ArrowDown,
  Zap, Lock, Globe, TrendingUp, Bot, CheckCircle2,
  Users, ScanLine, ClipboardCheck, Send, Cpu, KeyRound,
  Mail, Menu, X, Smartphone, Printer, Volume2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, pushToast } from "../components/ui";
import { Reveal, Counter, Tilt, Float, Spotlight } from "../components/motion";
import { cn } from "../utils/cn";
import { PAYMENT_DETAILS } from "../lib/superadmin";
import { sound } from "../lib/attendance/sound";
import { OvidraLogo } from "../components/OvidraLogo";
import { getTestimonials, addTestimonial, type Testimonial as TestimonialType } from "../lib/testimonials";

type T = (k: string) => string;

/* ============================================================= EXPORT */
export function Welcome({
  onSignIn,
  onParentPortal,
  onStudentPortal,
  onTeacherPortal,
}: {
  onSignIn: (mode: "in" | "up") => void;
  onParentPortal: () => void;
  onStudentPortal: () => void;
  onTeacherPortal: () => void;
}) {
  const { t, lang, toggleLang, theme, toggleTheme, promoteYear, db } = useApp();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-bg text-ink selection:bg-brand-500/30 selection:text-brand-900 transition-colors duration-300">
      {/* Aesthetic full-page mathematical motif engravings */}
      <FullPageMathematicalEngravings />

      <Nav
        theme={theme}
        lang={lang}
        toggleLang={toggleLang}
        toggleTheme={toggleTheme}
        onSignIn={() => onSignIn("in")}
        onSignUp={() => onSignIn("up")}
        onParentPortal={onParentPortal}
        onStudentPortal={onStudentPortal}
        onTeacherPortal={onTeacherPortal}
        t={t}
      />

      <Hero
        t={t}
        lang={lang}
        onSignUp={() => onSignIn("up")}
        onParentPortal={onParentPortal}
        onStudentPortal={onStudentPortal}
        onTeacherPortal={onTeacherPortal}
        onWatch={() => scrollTo("features")}
      />

      <TrustBar t={t} />
      <Stats t={t} />
      <BentoFeatures
        t={t}
        onParentPortal={onParentPortal}
        onStudentPortal={onStudentPortal}
        onTeacherPortal={onTeacherPortal}
        promoteYear={promoteYear}
        db={db}
        lang={lang}
      />
      <Preview t={t} lang={lang} />
      <AISection t={t} lang={lang} />
      <Security t={t} />
      <Testimonials t={t} lang={lang} />
      <Pricing t={t} lang={lang} onSignUp={() => onSignIn("up")} />
      <Steps t={t} />
      <OtherApps lang={lang} />
      <DownloadsCenter lang={lang} />
      <DeveloperSignature t={t} lang={lang} />
      <Footer t={t} />
    </div>
  );
}

/* ============================================================= NAV */
function Nav({
  theme,
  lang,
  toggleLang,
  toggleTheme,
  onSignIn,
  onSignUp,
  onParentPortal,
  onStudentPortal,
  onTeacherPortal,
  t,
}: {
  theme: string;
  lang: string;
  toggleLang: () => void;
  toggleTheme: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onParentPortal: () => void;
  onStudentPortal: () => void;
  onTeacherPortal: () => void;
  t: T;
}) {
  const isAr = lang === "ar";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex flex-col items-center px-4 pt-4"
    >
      <div className="glass-panel flex w-full max-w-6xl items-center gap-4 rounded-2xl px-5 py-3 border border-line/50 shadow-xl backdrop-blur-md">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <OvidraLogo theme={theme as "light" | "dark"} size="md" className="shrink-0 select-none" />
        </div>

        {/* Desktop Anchor Navigation */}
        <nav className="ms-8 hidden items-center gap-6 lg:flex">
          <a
            href="#features"
            className="relative text-sm font-semibold text-muted transition-all duration-200 hover:text-brand-600 dark:hover:text-brand-400 py-1 px-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-brand-500 after:transition-all hover:after:w-full"
          >
            {t("land.footer.features")}
          </a>
          <a
            href="#downloads"
            className="relative text-sm font-semibold text-muted transition-all duration-200 hover:text-brand-600 dark:hover:text-brand-400 py-1 px-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-brand-500 after:transition-all hover:after:w-full"
          >
            {isAr ? "تحميل تطبيقاتنا" : "Download Our Apps"}
          </a>
          <a
            href="#pricing"
            className="relative text-sm font-semibold text-muted transition-all duration-200 hover:text-brand-600 dark:hover:text-brand-400 py-1 px-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-brand-500 after:transition-all hover:after:w-full"
          >
            {isAr ? "الأسعار والباقات" : "Pricing"}
          </a>
          <a
            href="#security"
            className="relative text-sm font-semibold text-muted transition-all duration-200 hover:text-brand-600 dark:hover:text-brand-400 py-1 px-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-brand-500 after:transition-all hover:after:w-full"
          >
            {t("privacy.title")}
          </a>
        </nav>

        {/* Desktop Quick Actions */}
        <div className="ms-auto hidden items-center gap-2.5 md:flex">
          {/* Quick toggle for languages with beautiful badge */}
          <button
            onClick={toggleLang}
            className="inline-flex h-9 px-3 items-center gap-1.5 rounded-xl border border-line bg-surface/40 hover:bg-elevated text-xs font-bold transition-all"
            title="Switch Language"
          >
            <Languages className="h-4 w-4 text-brand-500" />
            <span>{isAr ? "English" : "عربي"}</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface/40 hover:bg-elevated transition-all text-muted hover:text-ink"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <span className="h-5 w-[1px] bg-line mx-1" />

          {/* Primary Authentication & Portal Entry Actions */}
          <Button size="sm" variant="secondary" onClick={onSignIn} className="rounded-xl font-bold px-4">
            {t("auth.signIn")}
          </Button>
          <Button size="sm" onClick={onSignUp} className="rounded-xl font-bold px-4 shine">
            {t("welcome.cta")}
          </Button>
        </div>

        {/* Mobile controls */}
        <div className="ms-auto flex items-center gap-2 md:hidden">
          <button
            onClick={toggleLang}
            className="inline-flex h-8 px-2.5 items-center gap-1.5 rounded-lg border border-line bg-surface/40 text-[11px] font-bold text-muted"
          >
            <Languages className="h-3.5 w-3.5 text-brand-500" />
            <span>{isAr ? "EN" : "عربي"}</span>
          </button>
          <button
            onClick={toggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface/40 text-muted"
          >
            {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drop down menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="glass-panel mt-2 flex w-full flex-col gap-3 rounded-2xl p-4 md:hidden border border-line shadow-lg overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignIn();
                }}
                className="w-full rounded-xl border border-line bg-surface/40 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-elevated"
              >
                {t("auth.signIn")}
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignUp();
                }}
                className="w-full rounded-xl bg-brand-500 py-2.5 text-center text-sm font-bold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600"
              >
                {t("welcome.cta")}
              </button>
            </div>

            <div className="h-[1px] w-full bg-line/60" />

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStudentPortal();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-50/80 dark:border-emerald-500/30"
              >
                <GraduationCap className="h-4 w-4 text-emerald-500" />
                {isAr ? "بوابة الطالب" : "Student Portal"}
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onParentPortal();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-line/70 bg-surface/60 py-2.5 text-sm font-semibold text-muted transition hover:border-brand-300 hover:text-brand-600"
              >
                <Users className="h-4 w-4 text-brand-500" />
                {isAr ? "بوابة ولي الأمر" : "Parent Portal"}
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onTeacherPortal();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/40 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 transition hover:bg-indigo-50/80 dark:border-indigo-500/30"
              >
                <GraduationCap className="h-4 w-4 text-indigo-500" />
                {isAr ? "بوابة المدرس" : "Teacher Portal"}
              </button>
            </div>

            <div className="h-[1px] w-full bg-line/60" />

            <nav className="flex flex-col gap-2.5 px-1 py-1 text-center">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted transition hover:text-ink">{t("land.footer.features")}</a>
              <a href="#downloads" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted transition hover:text-ink">{isAr ? "تحميل تطبيقاتنا" : "Download Our Apps"}</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted transition hover:text-ink">{isAr ? "الأسعار والباقات" : "Pricing"}</a>
              <a href="#security" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-muted transition hover:text-ink">{t("privacy.title")}</a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ============================================================= HERO */
function Hero({
  t,
  lang,
  onSignUp,
  onParentPortal,
  onStudentPortal,
  onTeacherPortal,
  onWatch,
}: {
  t: T;
  lang: string;
  onSignUp: () => void;
  onParentPortal: () => void;
  onStudentPortal: () => void;
  onTeacherPortal: () => void;
  onWatch: () => void;
}) {
  const isAr = lang === "ar";

  return (
    <section className="aurora-bg noise-overlay relative overflow-hidden pb-20 pt-28 sm:pt-36 lg:pb-28 lg:pt-40">
      {/* Premium animated math-themed background decorations */}
      <MathBackgroundDecorations />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Core Marketing Copy */}
        <motion.div
          initial={{ opacity: 0, x: isAr ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center lg:text-start"
        >
          {/* Tagline Capsule */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand-300/60 bg-brand-100/60 px-4 py-1.5 text-xs font-bold text-brand-700 backdrop-blur-sm dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            {t("welcome.tagline")}
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-balance mt-6 text-4xl font-extrabold leading-[1.2] tracking-tight sm:text-5xl lg:text-[3.75rem] text-ink"
          >
            {isAr ? (
              <>أدر مركزك التعليمي <span className="text-grad font-black">بالكامل</span><br /> من منصة ذكية واحدة</>
            ) : (
              <>Manage your entire<br />center <span className="text-grad font-black">in one place</span></>
            )}
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-pretty mx-auto mt-5 max-w-xl text-base font-medium leading-relaxed text-muted sm:text-lg lg:mx-0"
          >
            {t("land.subHero")}
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
          >
            <Button size="lg" onClick={onSignUp} className="magnetic-btn shine rounded-2xl px-8 py-4 font-bold shadow-lg shadow-brand-500/25 text-base">
              {t("welcome.cta")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <button
              onClick={onWatch}
              className="group inline-flex items-center gap-2 rounded-2xl border border-line bg-surface/60 px-6 py-3.5 text-sm font-bold backdrop-blur transition-all hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-500/10 shadow-sm"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20">
                <ArrowDown className="h-4 w-4" />
              </span>
              {t("land.watchFeatures")}
            </button>
          </motion.div>

          {/* Direct Portals Quick-launch Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.48 }}
            className="mt-6 border-t border-line-soft pt-6 text-center lg:text-start"
          >
            <p className="text-xs font-bold text-muted/70 uppercase tracking-widest mb-3.5">
              {isAr ? "الدخول المباشر للبوابات الفرعية" : "Direct Access Portals"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button
                onClick={onStudentPortal}
                className="group inline-flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 dark:bg-emerald-500/5 px-5 py-3 text-sm font-bold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/5 text-emerald-700 dark:text-emerald-300 animate-pulse hover:animate-none"
              >
                <GraduationCap className="h-4.5 w-4.5 text-emerald-500 transition-transform group-hover:scale-110" />
                <span className="flex items-center gap-1.5">
                  {isAr ? "بوابة الطالب" : "Student Portal"}
                  <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{isAr ? "جديد" : "NEW"}</span>
                </span>
              </button>
              <button
                onClick={onParentPortal}
                className="group inline-flex items-center gap-3 rounded-2xl border border-line/80 bg-surface/80 px-5 py-3 text-sm font-bold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/5"
              >
                <Users className="h-4.5 w-4.5 text-brand-500 transition-transform group-hover:scale-110" />
                <span>{isAr ? "بوابة ولي الأمر" : "Parent Portal"}</span>
              </button>
              <button
                onClick={onTeacherPortal}
                className="group inline-flex items-center gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 px-5 py-3 text-sm font-bold shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 text-indigo-700 dark:text-indigo-300"
              >
                <GraduationCap className="h-4.5 w-4.5 text-indigo-500 transition-transform group-hover:scale-110" />
                <span>{isAr ? "بوابة المدرس" : "Teacher Portal"}</span>
              </button>
            </div>
          </motion.div>

          {/* Trust rating indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mt-8 flex items-center justify-center gap-4 lg:justify-start"
          >
            <div className="flex -space-x-2.5 rtl:space-x-reverse">
              {[
                "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1544717305-2782549b5136?w=80&h=80&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces&q=80",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces&q=80"
              ].map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Educational Center Avatar"
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-surface shadow-sm border border-line-soft transition-transform hover:scale-110 duration-200"
                />
              ))}
            </div>
            <div className="text-start">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-[11px] font-semibold text-muted">
                {isAr ? "موثوق من +1000 مركز تعليمي" : "Trusted by 1000+ centers"}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Live Mockup Presentation with Smooth Float (Static layout height to avoid scrolling overlay bugs) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative select-none"
        >
          <Float delay={0} distance={10}>
            <HeroMockup t={t} />
          </Float>
        </motion.div>
      </div>
    </section>
  );
}

function HeroMockup({ t }: { t: T }) {
  return (
    <div className="relative mx-auto max-w-lg">
      {/* floating badges */}
      <Float delay={0.5} className="pointer-events-none absolute -left-6 -top-6 z-20 sm:-left-10">
        <div className="glass-panel flex items-center gap-2 rounded-2xl px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white"><TrendingUp className="h-4 w-4" /></div>
          <div>
            <p className="text-[10px] text-muted">{t("dash.attendanceRate")}</p>
            <p className="text-sm font-bold text-emerald-600">94% ↑</p>
          </div>
        </div>
      </Float>
      <Float delay={1.2} distance={16} className="pointer-events-none absolute -right-4 top-1/3 z-20 sm:-right-8">
        <div className="glass-panel flex items-center gap-2 rounded-2xl px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white"><Wallet className="h-4 w-4" /></div>
          <div>
            <p className="text-[10px] text-muted">{t("dash.monthlyRevenue")}</p>
            <p className="text-sm font-bold text-brand-600">42,180</p>
          </div>
        </div>
      </Float>

      <Tilt intensity={7} className="relative">
        {/* glow behind */}
        <div className="conic-glow absolute -inset-3 rounded-[2rem] opacity-30" />
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_40px_90px_-20px_rgba(15,23,42,0.4)]">
          {/* window chrome */}
          <div className="flex items-center gap-2 border-b border-line bg-elevated/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ms-3 text-[11px] font-medium text-faint">{t("dash.title")}</span>
          </div>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              { l: t("dash.totalStudents"), v: "248", tone: "from-brand-500 to-brand-600", ic: GraduationCap },
              { l: t("dash.activeGroups"), v: "18", tone: "from-violet-500 to-purple-600", ic: CalendarRange },
              { l: t("dash.monthlyRevenue"), v: "42k", tone: "from-emerald-500 to-green-600", ic: Wallet },
              { l: t("teachers.title"), v: "12", tone: "from-sky-500 to-blue-600", ic: Users },
            ].map((k, i) => {
              const Ic = k.ic;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="rounded-xl border border-line bg-surface p-3"
                >
                  <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white", k.tone)}><Ic className="h-4 w-4" /></div>
                  <p className="text-xl font-bold">{k.v}</p>
                  <p className="truncate text-[10px] text-muted">{k.l}</p>
                </motion.div>
              );
            })}
          </div>
          {/* animated chart */}
          <div className="flex items-end gap-2 px-4 pb-4">
            {[40, 65, 50, 80, 60, 92, 72, 85, 68, 95].map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-brand-500 to-accent-400"
                initial={{ height: 0 }}
                whileInView={{ height: `${h}px` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.5 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </div>
        </div>
      </Tilt>
    </div>
  );
}

/* ============================================================= TRUST BAR */
function TrustBar({ t }: { t: T }) {
  const pills = [
    { icon: Zap, label: t("welcome.bannerOffline") },
    { icon: Cloud, label: t("welcome.bannerCloud") },
    { icon: Sparkles, label: t("welcome.bannerAI") },
    { icon: QrCode, label: t("welcome.bannerQR") },
    { icon: FileText, label: t("welcome.bannerPDF") },
    { icon: DatabaseBackup, label: t("feat.backup") },
  ];
  return (
    <section className="border-y border-line bg-surface/50 py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-faint">{t("land.trustTitle")}</Reveal>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {pills.map((p, i) => {
            const Ic = p.icon;
            return (
              <Reveal key={i} delay={i * 0.06}>
                <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                  <Ic className="h-4 w-4 text-brand-500" />
                  {p.label}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================= STATS */
function Stats({ t }: { t: T }) {
  const stats = [
    { value: 10000, suffix: "+", label: t("land.stat1"), icon: Users2, tone: "text-brand-500" },
    { value: 98, suffix: "%", label: t("land.stat2"), icon: CheckCircle2, tone: "text-emerald-500" },
    { value: 24, suffix: "/7", label: t("land.stat3"), icon: Globe, tone: "text-sky-500" },
    { value: 100, suffix: "%", label: t("land.stat4"), icon: Lock, tone: "text-violet-500" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => {
          const Ic = s.icon;
          return (
            <Reveal key={i} delay={i * 0.08}>
              <div className="spotlight-card group relative rounded-2xl bg-surface p-4 sm:p-6 text-center ring-1 ring-line transition hover:-translate-y-1 hover:shadow-xl">
                <Ic className={cn("mx-auto mb-3 h-7 w-7 transition-transform group-hover:scale-110", s.tone)} />
                <p className="text-grad text-xl min-[360px]:text-2xl min-[410px]:text-3xl sm:text-4xl lg:text-5xl font-extrabold select-none">
                  <Counter to={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-xs sm:text-sm font-medium text-muted">{s.label}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================= BENTO FEATURES */
function BentoFeatures({
  t,
  onParentPortal,
  onStudentPortal,
  onTeacherPortal,
  promoteYear,
  db,
  lang,
}: {
  t: T;
  onParentPortal: () => void;
  onStudentPortal: () => void;
  onTeacherPortal: () => void;
  promoteYear: () => { promoted: number; skipped: number; backupTs: number };
  db: any;
  lang: string;
}) {
  const isAr = lang === "ar";
  const [promotingState, setPromotingState] = useState(false);

  const handlePromotionClick = () => {
    sound.unlock();
    if (confirm(isAr ? "هل أنت متأكد من رغبتك في ترحيل جميع الطلاب للسنة التالية؟ سيتم تلقائياً حفظ نسخة احتياطية لبياناتك." : "Are you sure you want to promote all students to the next grade? A system backup will be automatically saved first.")) {
      setPromotingState(true);
      setTimeout(() => {
        try {
          const res = promoteYear();
          if (res && res.promoted > 0) {
            sound.playFor("ok");
            pushToast(
              isAr
                ? `🎉 تم ترحيل ${res.promoted} طالب بنجاح إلى الصف التالي وتلقائياً تم إنشاء نسخة احتياطية!`
                : `🎉 ${res.promoted} students successfully promoted to the next grade & backup created!`,
              "success"
            );
          } else if (res && res.promoted === 0 && res.skipped === 0) {
            sound.playFor("info");
            pushToast(
              isAr
                ? "⚠️ لا يوجد طلاب حالياً بالمركز مؤهلين للترقية."
                : "⚠️ No students in the center are currently eligible for promotion.",
              "info"
            );
          } else if (res && res.promoted === 0 && res.skipped > 0) {
            sound.playFor("info");
            pushToast(
              isAr
                ? `⚠️ تم تخطي الطلاب (${res.skipped}) لأنهم في مسارات غير سنوية.`
                : `⚠️ Skipped ${res.skipped} students since they are on non-annual tracks.`,
              "info"
            );
          }
        } catch (e: any) {
          pushToast(e?.message || "Error during rollover", "error");
        } finally {
          setPromotingState(false);
        }
      }, 800);
    }
  };

  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Reveal className="mb-12 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-500">{t("land.footer.features")}</span>
        <h2 className="text-balance mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("land.featuresTitle")}</h2>
        <p className="text-pretty mx-auto mt-3 max-w-lg text-sm text-muted">{t("land.featuresSub")}</p>
      </Reveal>

      <div className="grid auto-rows-[minmax(170px,auto)] grid-cols-2 gap-4 lg:grid-cols-4">
        {/* QR - large */}
        <Reveal className="col-span-2 row-span-2 lg:col-span-2">
          <BentoCard tone="from-sky-500 to-blue-600" icon={QrCode} title={t("feat.attendance")} desc={t("feat.attendanceD")} big>
            <div className="mt-5 flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 dark:bg-sky-500/10">
                <ScanLine className="h-9 w-9 text-sky-500" />
                <motion.span className="absolute inset-x-3 h-0.5 rounded-full bg-sky-400 shadow-[0_0_8px_2px] shadow-sky-400/50" animate={{ top: ["20%", "80%", "20%"] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
              </div>
              <div className="flex-1 space-y-2">
                {[85, 70].map((w, i) => (
                  <motion.div key={i} className="h-2.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-500" initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.2 }} />
                ))}
              </div>
            </div>
          </BentoCard>
        </Reveal>

        {/* AI - wide */}
        <Reveal className="col-span-2" delay={0.05}>
          <BentoCard tone="from-violet-500 to-purple-600" icon={Sparkles} title={t("feat.ai")} desc={t("feat.aiD")} wide>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 shrink-0 text-violet-500" />
                <motion.div className="h-2 rounded-full bg-violet-200 dark:bg-violet-500/25" initial={{ width: 0 }} whileInView={{ width: "80%" }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.8 }} />
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-violet-400" />
                <motion.div className="h-2 rounded-full bg-violet-100 dark:bg-violet-500/15" initial={{ width: 0 }} whileInView={{ width: "60%" }} viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.8 }} />
              </div>
            </div>
          </BentoCard>
        </Reveal>

        {/* Finance */}
        <Reveal delay={0.1}>
          <BentoCard tone="from-emerald-500 to-green-600" icon={Wallet} title={t("feat.finance")} desc={t("feat.financeD")} />
        </Reveal>

        {/* Students */}
        <Reveal delay={0.15}>
          <BentoCard tone="from-brand-500 to-brand-600" icon={Users} title={t("feat.staff")} desc={t("feat.staffD")} />
        </Reveal>

        {/* Exams */}
        <Reveal delay={0.2}>
          <BentoCard tone="from-amber-500 to-orange-600" icon={FileText} title={t("feat.exams")} desc={t("feat.examsD")} />
        </Reveal>

        {/* Schedule */}
        <Reveal delay={0.25}>
          <BentoCard tone="from-rose-500 to-pink-600" icon={CalendarRange} title={t("feat.schedule")} desc={t("feat.scheduleD")} />
        </Reveal>

        {/* Reports */}
        <Reveal delay={0.3}>
          <BentoCard tone="from-indigo-500 to-blue-700" icon={BarChart3} title={t("feat.reports")} desc={t("feat.reportsD")} />
        </Reveal>

        {/* Backup */}
        <Reveal delay={0.35}>
          <BentoCard tone="from-teal-500 to-cyan-600" icon={DatabaseBackup} title={t("feat.backup")} desc={t("feat.backupD")} />
        </Reveal>

        {/* NEW ADDITION: Specialized Portals Card */}
        <Reveal className="col-span-2" delay={0.15}>
          <BentoCard 
            tone="from-emerald-500 via-teal-600 to-cyan-600" 
            icon={Smartphone} 
            title={isAr ? "تطبيقات البوابات الذكية الفرعية" : "Sub-Portal Specialized Apps"} 
            desc={isAr ? "تطبيق مخصص ومستقل بالكامل لكل من الطالب، ولي الأمر، والمدرس لضمان المتابعة والتكامل المستمر." : "Fully dedicated, tailored custom portals for Students, Parents, and Teachers."}
            wide
          >
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onStudentPortal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition-all"
              >
                <GraduationCap className="h-4 w-4 text-emerald-300" />
                {isAr ? "بوابة الطالب" : "Student Portal"}
              </button>
              <button
                onClick={onParentPortal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition-all"
              >
                <Users className="h-4 w-4 text-sky-300" />
                {isAr ? "بوابة ولي الأمر" : "Parent Portal"}
              </button>
              <button
                onClick={onTeacherPortal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition-all"
              >
                <GraduationCap className="h-4 w-4 text-indigo-300" />
                {isAr ? "بوابة المدرس" : "Teacher Portal"}
              </button>
            </div>
          </BentoCard>
        </Reveal>

        {/* NEW ADDITION: Annual Promotion Card */}
        <Reveal className="col-span-2" delay={0.2}>
          <BentoCard 
            tone="from-amber-500 via-orange-600 to-rose-600" 
            icon={TrendingUp} 
            title={isAr ? "ترقية وترحيل الطلاب للسنة التالية" : "Annual Academic Rollover"} 
            desc={isAr ? "رحّل جميع طلاب مركزك الدراسيين إلى الصف التالي بضغطة زر واحدة، مع أخذ نسخة احتياطية آمنة مسبقاً وتلقائياً." : "Promote and transition all graded students to the next academic level in one click, with zero effort and automatic backup safety."}
            wide
          >
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={handlePromotionClick}
                disabled={promotingState}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-orange-700 shadow-md transition-all hover:bg-orange-50 hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <Zap className="h-4 w-4 text-amber-500 animate-bounce" />
                <span>{promotingState ? (isAr ? "جاري الترحيل..." : "Promoting...") : (isAr ? "ترحيل كل الطلاب الآن" : "Promote All Students Now")}</span>
              </button>
              <div className="text-right">
                <span className="text-[10px] font-bold text-white/85 block uppercase tracking-wider">{isAr ? "إجمالي الطلاب الحاليين" : "Total Current Students"}</span>
                <span className="text-lg font-black text-white">{db?.students?.length ?? 0}</span>
              </div>
            </div>
          </BentoCard>
        </Reveal>

        {/* NEW ADDITION: WhatsApp Notification Dispatch */}
        <Reveal delay={0.38}>
          <BentoCard tone="from-violet-500 to-indigo-600" icon={Send} title={isAr ? "إشعارات الواتساب الذكية" : "Instant WhatsApp Alerts"} desc={isAr ? "تواصل لحظي وفعال مع أولياء الأمور عبر إرسال تقارير الحضور والغياب والامتحانات والواجبات المنزلية مباشرة." : "Seamless, automatic WhatsApp notification dispatch for attendance, homework, and exam updates."} />
        </Reveal>

        {/* NEW ADDITION: Multi-Branch System */}
        <Reveal delay={0.42}>
          <BentoCard tone="from-teal-600 to-emerald-700" icon={Globe} title={isAr ? "إدارة الفروع المتعددة" : "Multi-Branch Support"} desc={isAr ? "إدارة مرنة ومتكاملة لمركزك عبر فروع متعددة مع إحصائيات منفصلة، وتقارير أداء مستقلة، ومزامنة فائقة الأمان." : "Streamlined multi-branch administration with dedicated local reports, center switching, and sync."} />
        </Reveal>

        {/* NEW ADDITION: Smart ID Cards Generator */}
        <Reveal delay={0.45}>
          <BentoCard 
            tone="from-blue-500 to-indigo-600" 
            icon={Printer} 
            title={isAr ? "توليد بطاقات الهوية بـ QR" : "Smart ID Cards & QR"} 
            desc={isAr ? "صمم واطبع هويات الطلاب الذكية مباشرة بصيغة PDF مع الكود الثنائي لعمليات كشف سريعة ودقيقة." : "Design and generate printable student ID cards with secure custom QR codes for rapid scans."} 
          />
        </Reveal>

        {/* NEW ADDITION: Voice Attendance & Hardware Wedge */}
        <Reveal delay={0.48}>
          <BentoCard 
            tone="from-rose-600 to-amber-600" 
            icon={Volume2} 
            title={isAr ? "القارئ الصوتي والعتاد الذكي" : "Voice Feedback & Hardware Scanner"} 
            desc={isAr ? "الترحيب بالطلاب بصوت مسموع عند تسجيل الحضور والتحذير الفوري مع المزامنة التلقائية ليدعم أجهزة الليزر الخارجية." : "Audio greetings and dynamic speech-synthesized feedback for check-ins with keyboard emulation wedge scanners."} 
          />
        </Reveal>
      </div>
    </section>
  );
}

function BentoCard({ tone, icon: Icon, title, desc, big, wide, children }: { tone: string; icon: any; title: string; desc: string; big?: boolean; wide?: boolean; children?: React.ReactNode }) {
  return (
    <Spotlight className="spotlight-card group h-full overflow-hidden rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:-translate-y-1 hover:shadow-2xl">
      <div className={cn("mb-3 flex items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", big ? "h-14 w-14" : "h-11 w-11", tone)}>
        <Icon className={big ? "h-7 w-7" : "h-5 w-5"} />
      </div>
      <h3 className={cn("font-bold tracking-tight", big ? "text-xl" : "text-base")}>{title}</h3>
      <p className={cn("mt-1.5 text-muted", big ? "text-sm" : "text-xs", wide && "max-w-md")}>{desc}</p>
      {children}
    </Spotlight>
  );
}

/* ============================================================= PREVIEW */
function Preview({ t, lang }: { t: T; lang: string }) {
  const [tab, setTab] = useState("students");
  const tabs = [
    { id: "students", label: t("land.preview.students"), icon: GraduationCap },
    { id: "attendance", label: t("land.preview.attendance"), icon: ClipboardCheck },
    { id: "finance", label: t("land.preview.finance"), icon: Wallet },
    { id: "ai", label: t("land.preview.ai"), icon: Sparkles },
  ];
  return (
    <section id="preview" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Reveal className="mb-10 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-500">{t("land.previewTitle")}</span>
        <h2 className="text-balance mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("land.previewTitle")}</h2>
        <p className="text-pretty mx-auto mt-3 max-w-lg text-sm text-muted">{t("land.previewSub")}</p>
      </Reveal>

      <Reveal>
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {tabs.map((tb) => {
            const Ic = tb.icon;
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)} className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition", active ? "border-transparent bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25" : "border-line bg-surface text-muted hover:text-ink")}>
                <Ic className="h-4 w-4" />{tb.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="relative mx-auto max-w-4xl">
          <div className="conic-glow absolute -inset-2 rounded-[1.75rem] opacity-25" />
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_70px_-20px_rgba(15,23,42,0.3)]">
            <div className="flex items-center gap-2 border-b border-line bg-elevated/60 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ms-3 text-[11px] font-medium text-faint">{tabs.find((x) => x.id === tab)?.label}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="p-5">
                <PreviewPane tab={tab} lang={lang} t={t} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function PreviewPane({ tab, lang, t }: { tab: string; lang: string; t: T }) {
  const isAr = lang === "ar";
  if (tab === "students") {
    return (
      <div className="space-y-2">
        {(isAr ? [["عمر حسن", "حاضر"], ["لينا عادل", "متأخرة"], ["يوسف سامي", "حاضر"], ["مريم خالد", "غائبة"]] : [["Omar Hassan", "Present"], ["Lina Adel", "Late"], ["Youssef Sami", "Present"], ["Mariam Khaled", "Absent"]]).map(([n, st], i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-2.5 transition hover:bg-elevated/40">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">{n.split(" ").map((p) => p[0]).join("")}</div>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{n}</p><p className="font-mono text-[10px] text-faint">{["H8K3P9", "M4X7Q2", "Y9R5W1", "K2N8J4"][i]}</p></div>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold", st.includes("Pr") || st.includes("ح") ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15" : st.includes("La") || st.includes("مت") ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15" : "bg-rose-50 text-rose-600 dark:bg-rose-500/15")}>{st}</span>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "attendance") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: t("att.present"), v: 212, c: "text-emerald-600", b: "from-emerald-500 to-green-600", ic: CheckCircle2 },
          { l: t("att.absent"), v: 18, c: "text-rose-600", b: "from-rose-500 to-pink-600", ic: ShieldCheck },
          { l: t("att.late"), v: 12, c: "text-amber-600", b: "from-amber-500 to-orange-600", ic: Zap },
          { l: t("att.excused"), v: 6, c: "text-sky-600", b: "from-sky-500 to-blue-600", ic: FileText },
        ].map((k, i) => {
          const Ic = k.ic;
          return (
            <div key={i} className="rounded-xl border border-line p-3 text-center">
              <div className={cn("mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white", k.b)}><Ic className="h-4 w-4" /></div>
              <p className={cn("text-2xl font-bold", k.c)}>{k.v}</p>
              <p className="text-[10px] text-muted">{k.l}</p>
            </div>
          );
        })}
      </div>
    );
  }
  if (tab === "finance") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {[{ l: t("fin.income"), v: "42,180", c: "text-emerald-600" }, { l: t("fin.outcome"), v: "18,400", c: "text-rose-600" }, { l: t("fin.balance"), v: "23,780", c: "text-brand-600" }].map((k, i) => (
            <div key={i} className="rounded-xl border border-line p-4"><p className="text-[10px] text-muted">{k.l}</p><p className={cn("mt-1 text-xl font-bold", k.c)}>{k.v}</p></div>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-line p-4">
          {[45, 70, 55, 85, 60, 90, 75, 65, 95, 80].map((h, i) => (
            <motion.div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-500 to-accent-400" initial={{ height: 0 }} animate={{ height: `${h}px` }} transition={{ duration: 0.6, delay: i * 0.06 }} />
          ))}
        </div>
      </div>
    );
  }
  // ai
  return (
    <div className="space-y-3">
      <div className="ms-auto max-w-[75%] rounded-2xl rounded-tl-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
        {isAr ? "حلّل أداء طالب الصف الثالث" : "Analyze Grade 3 student performance"}
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-line bg-elevated/60 px-4 py-2.5 text-sm">
        <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" /><span className="font-semibold">AI</span></div>
        <p className="text-muted">{isAr ? "معدل الحضور 92% ومتوسط الدرجات 78%. الطالب يحتاج تركيزاً في الجبر. أنصح بجلسة مراجعة أسبوعية." : "Attendance 92%, average 78%. Student needs focus on Algebra. Recommend a weekly review session."}</p>
      </div>
    </div>
  );
}

/* ============================================================= AI SECTION */
function AISection({ t, lang }: { t: T; lang: string }) {
  const isAr = lang === "ar";
  const feats = [
    { icon: BarChart3, key: "ai.f1", grad: "from-sky-500 to-blue-600", desc: isAr ? "قيّد أداء كل طالب واحصل على تقارير شاملة لحظياً" : "Track every student's performance with instant comprehensive reports" },
    { icon: ShieldCheck, key: "ai.f2", grad: "from-amber-500 to-orange-600", desc: isAr ? "نظام إنذار مبكر يكتشف الطلاب المعرضين للتعثر" : "Early warning system detects at-risk students before it's too late" },
    { icon: TrendingUp, key: "ai.f3", grad: "from-emerald-500 to-green-600", desc: isAr ? "نماذج توقّع دقيقة تحسب نسب النجاح المتوقعة لكل طالب" : "Accurate prediction models calculate expected success rates" },
    { icon: Sparkles, key: "ai.f4", grad: "from-violet-500 to-purple-600", desc: isAr ? "اقتراحات تدريسية مخصصة تساعد المعلمين في تحسين المخرجات" : "Personalised teaching suggestions to help educators improve outcomes" },
  ];
  return (
    <section className="noise-overlay relative overflow-hidden py-20">
      <div className="aurora pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-violet-500/15 blur-[100px]" />
      <div className="aurora pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-brand-500/15 blur-[100px]" style={{ animationDelay: "4s" }} />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/70 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
            <Cpu className="h-3.5 w-3.5" />{t("feat.ai")}
          </span>
          <h2 className="text-balance mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("land.aiTitle")}</h2>
          <p className="text-pretty mt-3 text-muted">{t("land.aiSub")}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {feats.map((f, i) => {
              const Ic = f.icon;
              return (
                <Reveal key={i} delay={i * 0.08}>
                  <motion.div
                    className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-1 hover:shadow-xl"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <div className={cn("absolute -inset-x-8 -top-8 h-32 w-48 -rotate-12 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20", f.grad.replace("to-", "via-30% to-"))} />
                    <div className="relative flex items-start gap-3">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", f.grad)}>
                        <Ic className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{t(`land.${f.key}`)}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <Tilt intensity={4} className="relative">
            <div className="conic-glow absolute -inset-3 rounded-[2rem] opacity-25" />
            <div className="relative rounded-3xl border border-line bg-surface p-5 shadow-[0_30px_70px_-20px_rgba(15,23,42,0.3)]">
              <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white"><Bot className="h-5 w-5" /></div>
                <div><p className="text-sm font-bold">Center AI</p><p className="flex items-center gap-1 text-[10px] text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" />Online</p></div>
              </div>
              <div className="space-y-3">
                <div className="ms-auto max-w-[80%] rounded-2xl rounded-tl-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
                  {isAr ? "من هم الطلاب المتعثرون هذا الشهر؟" : "Who are the struggling students this month?"}
                </div>
                <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="max-w-[88%] rounded-2xl rounded-tr-sm border border-line bg-elevated/60 px-4 py-3 text-sm">
                  <p className="mb-2 font-semibold text-violet-600">{isAr ? "وجدت ٤ طلاب:" : "Found 4 students:"}</p>
                  {["Omar · Algebra 48%", "Lina · Physics 52%", "Youssef · Chemistry 55%"].map((s, i) => (
                    <p key={i} className="flex items-center gap-2 py-0.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" />{s}</p>
                  ))}
                </motion.div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-xs text-faint">{t("messages.placeholder")}</div>
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white"><Send className="h-4 w-4 rtl:rotate-180" /></button>
                </div>
              </div>
            </div>
          </Tilt>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================= SECURITY */
function Security({ t }: { t: T }) {
  const items = [
    { icon: DatabaseBackup, key: "sec.local" },
    { icon: Cloud, key: "sec.sync" },
    { icon: KeyRound, key: "sec.rbac" },
    { icon: Lock, key: "sec.backup" },
  ];
  return (
    <section id="security" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal className="mb-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/60 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> {t("privacy.title")}
        </span>
        <h2 className="text-balance mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          {t("land.securityTitle")}
        </h2>
        <p className="text-pretty mx-auto mt-4 max-w-lg text-sm text-muted">
          {t("land.securitySub")}
        </p>
      </Reveal>
      <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Decorative connecting glow line */}
        <div className="absolute inset-x-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent lg:block" />
        {items.map((it, i) => {
          const Ic = it.icon;
          return (
            <Reveal key={i} delay={i * 0.1}>
              <div className="spotlight-card group relative rounded-2xl bg-surface p-6 text-center ring-1 ring-line hover:ring-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative z-10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg ring-4 ring-bg transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <Ic className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-base text-ink">{t(`land.${it.key}`)}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{t(`land.${it.key}D`)}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================= TESTIMONIALS */
function Testimonials({ t, lang }: { t: T; lang: string }) {
  const isAr = lang === "ar";
  const [list, setList] = useState<TestimonialType[]>([]);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New review form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newText, setNewText] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Load testimonials
  useEffect(() => {
    setList(getTestimonials());
  }, [showAllModal, showAddModal]);

  const approvedList = list.filter((item) => item.approved);
  const displayItems = approvedList.slice(0, 3);

  const filteredAll = approvedList.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q) ||
      item.text.toLowerCase().includes(q)
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newText.trim()) {
      pushToast(
        isAr ? "يرجى كتابة الاسم والتعليق قبل الإرسال." : "Please fill in your name and comment.",
        "error"
      );
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      addTestimonial(newName, newRole, newText, newRating);
      setIsSubmitting(false);
      setIsSuccess(true);
      setNewName("");
      setNewRole("");
      setNewText("");
      setNewRating(5);
      
      pushToast(
        isAr 
          ? "تم حفظ تعليقك وهو بانتظار مراجعة الإدارة والموافقة عليه."
          : "Your comment has been submitted and is pending admin approval.",
        "success"
      );
    }, 850);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="testimonials">
      <Reveal className="mb-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/60 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {t("land.testimonialsTitle")}
        </span>
        <h2 className="text-balance mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          {t("land.testimonialsTitle")}
        </h2>
        <p className="text-pretty mx-auto mt-4 max-w-lg text-sm text-muted">
          {t("land.testimonialsSub")}
        </p>
      </Reveal>

      {/* Grid displays up to first 3 testimonials */}
      <div className="grid gap-6 md:grid-cols-3">
        {displayItems.map((it, i) => (
          <Reveal key={it.id || i} delay={i * 0.1}>
            <div className="spotlight-card group relative h-full rounded-2xl bg-surface p-6 ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-brand-500/20">
              <div className="mb-4 flex items-center gap-0.5">
                {[...Array(it.rating || 5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-pretty text-sm leading-relaxed text-muted group-hover:text-ink transition-colors line-clamp-4">
                “{it.text}”
              </p>
              <div className="mt-5 flex items-center gap-3 border-t border-line-soft pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 text-xs font-bold text-white shadow-md">
                  {it.name[0] || "A"}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">{it.name}</p>
                  <p className="text-[11px] text-muted">{it.role}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Action buttons under testimonials */}
      <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          onClick={() => {
            setSearchQuery("");
            setShowAllModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-surface px-6 py-3 text-sm font-semibold text-ink ring-1 ring-line shadow-sm transition hover:bg-elevated hover:shadow-md"
        >
          {isAr ? "عرض المزيد من التعليقات" : "View More Testimonials"}
          <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-600 dark:text-brand-300">
            {approvedList.length}
          </span>
        </button>

        <button
          onClick={() => {
            setIsSuccess(false);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/10 transition hover:opacity-95"
        >
          <Sparkles className="h-4 w-4" />
          {isAr ? "أضف تعليقك الآن" : "Add Your Testimonial"}
        </button>
      </div>

      {/* MODAL 1: VIEW ALL TESTIMONIALS */}
      <AnimatePresence>
        {showAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative flex h-full max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line p-6">
                <div>
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                    {isAr ? "آراء وتقييمات أصحاب المراكز التعليمية" : "What Center Owners Say"}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {isAr 
                      ? "تجارب وقصص نجاح حقيقية لشركائنا في النجاح حول الوطن العربي" 
                      : "Real success stories from partners running smarter with Ovidra"}
                  </p>
                </div>
                <button
                  onClick={() => setShowAllModal(false)}
                  className="rounded-xl border border-line bg-surface p-2 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="border-b border-line bg-elevated/20 p-4">
                <input
                  type="text"
                  placeholder={isAr ? "ابحث عن تعليق، اسم شخص، أو سنتر..." : "Search testimonials..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-500 transition"
                />
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {filteredAll.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted">
                      {isAr ? "لا توجد نتائج تطابق بحثك حالياً." : "No matching testimonials found."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {filteredAll.map((it) => (
                      <div key={it.id} className="rounded-2xl border border-line bg-surface/50 p-5 shadow-sm hover:border-brand-500/20 hover:shadow-md transition">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            {[...Array(it.rating || 5)].map((_, j) => (
                              <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted">
                            {new Date(it.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted line-clamp-5">
                          “{it.text}”
                        </p>
                        <div className="mt-4 flex items-center gap-2.5 border-t border-line-soft pt-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                            {it.name[0] || "A"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">{it.name}</p>
                            <p className="text-[10px] text-muted">{it.role}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD TESTIMONIAL FORM */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg rounded-3xl bg-surface border border-line shadow-2xl p-6 overflow-hidden"
            >
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-500" />
                  {isAr ? "شاركنا رأيك وتجربتك" : "Share Your Experience"}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-line bg-surface p-1.5 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isSuccess ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="text-base font-bold text-ink">
                    {isAr ? "تم إرسال تعليقك بنجاح!" : "Sent Successfully!"}
                  </h4>
                  <p className="mt-2 text-sm text-muted px-4">
                    {isAr 
                      ? "شكراً لك على وقتك ومشاركتنا تجربتك الجميلة! سيظهر رأيك فوراً في قسم التعليقات بمجرد موافقة السوبر أدمن عليه من لوحة التحكم."
                      : "Thank you for your valuable feedback! It will be listed once approved by the system super admin."}
                  </p>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="mt-6 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
                  >
                    {isAr ? "حسناً، إغلاق" : "Close"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      {isAr ? "الاسم الكريم *" : "Your Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isAr ? "مثال: أ. محمد أحمد" : "e.g., Ahmed Ali"}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-500 transition"
                    />
                  </div>

                  {/* Role / Center name */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      {isAr ? "اسم السنتر / المسمى الوظيفي *" : "Center Name / Job Title *"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isAr ? "مثال: صاحب سنتر العاصمة" : "e.g., Manager at Future Center"}
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-500 transition"
                    />
                  </div>

                  {/* Rating selection */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      {isAr ? "تقييمك للنظام" : "Your Rating"}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => setNewRating(stars)}
                          className="text-amber-400 hover:scale-110 transition"
                        >
                          <Star
                            className={cn(
                              "h-6 w-6 transition-all",
                              stars <= newRating ? "fill-amber-400" : "fill-none text-muted-foreground/30"
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment text */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1.5">
                      {isAr ? "اكتب تعليقك ورأيك في أوفيدرا *" : "Your Testimonial *"}
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder={isAr 
                        ? "اكتب رأيك وتجربتك مع النظام وكيف ساعدك في تنظيم عملك..." 
                        : "Describe how Ovidra helped streamline your operations..."}
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-500 transition resize-none"
                    />
                  </div>

                  {/* Action button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : null}
                      {isAr ? "إرسال التعليق للمراجعة" : "Submit Review"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ============================================================= PRICING */
function Pricing({
  t,
  lang,
  onSignUp,
}: {
  t: T;
  lang: string;
  onSignUp: () => void;
}) {
  const isAr = lang === "ar";
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      id: "free",
      name: isAr ? "الباقة المجانية" : "Free Plan",
      desc: isAr ? "مثالية للمعلمين المستقلين والمجموعات الصغيرة في البداية." : "Perfect for small teachers & independent tutors starting out.",
      price: "0",
      period: isAr ? "دائمًا" : "forever",
      maxStudents: 30,
      maxTeachers: 2,
      features: [
        t("land.pricing.feature.offline"),
        isAr ? "حتى 30 طالب كحد أقصى" : "Up to 30 students max",
        isAr ? "حتى 2 معلمين بحد أقصى" : "Up to 2 teachers max",
        isAr ? "إدارة الطلاب الأساسية وتسجيل الحضور" : "Basic student management & attendance",
        isAr ? "الجدول الأسبوعي والتقارير الأساسية" : "Weekly schedule & basic reports",
      ],
      popular: false,
      grad: "border-line bg-surface/85 backdrop-blur-sm",
      btnClass: "border border-line bg-surface hover:bg-elevated text-ink",
      isFree: true,
    },
    {
      id: "pro",
      name: isAr ? "الباقة الاحترافية" : "Pro Center Plan",
      desc: isAr ? "الباقة الأكثر شيوعاً للمراكز التعليمية المتوسطة والنشطة." : "Our most popular plan for established educational centers.",
      price: billingCycle === "monthly" ? "150" : "1620",
      period: billingCycle === "monthly" ? (isAr ? "شهرياً" : "monthly") : (isAr ? "سنوياً" : "yearly"),
      maxStudents: 500,
      maxTeachers: 30,
      features: [
        t("land.pricing.feature.offline"),
        t("land.pricing.feature.sync") + (isAr ? " (مزامنة مستمرة)" : " (Continuous sync)"),
        isAr ? "حتى 500 طالب كحد أقصى" : "Up to 500 students max",
        isAr ? "حتى 30 معلم كحد أقصى" : "Up to 30 teachers max",
        isAr ? "حضور ذكي ومسح بالـ QR وبوابة ولي الأمر" : "Smart QR attendance & Parent portal access",
        t("land.pricing.feature.reports") + (isAr ? " (كامل Excel + PDF)" : " (Excel + PDF)"),
        isAr ? "دعم فني متواصل 24/7 (واتساب مباشر)" : "24/7 WhatsApp direct support",
      ],
      popular: true,
      grad: "border-brand-500/35 shadow-[0_30px_60px_-15px_rgba(79,70,229,0.18)] bg-surface/90 backdrop-blur-md ring-2 ring-brand-500/20 dark:bg-brand-950/20",
      btnClass: "bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700 hover:opacity-95 text-white shadow-lg shadow-brand-500/20 shine",
      isFree: false,
    },
    {
      id: "enterprise",
      name: isAr ? "باقة النخبة المتكاملة" : "Elite Enterprise Plan",
      desc: isAr ? "للمراكز الكبيرة متعددة الفروع التي تتطلب سعة قصوى ودعماً مخصصاً." : "For multi-branch centers requiring supreme capacity & custom branding.",
      price: billingCycle === "monthly" ? "400" : "4320",
      period: billingCycle === "monthly" ? (isAr ? "شهرياً" : "monthly") : (isAr ? "سنوياً" : "yearly"),
      maxStudents: "∞",
      maxTeachers: "∞",
      features: [
        isAr ? "كل ميزات باقة المركز الاحترافي" : "Everything in Pro Center Plan",
        isAr ? "طلاب ومعلمين غير محدودين" : "Unlimited students & teachers",
        t("land.pricing.feature.branches") + (isAr ? " (إدارة فروع)" : " (Branches)"),
        t("land.pricing.feature.ai") + (isAr ? " (إرشاد ذكي بـ Gemini)" : " (Gemini AI analysis)"),
        isAr ? "تخصيص كامل للهوية وشعار المركز المخصص" : "Full custom branding & custom logo",
        isAr ? "إدارة الصلاحيات المتقدمة (RBAC) والحسابات المالية للمعلمين" : "Staff roles (RBAC) & teacher pay models",
        isAr ? "دعم أولوي خاص ومدير حساب مباشر للتهيئة" : "Priority dedicated support & setup assistance",
      ],
      popular: false,
      grad: "border-line bg-surface/85 backdrop-blur-sm",
      btnClass: "border border-line bg-surface hover:bg-elevated text-ink",
      isFree: false,
    },
  ];

  // Helper to open WhatsApp exactly like inside the app
  const waLink = (text: string) => {
    const phone = (PAYMENT_DETAILS.whatsappNumber || "201009617278").replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleSubscribe = (planName: string, id: string) => {
    if (id === "free") {
      onSignUp();
      return;
    }
    const periodName = billingCycle === "monthly" ? (isAr ? "الشهري" : "Monthly") : (isAr ? "السنوي (مع خصم 10%)" : "Annual (with 10% discount)");
    const msg = isAr
      ? `السلام عليكم، أريد الاشتراك في الباقة ${planName} - الاشتراك ${periodName} لـ "سنتر بلس"`
      : `Hello, I want to subscribe to the ${planName} plan - ${periodName} subscription for "Center Plus"`;
    window.open(waLink(msg), "_blank", "noopener,noreferrer");
  };

  return (
    <section id="pricing" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
      {/* Decorative localized math elements inside the section background */}
      <div className="pointer-events-none absolute left-10 top-12 opacity-5 select-none dark:opacity-10">
        <span className="font-mono text-8xl font-black">{"f(x)"}</span>
      </div>
      <div className="pointer-events-none absolute right-12 bottom-16 opacity-5 select-none dark:opacity-10">
        <span className="font-serif text-8xl font-black">{"√"}</span>
      </div>

      <Reveal className="mb-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/60 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <Wallet className="h-3.5 w-3.5 text-brand-600" /> {isAr ? "باقات الاشتراك" : "Subscription Tiers"}
        </span>
        <h2 className="text-balance mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          {t("land.pricingTitle")}
        </h2>
        <p className="text-pretty mx-auto mt-4 max-w-lg text-sm text-muted font-medium">
          {t("land.pricingSub")}
        </p>
      </Reveal>

      {/* Billing Cycle Toggle */}
      <div className="mb-14 flex justify-center">
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

      <div className="grid gap-8 lg:grid-cols-3 items-stretch">
        {plans.map((pl, i) => (
          <Reveal key={pl.id} delay={i * 0.1}>
            <div className={cn(
              "relative flex flex-col h-full rounded-[2rem] border p-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-brand-500/30 group",
              pl.grad
            )}>
              {pl.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                  <Sparkles className="h-3 w-3 animate-pulse" /> {t("land.pricing.popular")}
                </span>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-ink transition-colors group-hover:text-brand-500">{pl.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted/90 font-medium min-h-[40px]">{pl.desc}</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1 bg-elevated/40 dark:bg-elevated/10 p-4 rounded-2xl border border-line-soft">
                <span className="text-4xl font-black tracking-tight text-ink">{pl.price}</span>
                <span className="text-xs text-muted font-bold">
                  {isAr ? "ج.م" : "EGP"} / {pl.period}
                </span>
              </div>

              {/* Limits badge */}
              <div className="mb-6 flex gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-elevated/60 dark:bg-elevated/20 px-2.5 py-1.5 text-[11px] font-bold text-ink border border-line-soft">
                  <Users className="h-3.5 w-3.5 text-brand-500" />
                  <span>{pl.maxStudents} {isAr ? "طالب" : "students"}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-elevated/60 dark:bg-elevated/20 px-2.5 py-1.5 text-[11px] font-bold text-ink border border-line-soft">
                  <GraduationCap className="h-3.5 w-3.5 text-violet-500" />
                  <span>{pl.maxTeachers} {isAr ? "معلم" : "teachers"}</span>
                </div>
              </div>

              <ul className="mb-8 space-y-3.5 flex-1">
                {pl.features.map((ft, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-xs text-muted/95 font-semibold leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(pl.name, pl.id)}
                className={cn(
                  "w-full rounded-2xl py-3.5 text-xs font-black tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer",
                  pl.btnClass
                )}
              >
                {pl.isFree ? (isAr ? "ابدأ مجاناً الآن" : "Start Free Now") : (isAr ? "اشترك الآن" : "Subscribe Now")}
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============================================================= STEPS */
function Steps({ t }: { t: T }) {
  const steps = [
    { icon: ShieldCheck, title: t("land.step1"), desc: t("land.step1D"), n: "01", grad: "from-brand-500 to-brand-600" },
    { icon: GraduationCap, title: t("land.step2"), desc: t("land.step2D"), n: "02", grad: "from-accent-500 to-accent-600" },
    { icon: Zap, title: t("land.step3"), desc: t("land.step3D"), n: "03", grad: "from-emerald-500 to-teal-600" },
  ];
  return (
    <section id="steps" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <Reveal className="mb-14 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-500">
          {t("land.stepsTitle")}
        </span>
        <h2 className="text-balance mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          {t("land.stepsTitle")}
        </h2>
        <p className="text-pretty mx-auto mt-4 max-w-lg text-sm text-muted">
          {t("land.stepsSub")}
        </p>
      </Reveal>
      <div className="relative grid gap-8 md:grid-cols-3">
        {/* Horizontal connect line */}
        <div className="absolute inset-x-0 top-10 hidden h-0.5 bg-gradient-to-r from-transparent via-brand-200 to-transparent dark:via-brand-500/20 md:block" />
        {steps.map((s, i) => {
          const Ic = s.icon;
          return (
            <Reveal key={i} delay={i * 0.12}>
              <div className="relative group text-center">
                <div className={cn(
                  "relative z-10 mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl ring-4 ring-bg transition-all duration-300 group-hover:scale-110",
                  s.grad
                )}>
                  <Ic className="h-7 w-7" />
                  <span className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white ring-2 ring-bg dark:bg-white dark:text-black">
                    {s.n}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-ink transition-colors group-hover:text-brand-500">
                  {s.title}
                </h3>
                <p className="text-pretty mx-auto mt-2 max-w-xs text-sm text-muted">
                  {s.desc}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================= DEVELOPER SIGNATURE */
function DeveloperSignature({ t, lang }: { t: T; lang: string }) {
  const isAr = lang === "ar";
  return (
    <section className="noise-overlay relative overflow-hidden py-24 sm:py-32">
      {/* Decorative colored orbs */}
      <div className="aurora pointer-events-none absolute -left-20 -top-10 h-80 w-80 rounded-full bg-brand-500/15 blur-[100px]" />
      <div className="aurora pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-accent-500/15 blur-[100px]" style={{ animationDelay: "3s" }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-brand-500/5 via-accent-500/5 to-violet-500/5 blur-[130px] animate-pulse pointer-events-none" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel relative overflow-hidden rounded-[2.5rem] p-8 text-center shadow-[0_40px_90px_-20px_rgba(15,23,42,0.18)] sm:p-14 border border-line-soft before:pointer-events-none before:absolute before:-inset-[1px] before:rounded-[2.5rem] before:p-[1px] before:bg-gradient-to-br before:from-brand-500/40 before:via-accent-500/30 before:to-violet-500/40 before:opacity-0 before:transition before:duration-500 hover:before:opacity-100"
          >
            {/* Sliding infinite gradient top bar */}
            <motion.div
              className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: "200% auto" }}
            />

            {/* Glowing floating mathematical formulas (Perfect decorations for a mathematics teacher) */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06] dark:opacity-[0.12]">
              <div className="absolute top-10 left-12 font-mono text-xs font-bold rotate-12 select-none">{"∫ e^x dx = e^x"}</div>
              <div className="absolute top-16 right-16 font-mono text-sm font-bold -rotate-12 select-none">{"a² + b² = c²"}</div>
              <div className="absolute bottom-16 left-16 font-mono text-sm font-bold -rotate-6 select-none">{"f(x) = sin(x)"}</div>
              <div className="absolute bottom-10 right-12 font-mono text-xs font-bold rotate-12 select-none">{"∑_{i=1}^n i = n(n+1)/2"}</div>
            </div>

            {/* Avatar block with premium sub-layers */}
            <Reveal delay={0.05}>
              <div className="relative mx-auto mb-8 w-fit">
                {/* Back glowing aura */}
                <motion.div
                  className="absolute -inset-5 rounded-full bg-gradient-to-br from-brand-500/25 via-accent-500/20 to-violet-500/25 blur-2xl"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Thin spinning compass/protractor ring */}
                <motion.div
                  className="absolute -inset-2 rounded-full border border-dashed border-brand-500/30 dark:border-brand-500/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Custom mathematics theme vector avatar */}
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 via-brand-950 to-indigo-950 text-white shadow-2xl ring-4 ring-brand-500/50 overflow-hidden group/avatar">
                  {/* Glowing core overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/20 to-accent-500/20 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
                  
                  {/* Floating math symbols inside the avatar */}
                  <div className="absolute top-2.5 left-4 text-[10px] opacity-40 font-mono text-brand-300">∑</div>
                  <div className="absolute bottom-3 right-5 text-[11px] opacity-40 font-mono text-accent-300">f(x)</div>
                  <div className="absolute top-4 right-4 text-[12px] opacity-35 font-mono text-sky-300">π</div>
                  <div className="absolute bottom-4 left-5 text-[10px] opacity-35 font-mono text-violet-300">√x</div>
                  
                  {/* Styled Monogram initials */}
                  <div className="relative z-10 flex flex-col items-center select-none">
                    <span className="text-4xl font-black tracking-tighter bg-gradient-to-r from-brand-400 via-accent-300 to-sky-400 bg-clip-text text-transparent">MG</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400/80 -mt-0.5">Math & Code</span>
                  </div>
                </div>

                {/* Star Accent Badge */}
                <motion.span
                  className="absolute -bottom-1 -end-1 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg ring-4 ring-bg"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Star className="h-4.5 w-4.5 fill-current" />
                </motion.span>
              </div>
            </Reveal>

            {/* Developer text description */}
            <Reveal delay={0.1}>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-500/90 dark:text-brand-400">
                {isAr ? "مطور ومصمم النظام" : t("land.dev.title")}
              </p>
              
              <h3 className="mt-2.5 bg-gradient-to-r from-brand-600 via-accent-600 to-violet-600 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl dark:from-brand-300 dark:via-accent-300 dark:to-violet-300">
                {isAr ? "مستر محمد الجزار" : "Mohamed El-Gazzar"}
              </h3>
              
              <p className="mt-2 text-sm font-bold text-muted">
                {isAr ? "مدرس مادة الرياضيات للمرحلتين الابتدائية والإعدادية بشربين" : t("welcome.creatorTitle")}
              </p>
              
              <p className="text-pretty mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted/90 font-medium">
                {t("land.dev.desc")}
              </p>
            </Reveal>

            {/* Floating Action Capsules */}
            <Reveal delay={0.18}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                {/* Premium WhatsApp Button */}
                <a
                  href="https://wa.me/201009617278"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shine group relative inline-flex items-center gap-3 rounded-2xl bg-[#25D366] px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-600/35 active:scale-95 overflow-hidden"
                >
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  <MessageCircle className="h-5 w-5 transition-transform group-hover:scale-110 relative z-10" />
                  <span className="relative z-10 text-start leading-tight">
                    <span className="block">{t("welcome.contact")}</span>
                    <span className="block font-mono text-xs opacity-90 font-bold" dir="ltr">{t("land.dev.phone")}</span>
                  </span>
                </a>

                {/* Email link as a pill */}
                <a
                  href="mailto:hello@centerplus.app"
                  className="group inline-flex items-center gap-2.5 rounded-2xl border border-line bg-surface/80 px-6 py-4 text-sm font-bold shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-400 hover:text-brand-600 hover:shadow-lg hover:shadow-brand-500/10"
                >
                  <Mail className="h-4.5 w-4.5 text-muted transition-transform group-hover:scale-110 group-hover:text-brand-500" />
                  <span>{isAr ? "راسلنا بالبريد" : "Email Us"}</span>
                </a>
              </div>
            </Reveal>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================= FOOTER */
function Footer({ t }: { t: T }) {
  const { theme } = useApp();
  const cols = [
    { title: t("land.footer.product"), links: [t("nav.dashboard"), t("nav.students"), t("nav.teachers"), t("nav.finance")] },
    { title: t("land.footer.features"), links: [t("feat.attendance"), t("feat.ai"), t("feat.reports"), t("feat.schedule")] },
    { title: t("land.footer.support"), links: [t("welcome.contact"), t("land.footer.privacy"), "FAQ"] },
  ];
  return (
    <footer className="relative overflow-hidden border-t border-line bg-surface/80 backdrop-blur-md">
      <div className="aurora pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-brand-500/5 blur-[100px]" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand block */}
          <div className="lg:pe-8">
            <div className="flex items-center gap-2.5 mb-4">
              <OvidraLogo theme={theme as "light" | "dark"} size="md" className="shrink-0 select-none justify-start" />
            </div>
            <p className="text-pretty mt-4 text-xs font-medium leading-relaxed text-muted">
              {t("welcome.tagline")}
            </p>
            <div className="mt-5 flex gap-2">
              {[Globe, Cloud, ShieldCheck].map((Ic, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-300 hover:text-brand-600"
                >
                  <Ic className="h-4 w-4" />
                </div>
              ))}
            </div>
          </div>
          {/* Link lists */}
          {cols.map((c, i) => (
            <div key={i}>
              <p className="text-sm font-extrabold text-ink">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l, j) => (
                  <li key={j}>
                    <a href="#" className="text-xs font-semibold text-muted transition hover:text-brand-600">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Copyright notice */}
        <div className="mt-12 border-t border-line pt-6">
          <p className="text-center font-mono text-[11px] text-faint font-bold">
            {t("land.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================= BACKGROUND MATH DECORATIONS */
export function InteractiveMathCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Mathematical symbols floating around
    const symbols = ["∑", "π", "√x", "f(x)", "θ", "∞", "∫", "a²+b²", "log", "Δ", "e^x", "dy/dx"];
    const particles = symbols.map((sym, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      text: sym,
      size: 11 + Math.random() * 7,
      angle: Math.random() * Math.PI * 2,
      angularSpeed: (Math.random() - 0.5) * 0.008,
      color: index % 3 === 0 ? "#6d5dfc" : index % 3 === 1 ? "#a78bfa" : "#38bdf8",
    }));

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);

      const isDarkMode = document.documentElement.classList.contains("dark");
      
      // 1. Draw mathematical grid lines with glowing mouse intersections
      const gridSpacing = 80;
      ctx.strokeStyle = isDarkMode ? "rgba(99, 102, 241, 0.06)" : "rgba(99, 102, 241, 0.03)";
      ctx.lineWidth = 0.75;

      // Vertical lines
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw glowing dot nodes at intersections with mouse highlight
      const { x: mx, y: my, active: mActive } = mouseRef.current;
      
      // First draw ALL static dots super fast using fillRect (extremely optimized, no paths or arcs)
      ctx.fillStyle = isDarkMode ? "rgba(99, 102, 241, 0.12)" : "rgba(99, 102, 241, 0.06)";
      for (let x = 0; x < width; x += gridSpacing) {
        for (let y = 0; y < height; y += gridSpacing) {
          ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }

      // Then, only if mouse is active, draw the glowing nodes and connecting lines for nodes near the mouse
      if (mActive) {
        const hoverRadius = 150;
        const startX = Math.max(0, Math.floor((mx - hoverRadius) / gridSpacing) * gridSpacing);
        const endX = Math.min(width, Math.ceil((mx + hoverRadius) / gridSpacing) * gridSpacing);
        const startY = Math.max(0, Math.floor((my - hoverRadius) / gridSpacing) * gridSpacing);
        const endY = Math.min(height, Math.ceil((my + hoverRadius) / gridSpacing) * gridSpacing);

        for (let x = startX; x <= endX; x += gridSpacing) {
          for (let y = startY; y <= endY; y += gridSpacing) {
            const dx = x - mx;
            const dy = y - my;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < hoverRadius * hoverRadius) {
              const dist = Math.sqrt(distSq);
              const intensity = (1 - dist / hoverRadius); // 1 near mouse, 0 at border
              
              // Draw connecting lines from intersection to mouse
              ctx.strokeStyle = isDarkMode 
                ? `rgba(56, 189, 248, ${intensity * 0.12})` 
                : `rgba(99, 102, 241, ${intensity * 0.07})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(mx, my);
              ctx.stroke();

              // Draw glowing node
              ctx.fillStyle = isDarkMode 
                ? `rgba(56, 189, 248, ${0.15 + intensity * 0.65})` 
                : `rgba(99, 102, 241, ${0.12 + intensity * 0.45})`;
              ctx.beginPath();
              ctx.arc(x, y, 2 + intensity * 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // 3. Draw and update particles (floating mathematical symbols)
      particles.forEach((p) => {
        // Move particle
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.angularSpeed;

        // Bounce from boundaries with offset padding
        const pad = 20;
        if (p.x < pad || p.x > width - pad) p.vx *= -1;
        if (p.y < pad || p.y > height - pad) p.vy *= -1;

        // Mouse attraction/repulsion
        if (mActive) {
          const dx = mx - p.x;
          const dy = my - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 200 * 200) {
            const dist = Math.sqrt(distSq);
            // Draw a subtle halo connecting the floating symbol
            ctx.strokeStyle = isDarkMode
              ? `rgba(139, 92, 246, ${(1 - dist / 200) * 0.18})`
              : `rgba(99, 102, 241, ${(1 - dist / 200) * 0.08})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mx, my);
            ctx.stroke();

            // Apply light force repelling symbols slightly
            const force = (1 - dist / 200) * 0.12;
            p.vx -= (dx / dist) * force;
            p.vy -= (dy / dist) * force;
          }
        }

        // Apply drag to keep speed reasonable
        p.vx = Math.max(-1.5, Math.min(1.5, p.vx * 0.98));
        p.vy = Math.max(-1.5, Math.min(1.5, p.vy * 0.98));

        // Draw symbol
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.font = `bold ${p.size}px 'Space Grotesk', 'Cairo', sans-serif`;
        
        // Gradient or glowing neon style for text
        ctx.fillStyle = isDarkMode ? p.color : "rgba(15, 20, 36, 0.3)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen opacity-65 dark:opacity-85 pointer-events-none -z-10" />;
}

export function MathBackgroundDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
      {/* Smooth, soft pulsing/rotating light and dark ambient gradients */}
      <div className="absolute -left-20 top-0 h-[600px] w-[600px] rounded-full bg-brand-500/10 dark:bg-brand-500/15 blur-[130px] animate-pulse-soft" />
      <div className="absolute -right-20 top-40 h-[650px] w-[650px] rounded-full bg-accent-500/10 dark:bg-accent-500/15 blur-[140px] animate-pulse-soft" style={{ animationDelay: "3s" }} />
      <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-sky-400/8 dark:bg-sky-400/12 blur-[110px] animate-pulse-soft" style={{ animationDelay: "6s" }} />

      {/* Fully interactive math and grid system canvas backdrop */}
      <InteractiveMathCanvas />
    </div>
  );
}

/* ============================================================= FULL PAGE MATHEMATICAL ENGRAVINGS */
export function FullPageMathematicalEngravings() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
      {/* Decorative math symbol 1: Left margin at ~900px */}
      <div className="absolute left-[3%] top-[900px] opacity-[0.03] dark:opacity-[0.08] transition-opacity animate-float-slow">
        <svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-brand-500">
          <circle cx="50" cy="50" r="40" strokeDasharray="2 4" />
          <line x1="50" y1="10" x2="50" y2="90" />
          <line x1="10" y1="50" x2="90" y2="50" />
          <path d="M 50 50 L 78 22" strokeWidth="1.5" />
          <path d="M 60 50 A 10 10 0 0 0 57 43" strokeWidth="1" />
          <text x="62" y="44" className="font-mono text-[6px] fill-current">30°</text>
        </svg>
      </div>

      {/* Decorative math symbol 2: Right margin at ~1600px */}
      <div className="absolute right-[4%] top-[1600px] opacity-[0.03] dark:opacity-[0.08] transition-opacity animate-float-reverse">
        <div className="flex flex-col items-end gap-1 font-mono text-sm font-bold text-accent-500">
          <div>{"lim (x→∞) (1 + 1/n)ⁿ = e"}</div>
          <div className="text-xs opacity-75">{"d/dx [ln(x)] = 1/x"}</div>
        </div>
      </div>

      {/* Decorative math symbol 3: Left margin at ~2400px (Geometric protractor) */}
      <div className="absolute left-[4%] top-[2400px] opacity-[0.03] dark:opacity-[0.08] transition-opacity">
        <svg width="220" height="120" viewBox="0 0 200 100" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-sky-500">
          <path d="M 10 90 A 90 90 0 0 1 190 90 Z" />
          <path d="M 40 90 A 60 60 0 0 1 160 90" strokeDasharray="3 3" />
          <line x1="100" y1="90" x2="100" y2="10" />
          <line x1="100" y1="90" x2="150" y2="40" strokeWidth="1.25" />
          <circle cx="100" cy="90" r="5" fill="currentColor" />
        </svg>
      </div>

      {/* Decorative math symbol 4: Right margin at ~3100px (Cartesian vector coordinates) */}
      <div className="absolute right-[5%] top-[3100px] opacity-[0.04] dark:opacity-[0.09] transition-opacity animate-float-slow">
        <svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-indigo-500">
          <line x1="10" y1="50" x2="90" y2="50" strokeWidth="1.25" />
          <line x1="50" y1="10" x2="50" y2="90" strokeWidth="1.25" />
          <path d="M 50 50 L 80 30" stroke="currentColor" strokeWidth="2" />
          <path d="M 50 50 L 30 20" stroke="currentColor" strokeWidth="1.5" />
          <text x="82" y="28" className="font-mono text-[7px] fill-current font-bold">{"v⃗ = (3, 2)"}</text>
          <text x="18" y="18" className="font-mono text-[6px] fill-current">{"u⃗ = (-2, 3)"}</text>
        </svg>
      </div>

      {/* Decorative math symbol 5: Left margin at ~3900px */}
      <div className="absolute left-[3%] top-[3900px] opacity-[0.03] dark:opacity-[0.08] transition-opacity animate-float-reverse">
        <div className="flex flex-col gap-1.5 font-serif text-3xl font-extrabold italic text-brand-500">
          <div>{"∫ x² dx = x³/3 + C"}</div>
          <div className="font-mono text-xs not-italic opacity-70">{"f'(x) = 2x"}</div>
        </div>
      </div>

      {/* Decorative math symbol 6: Right margin at ~4600px */}
      <div className="absolute right-[3%] top-[4600px] opacity-[0.03] dark:opacity-[0.08] transition-opacity animate-float-slow">
        <svg width="160" height="160" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-violet-500">
          <polygon points="50,5 95,35 78,85 22,85 5,35" strokeDasharray="2 2" />
          <polygon points="50,20 80,42 68,75 32,75 20,42" />
          <circle cx="50" cy="50" r="10" />
        </svg>
      </div>
    </div>
  );
}

/* ============================================================= OTHER APPLICATIONS */
function OtherApps({ lang }: { lang: string }) {
  const isAr = lang === "ar";
  
  const novaboardFeatures = [
    {
      title: isAr ? "سبورة ذكية تفاعلية بالكامل" : "Interactive Smart Whiteboard",
      desc: isAr ? "رسم وتلوين وكتابة بأدوات متطورة وألوان حية لتسهيل الشرح وتبسيط المعلومة." : "Draw, color, and write with advanced tools and vibrant colors to make teaching effortless."
    },
    {
      title: isAr ? "استيراد ملفات PDF والصور" : "Import PDF and Images",
      desc: isAr ? "إمكانية عرض المذكرات الدراسية والصور وتكبيرها وتصغيرها والكتابة فوقها مباشرة." : "Display, zoom, and annotate lesson notes and educational diagrams directly on the board."
    },
    {
      title: isAr ? "تصدير وحفظ الدروس" : "Export and Save Lessons",
      desc: isAr ? "حفظ الدروس والسبورات المشروحة كملفات صور أو PDF لمشاركتها فوراً مع الطلاب." : "Save and export your annotated boards as images or PDF to share instantly with students."
    },
    {
      title: isAr ? "أشكال هندسية وأدوات رياضية" : "Geometric and Math Tools",
      desc: isAr ? "رسم متكامل للأشكال ثنائية وثلاثية الأبعاد وأدوات القياس لمدرسي الرياضيات والعلوم." : "Comprehensive support for drawing 2D & 3D shapes to simplify geometry and mathematical concepts."
    },
    {
      title: isAr ? "بث ومشاركة تفاعلية لحظية" : "Real-time Live Broadcasting",
      desc: isAr ? "إمكانية بث السبورة للطلاب ومشاركتها معهم في نفس الوقت لتفاعل دراسي غير مسبوق." : "Broadcast your board live to your students to enable real-time classroom participation."
    }
  ];

  return (
    <section id="other-apps" className="mx-auto max-w-5xl px-4 py-24 sm:px-6 border-t border-line/40">
      <Reveal className="mb-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/60 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <Globe className="h-3.5 w-3.5 text-brand-600" /> {isAr ? "تطبيقاتنا الأخرى" : "Our Other Applications"}
        </span>
        <h2 className="text-balance mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          {isAr ? "اكتشف منصة نـوفا بورد" : "Explore NovaBoard"}
        </h2>
        <p className="text-pretty mx-auto mt-4 max-w-lg text-sm text-muted">
          {isAr 
            ? "السبورة الإلكترونية الذكية الأقوى للمعلمين والمدربين، المصممة خصيصاً لإثراء العملية التعليمية وجعل الشرح أكثر متعة وتفاعلية." 
            : "The ultimate smart electronic whiteboard designed for teachers, educators, and schools to elevate classroom collaboration."}
        </p>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-12 items-stretch">
        {/* NovaBoard Promo Card */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-line bg-surface p-8 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-brand-600 text-white shadow-md">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-ink">نوفا بورد</h3>
                <p className="text-xs text-brand-500 font-bold">www.novaboard.online</p>
              </div>
            </div>

            <p className="text-sm font-semibold text-muted leading-relaxed mb-6">
              {isAr 
                ? "سبورة تعليمية ذكية تعمل بالكامل من خلال المتصفح، تمنحك كافة الأدوات التي تحتاجها لشرح دروسك بطريقة تفاعلية جذابة وبأعلى أداء وموثوقية." 
                : "A web-based intelligent whiteboard that runs directly in your browser. It offers a powerful set of sketching and annotation tools designed for teachers."}
            </p>
          </div>

          <div className="mt-8">
            <a
              href="https://www.novaboard.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="shine w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-md hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span>{isAr ? "زيارة موقع نوفا بورد" : "Visit NovaBoard Website"}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </a>
          </div>
        </div>

        {/* Features List */}
        <div className="lg:col-span-7 grid gap-4">
          {novaboardFeatures.map((f, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="flex gap-4 p-5 rounded-2xl border border-line bg-surface/50 hover:border-brand-500/30 transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-ink">{f.title}</h4>
                  <p className="mt-1 text-xs text-muted leading-relaxed font-semibold">{f.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================= DOWNLOADS CENTER */
function DownloadsCenter({ lang }: { lang: string }) {
  const isAr = lang === "ar";

  const downloads = [
    {
      title: isAr ? "تحميل تطبيق سطح المكتب للمركز" : "Download Center Desktop App",
      desc: isAr ? "النسخة الكاملة لأجهزة الكمبيوتر والويندوز لإدارة السنتر بكفاءة مع ميزات العمل بدون إنترنت والمزامنة الذكية." : "The comprehensive Windows application to manage your educational center offline with auto cloud sync.",
      buttonText: isAr ? "تحميل للويندوز Windows" : "Download for Windows",
      badge: isAr ? "البرنامج الرئيسي" : "Core Software",
      icon: Smartphone,
      color: "from-brand-500 to-indigo-600"
    },
    {
      title: isAr ? "تحميل تطبيق بوابة المدرس" : "Download Teacher Portal App",
      desc: isAr ? "تطبيق مخصص لتسهيل رصد الحضور، تسجيل درجات الامتحانات وتكليفات الواجبات اليومية من الهواتف والتابلت." : "Tailored mobile and tablet application for teachers to manage attendance, exams, and homework dispatch.",
      buttonText: isAr ? "تحميل التطبيق" : "Download App",
      badge: isAr ? "بوابة المعلم" : "Teacher Portal",
      icon: GraduationCap,
      color: "from-indigo-500 to-purple-600"
    },
    {
      title: isAr ? "تحميل تطبيق بوابة ولي الأمر" : "Download Parent Portal App",
      desc: isAr ? "تطبيق المتابعة اللحظية لأولياء الأمور لاستعراض الحضور والغياب، نتائج الامتحانات والتقارير المالية والتحليلية." : "Real-time performance, attendance tracking, and reporting application built for student parents.",
      buttonText: isAr ? "تحميل التطبيق" : "Download App",
      badge: isAr ? "المتابعة الأبوية" : "Parent Portal",
      icon: Users,
      color: "from-emerald-500 to-teal-600"
    },
    {
      title: isAr ? "تحميل تطبيق بوابة الطالب" : "Download Student Portal App",
      desc: isAr ? "تطبيق الطالب لاستعراض الباركود الثنائي الذكي QR، جداول المواعيد والدرجات، وحل الواجبات المنزلية التفاعلية." : "Interactive portal application for students to check schedule, view digital ID cards, and access homework.",
      buttonText: isAr ? "تحميل التطبيق" : "Download App",
      badge: isAr ? "بوابة الطالب" : "Student Portal",
      icon: GraduationCap,
      color: "from-amber-500 to-rose-600"
    }
  ];

  return (
    <section id="downloads" className="mx-auto max-w-5xl px-4 py-24 sm:px-6 border-t border-line/40">
      <Reveal className="mb-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/60 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <ArrowDown className="h-3.5 w-3.5 text-brand-600" /> {isAr ? "تحميلات النظام" : "System Downloads"}
        </span>
        <h2 className="text-balance mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          {isAr ? "مركز تحميل التطبيقات" : "Application Download Center"}
        </h2>
        <p className="text-pretty mx-auto mt-4 max-w-lg text-sm text-muted">
          {isAr 
            ? "نوفر لك ولطاقم العمل والطلاب تطبيقات مخصصة ومستقلة لتجربة أداء متميزة وسرعة فائقة في رصد ومتابعة العملية التعليمية." 
            : "Deploy Ovidra native portals across your school. Dedicated client binaries and specialized portal files for smooth interactions."}
        </p>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-2">
        {downloads.map((d, i) => {
          const Ic = d.icon;
          return (
            <Reveal key={i} delay={i * 0.1}>
              <div className="flex flex-col h-full rounded-3xl border border-line bg-surface p-6 hover:-translate-y-1 hover:shadow-xl transition-all relative overflow-hidden group">
                <span className="absolute top-4 end-4 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                  {d.badge}
                </span>

                <div className="flex items-center gap-3.5 mb-4">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", d.color)}>
                    <Ic className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-ink leading-snug pe-16">{d.title}</h3>
                </div>

                <p className="text-xs font-semibold text-muted leading-relaxed mb-6 flex-1">{d.desc}</p>

                <div>
                  <button
                    onClick={() => {
                      pushToast(
                        isAr 
                          ? "رابط التحميل سيتم ربطه قريباً فور توفره من لوحة التحكم المتقدمة!" 
                          : "Download link will be attached soon upon generation!",
                        "info"
                      );
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-elevated border border-line text-xs font-bold text-ink hover:bg-line-soft hover:border-brand-500/30 px-4 py-3.5 transition-all cursor-pointer"
                  >
                    <ArrowDown className="h-4 w-4 animate-bounce" />
                    <span>{d.buttonText}</span>
                  </button>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}



