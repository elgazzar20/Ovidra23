import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Toaster } from "./components/ui";
import { Layout } from "./components/Layout";
import { Welcome } from "./pages/Welcome";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { Teachers } from "./pages/Teachers";
import { Classes } from "./pages/Classes";
import { Schedule } from "./pages/Schedule";
import { Attendance } from "./pages/Attendance";
import { SmartAttendance } from "./pages/SmartAttendance";
import { Finance } from "./pages/Finance";
import { Exams } from "./pages/Exams";
import { Reports } from "./pages/Reports";
import { Staff } from "./pages/Staff";
import { Branches } from "./pages/Branches";
import { Messages } from "./pages/Messages";
import { ParentPortal } from "./pages/ParentPortal";
import { TeacherPortal } from "./pages/TeacherPortal";
import { AIAssistant } from "./pages/AIAssistant";
import { Settings } from "./pages/Settings";
import { IdCards } from "./pages/IdCards";
import { Tickets } from "./pages/Tickets";
import { SuperAdminDashboard } from "./pages/superadmin/SuperAdminDashboard";
import { Upgrade } from "./pages/Upgrade";
import { checkSuperAdminRole, fetchGlobalSettings, type GlobalPlatformSettings } from "./lib/superadmin";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./components/ui";

type ExternalView = "welcome" | "login" | "parent" | "student" | "teacher";

function applyGlobalSettings(settings: GlobalPlatformSettings) {
  if (!settings) return;

  // 1. Title
  if (settings.platformName) {
    document.title = settings.platformName;
  }

  // 2. Favicon
  if (settings.faviconUrl) {
    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = settings.faviconUrl;
    } else {
      const newLink = document.createElement("link");
      newLink.rel = "icon";
      newLink.href = settings.faviconUrl;
      document.head.appendChild(newLink);
    }
  }

  // 3. Fonts & Colors Style Block
  let styleEl = document.getElementById("dynamic-platform-settings") as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "dynamic-platform-settings";
    document.head.appendChild(styleEl);
  }

  const colors = settings.themeColors || {};
  const b500 = colors.brand500 || "#6d5dfc";
  const b600 = colors.brand600 || "#5a47f0";
  const b700 = colors.brand700 || "#4f46e5";
  const a600 = colors.accent600 || "#7c3aed";
  const bgL = colors.bgLight || "#f4f5fb";
  const bgD = colors.bgDark || "#030714";
  const font = settings.fontFamily || "Tajawal";

  // Check if chosen font is Google Font
  const googleFonts = ["Tajawal", "Cairo", "Amiri", "Inter"];
  const fontImport = googleFonts.includes(font)
    ? `@import url('https://fonts.googleapis.com/css2?family=${font}:wght@400;500;600;700;800;900&display=swap');`
    : "";

  styleEl.innerHTML = `
    ${fontImport}
    :root {
      --color-brand-500: ${b500} !important;
      --color-brand-600: ${b600} !important;
      --color-brand-700: ${b700} !important;
      --color-accent-600: ${a600} !important;
      --shadow-brand: 0 14px 30px -10px ${b500}55 !important;
      --bg: ${bgL} !important;
      --font-sans: "${font}", "Inter", "Cairo", ui-sans-serif, system-ui, sans-serif !important;
    }
    .dark {
      --bg: ${bgD} !important;
    }
    body, html, input, button, select, textarea {
      font-family: "${font}", var(--font-sans) !important;
    }
  `;
}

function Root() {
  const { user, currentBranchId, signOut, lang } = useApp();
  const [route, setRoute] = useState("dashboard");
  const [external, setExternal] = useState<ExternalView>("welcome");
  const [loginMode, setLoginMode] = useState<"in" | "up">("in");
  const [showTelegramPromo, setShowTelegramPromo] = useState(false);

  // ===== Global Platform Settings State =====
  const [globalSettings, setGlobalSettings] = useState<GlobalPlatformSettings | null>(null);
  const [bypassMaintenance, setBypassMaintenance] = useState(false);

  const loadGlobalSettings = () => {
    fetchGlobalSettings().then((settings) => {
      setGlobalSettings(settings);
      applyGlobalSettings(settings);
    });
  };

  useEffect(() => {
    loadGlobalSettings();
    window.addEventListener("platform_settings_updated", loadGlobalSettings);
    return () => window.removeEventListener("platform_settings_updated", loadGlobalSettings);
  }, []);

  // ===== Super Admin State =====
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      const hasSeen = localStorage.getItem("hasSeenTelegramPromo");
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setShowTelegramPromo(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isSuperAdmin]);

  // reset to dashboard whenever the signed-in user or branch changes
  useEffect(() => {
    setRoute("dashboard");
    if (user) setExternal("welcome");
    setIsSuperAdmin(false);
  }, [user?.uid, currentBranchId]);

  // ===== SUPER ADMIN DETECTION (NO OTP) =====
  // Checks admins/super_admin in Firestore.
  // If email matches + active=true → Super Admin dashboard directly.
  // All other users → normal center management flow.
  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    setCheckingAdmin(true);
    checkSuperAdminRole(user.email).then((result) => {
      setIsSuperAdmin(result);
      setCheckingAdmin(false);
    });
  }, [user]);

  // Listen for navigation events
  // MUST be at the top level with other hooks, before any early returns.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setRoute(detail);
    };
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, []);

  // ===== APP LOCK GATING =====
  if (globalSettings?.appLock?.enabled && !isSuperAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-center">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-lg">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 animate-pulse">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-extrabold text-ink mb-3">
            {lang === "ar" ? "تحديث التطبيق مطلوب" : "Application Update Required"}
          </h2>
          <p className="text-xs text-muted leading-relaxed mb-6 whitespace-pre-line">
            {globalSettings.appLock.message || (lang === "ar"
              ? "تم إيقاف هذا الإصدار من التطبيق مؤقتاً لإجراء تحديثات هامة. يرجى تحميل النسخة الجديدة للاستمرار."
              : "This application version is locked for updates. Please download the latest version to proceed.")}
          </p>
          <div className="flex flex-col gap-3">
            {globalSettings.appLock.downloadUrl && (
              <a
                href={globalSettings.appLock.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white py-3 text-sm font-bold transition shadow-lg shadow-brand-500/25 cursor-pointer"
              >
                <span>{lang === "ar" ? "تحميل التحديث الجديد" : "Download New Update"}</span>
              </a>
            )}
            <span className="text-[10px] text-faint mt-2">{lang === "ar" ? "أوفيدرا للخدمات البرمجية" : "Ovidra Software Services"}</span>
          </div>
        </div>
      </div>
    );
  }

  // ===== MAINTENANCE MODE GATING =====
  if (globalSettings?.maintenanceMode?.enabled && !isSuperAdmin && !bypassMaintenance) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-center">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-lg">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 animate-pulse">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-extrabold text-ink mb-3">
            {globalSettings.platformName || "تحت الصيانة حالياً"}
          </h2>
          <p className="text-xs text-muted leading-relaxed mb-6 whitespace-pre-line">
            {globalSettings.maintenanceMode.message || "المنصة في أعمال صيانة مجدولة حالياً لتحديث وتحسين الأنظمة. سنعود للعمل قريباً جداً، نشكر تفهمكم وصبركم."}
          </p>
          <div className="border-t border-line/40 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[10px] text-faint">فريق الدعم الفني وإدارة المنصة</span>
            <button
              onClick={() => {
                setBypassMaintenance(true);
              }}
              className="text-[10px] font-bold text-brand-600 hover:underline cursor-pointer"
            >
              تسجيل دخول الإدارة (Admin Login)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- external (pre sign-in) views ----
  if (!user) {
    if (external === "parent") {
      return (
        <div className="min-h-screen bg-bg">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <ParentPortal external onClose={() => setExternal("welcome")} />
          </div>
        </div>
      );
    }
    if (external === "student") {
      return (
        <div className="min-h-screen bg-bg">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <ParentPortal external isStudent onClose={() => setExternal("welcome")} />
          </div>
        </div>
      );
    }
    if (external === "teacher") {
      return (
        <div className="min-h-screen bg-bg">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <TeacherPortal external onClose={() => setExternal("welcome")} />
          </div>
        </div>
      );
    }
    if (external === "login") {
      return (
        <LoginPage
          onClose={() => setExternal("welcome")}
          onParentPortal={() => setExternal("parent")}
          onStudentPortal={() => setExternal("student")}
          onTeacherPortal={() => setExternal("teacher")}
          defaultMode={loginMode}
        />
      );
    }
    return (
      <Welcome
        onSignIn={(mode) => { setLoginMode(mode); setExternal("login"); }}
        onParentPortal={() => setExternal("parent")}
        onStudentPortal={() => setExternal("student")}
        onTeacherPortal={() => setExternal("teacher")}
      />
    );
  }

  // ===== LOADING while checking admin status =====
  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
          <p className="text-sm text-muted">جارٍ التحقق...</p>
        </div>
      </div>
    );
  }

  // ===== SUPER ADMIN DASHBOARD =====
  // Opens directly — no OTP, no gate.
  if (isSuperAdmin) {
    return (
      <SuperAdminDashboard
        adminUid={user.uid}
        adminEmail={user.email}
        onSignOut={() => { signOut(); setIsSuperAdmin(false); }}
      />
    );
  }

  // Parents only ever reach the read-only portal
  if (user.role === "PARENT") return <ParentPortal />;
  if (user.role === "STUDENT") return <ParentPortal isStudent />;

  // ===== NORMAL USER FLOW =====
  const page = (() => {
    // Direct routing gates for disabled features
    if (globalSettings?.features) {
      if (route === "ai" && globalSettings.features.aiFeatures === false) return <Dashboard onNavigate={setRoute} />;
      if (route === "smart-attendance" && globalSettings.features.smartAttendance === false) return <Dashboard onNavigate={setRoute} />;
      if (route === "reports" && globalSettings.features.reports === false) return <Dashboard onNavigate={setRoute} />;
      if (route === "messages" && globalSettings.features.notifications === false) return <Dashboard onNavigate={setRoute} />;
    }

    switch (route) {
      case "dashboard": return <Dashboard onNavigate={setRoute} />;
      case "students": return <Students />;
      case "idcards": return <IdCards />;
      case "teachers": return <Teachers />;
      case "classes": return <Classes />;
      case "schedule": return <Schedule />;
      case "attendance": return <Attendance />;
      case "smart-attendance": return <SmartAttendance />;
      case "finance": return <Finance />;
      case "exams": return <Exams />;
      case "reports": return <Reports />;
      case "staff": return <Staff />;
      case "branches": return <Branches />;
      case "messages": return <Messages />;
      case "parent": return <ParentPortal />;
      case "student": return <ParentPortal isStudent />;
      case "ai": return <AIAssistant />;
      case "tickets": return <Tickets />;
      case "settings": return <Settings />;
      case "upgrade": return <Upgrade onClose={() => setRoute("settings")} />;
      default: return <Dashboard onNavigate={setRoute} />;
    }
  })();

  return (
    <>
      <Layout current={route} onNavigate={setRoute}>
        <ErrorBoundary key={route}>{page}</ErrorBoundary>
      </Layout>

      <Modal
        open={showTelegramPromo}
        onClose={() => {
          localStorage.setItem("hasSeenTelegramPromo", "true");
          setShowTelegramPromo(false);
        }}
        title={lang === "ar" ? "قناتنا الرسمية على Telegram" : "Our Official Telegram Channel"}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 py-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0088cc]/10 text-[#0088cc]">
            <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.18-.08-.04-.19-.01-.27.01-.12.02-1.95 1.23-5.5 3.62-.52.36-.97.53-1.35.52-.42-.01-1.22-.24-1.82-.44-.73-.24-1.31-.37-1.26-.78.03-.22.33-.44.9-.67 3.52-1.53 5.87-2.54 7.05-3.03 3.35-1.39 4.04-1.63 4.5-.16.1.48.07.97-.04 1.48z"/>
            </svg>
          </div>
          <h3 className="text-base font-extrabold text-ink">
            {lang === "ar" ? "تابع التحديثات والميزات الجديدة!" : "Follow Updates & New Features!"}
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            {lang === "ar"
              ? "اشترك في قناتنا الرسمية على تليجرام لتصلك آخر أخبار التحديثات والميزات الجديدة فور صدورها!"
              : "Subscribe to our official Telegram channel to get the latest updates and new features as they release!"}
          </p>
          <div className="mt-3 flex w-full flex-col gap-2">
            <a
              href="https://t.me/BooksPddf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                localStorage.setItem("hasSeenTelegramPromo", "true");
                setShowTelegramPromo(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white py-2.5 text-xs font-bold transition shadow-lg shadow-[#0088cc]/20 cursor-pointer"
            >
              <span>{lang === "ar" ? "انضم إلينا على تليجرام" : "Join Us on Telegram"}</span>
            </a>
            <button
              onClick={() => {
                localStorage.setItem("hasSeenTelegramPromo", "true");
                setShowTelegramPromo(false);
              }}
              className="w-full text-center py-2 text-[10px] text-faint hover:text-ink transition cursor-pointer"
            >
              {lang === "ar" ? "إغلاق التنبيه" : "Close notification"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Root />
        <Toaster />
      </AppProvider>
    </ErrorBoundary>
  );
}
