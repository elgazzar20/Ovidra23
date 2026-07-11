import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Paintbrush, Globe, Layout, ShieldAlert,
  Save, RotateCcw, AlertTriangle,
  Database, HardDrive, Shield, Check, Info,
  Sparkles, ScanLine, Smartphone, LineChart,
  CreditCard, Key, Bell, Sliders
} from "lucide-react";
import {
  fetchGlobalSettings,
  updateGlobalSettings,
  type GlobalPlatformSettings,
  DEFAULT_PLATFORM_SETTINGS
} from "../../lib/superadmin";
import {
  Card, Input, Textarea, Select, Field, Button, pushToast, Toggle
} from "../../components/ui";

const FONTS = [
  { value: "Tajawal", label: "Tajawal (عربي مقروء وعصري)" },
  { value: "Cairo", label: "Cairo (عربي رياضي ومحدد)" },
  { value: "Amiri", label: "Amiri (عربي كلاسيكي أصيل)" },
  { value: "Inter", label: "Inter (إنجليزي نظيف وحديث)" },
  { value: "system-ui", label: "خط النظام الافتراضي (System)" }
];

const CURRENCIES = [
  { value: "EGP", label: "جنيه مصري (EGP)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
  { value: "SAR", label: "ريال سعودي (SAR)" },
  { value: "AED", label: "درهم إماراتي (AED)" },
  { value: "KWD", label: "دينار كويتي (KWD)" },
  { value: "QAR", label: "ريال قطري (QAR)" }
];

const TIMEZONES = [
  { value: "Africa/Cairo", label: "توقيت القاهرة (GMT+3)" },
  { value: "Asia/Riyadh", label: "توقيت مكة المكرمة (GMT+3)" },
  { value: "Asia/Dubai", label: "توقيت دبي (GMT+4)" },
  { value: "Europe/London", label: "توقيت لندن (GMT+1)" },
  { value: "UTC", label: "التوقيت العالمي الموحد (UTC)" }
];

const COLOR_PRESETS = [
  {
    name: "البنفسجي الإمبراطوري (الافتراضي)",
    brand500: "#6d5dfc",
    brand600: "#5a47f0",
    brand700: "#4f46e5",
    accent600: "#7c3aed"
  },
  {
    name: "الأزرق الملكي",
    brand500: "#2563eb",
    brand600: "#1d4ed8",
    brand700: "#1e40af",
    accent600: "#06b6d4"
  },
  {
    name: "الأخضر الزمردي",
    brand500: "#10b981",
    brand600: "#059669",
    brand700: "#047857",
    accent600: "#14b8a6"
  },
  {
    name: "الوردي الفاخر",
    brand500: "#ec4899",
    brand600: "#db2777",
    brand700: "#be185d",
    accent600: "#f43f5e"
  },
  {
    name: "أحمر الغروب المشرق",
    brand500: "#f43f5e",
    brand600: "#e11d48",
    brand700: "#be123c",
    accent600: "#f97316"
  },
  {
    name: "الداكن الفولاذي (الأسود والأزرق)",
    brand500: "#475569",
    brand600: "#334155",
    brand700: "#1e293b",
    accent600: "#6366f1"
  }
];

export function GlobalSettingsTab({ admin }: { admin: { uid: string; email: string } }) {
  const [settings, setSettings] = useState<GlobalPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"visuals" | "regional" | "maintenance" | "cloud" | "security" | "features">("visuals");

  // Global features toggles
  const [aiFeatures, setAiFeatures] = useState(true);
  const [smartAttendance, setSmartAttendance] = useState(true);
  const [qrAttendance, setQrAttendance] = useState(true);
  const [parentPortal, setParentPortal] = useState(true);
  const [reports, setReports] = useState(true);
  const [onlinePayments, setOnlinePayments] = useState(true);
  const [offlineLicense, setOfflineLicense] = useState(true);
  const [notifications, setNotifications] = useState(true);

  // Form states mapping Settings
  const [platformName, setPlatformName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [brand500, setBrand500] = useState("#6d5dfc");
  const [brand600, setBrand600] = useState("#5a47f0");
  const [brand700, setBrand700] = useState("#4f46e5");
  const [accent600, setAccent600] = useState("#7c3aed");
  const [fontFamily, setFontFamily] = useState<any>("Tajawal");
  
  const [defaultLanguage, setDefaultLanguage] = useState<"ar" | "en">("ar");
  const [defaultCurrency, setDefaultCurrency] = useState("EGP");
  const [timezone, setTimezone] = useState("Africa/Cairo");

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockMessage, setAppLockMessage] = useState("");
  const [appLockDownloadUrl, setAppLockDownloadUrl] = useState("");

  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [fbApiKey, setFbApiKey] = useState("");
  const [fbAuthDomain, setFbAuthDomain] = useState("");
  const [fbProjectId, setFbProjectId] = useState("");
  const [fbStorageBucket, setFbStorageBucket] = useState("");
  const [fbMessagingSenderId, setFbMessagingSenderId] = useState("");
  const [fbAppId, setFbAppId] = useState("");

  const [maxFileSizeMb, setMaxFileSizeMb] = useState(10);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);

  const [sessionTimeout, setSessionTimeout] = useState(120);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [ipWhitelist, setIpWhitelist] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await fetchGlobalSettings();
      setSettings(data);

      // Populate states
      setPlatformName(data.platformName);
      setLogoUrl(data.logoUrl || "");
      setFaviconUrl(data.faviconUrl || "");
      if (data.themeColors) {
        setBrand500(data.themeColors.brand500 || "#6d5dfc");
        setBrand600(data.themeColors.brand600 || "#5a47f0");
        setBrand700(data.themeColors.brand700 || "#4f46e5");
        setAccent600(data.themeColors.accent600 || "#7c3aed");
      }
      setFontFamily(data.fontFamily || "Tajawal");
      setDefaultLanguage(data.defaultLanguage || "ar");
      setDefaultCurrency(data.defaultCurrency || "EGP");
      setTimezone(data.timezone || "Africa/Cairo");

      setMaintenanceEnabled(data.maintenanceMode?.enabled || false);
      setMaintenanceMessage(data.maintenanceMode?.message || "");

      setAppLockEnabled(data.appLock?.enabled || false);
      setAppLockMessage(data.appLock?.message || "");
      setAppLockDownloadUrl(data.appLock?.downloadUrl || "");

      setGeminiApiKey(data.geminiApiKey || "");

      if (data.firebaseConfig) {
        setFbApiKey(data.firebaseConfig.apiKey || "");
        setFbAuthDomain(data.firebaseConfig.authDomain || "");
        setFbProjectId(data.firebaseConfig.projectId || "");
        setFbStorageBucket(data.firebaseConfig.storageBucket || "");
        setFbMessagingSenderId(data.firebaseConfig.messagingSenderId || "");
        setFbAppId(data.firebaseConfig.appId || "");
      }

      if (data.storageSettings) {
        setMaxFileSizeMb(data.storageSettings.maxFileSizeMb || 10);
        setAllowedTypes(data.storageSettings.allowedTypes || []);
      }

      if (data.securitySettings) {
        setSessionTimeout(data.securitySettings.sessionTimeoutMinutes || 120);
        setMaxLoginAttempts(data.securitySettings.maxLoginAttempts || 5);
        setIpWhitelist(data.securitySettings.ipWhitelist || "");
      }

      if (data.features) {
        setAiFeatures(data.features.aiFeatures ?? true);
        setSmartAttendance(data.features.smartAttendance ?? true);
        setQrAttendance(data.features.qrAttendance ?? true);
        setParentPortal(data.features.parentPortal ?? true);
        setReports(data.features.reports ?? true);
        setOnlinePayments(data.features.onlinePayments ?? true);
        setOfflineLicense(data.features.offlineLicense ?? true);
        setNotifications(data.features.notifications ?? true);
      } else {
        setAiFeatures(true);
        setSmartAttendance(true);
        setQrAttendance(true);
        setParentPortal(true);
        setReports(true);
        setOnlinePayments(true);
        setOfflineLicense(true);
        setNotifications(true);
      }
    } catch (e) {
      pushToast("فشل في تحميل الإعدادات العامة للمنصة", "error");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setBrand500(preset.brand500);
    setBrand600(preset.brand600);
    setBrand700(preset.brand700);
    setAccent600(preset.accent600);
    pushToast(`تم تطبيق بالتة الألوان مسبقة الصنع: ${preset.name}`, "info");
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm("هل أنت متأكد من رغبتك في إعادة جميع إعدادات المنصة إلى القيم الافتراضية؟")) return;
    setSaving(true);
    try {
      await updateGlobalSettings(DEFAULT_PLATFORM_SETTINGS, admin);
      pushToast("تمت إعادة تعيين كافة إعدادات المنصة إلى الإعدادات الافتراضية بنجاح!", "success");
      await loadSettings();
    } catch (e) {
      pushToast("حدث خطأ أثناء إعادة التعيين", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!platformName.trim()) {
      pushToast("اسم المنصة مطلوب ولا يمكن تركه فارغاً", "info");
      return;
    }
    setSaving(true);

    const patch: Partial<GlobalPlatformSettings> = {
      platformName,
      logoUrl,
      faviconUrl,
      geminiApiKey,
      themeColors: {
        brand500,
        brand600,
        brand700,
        accent600,
        bgLight: settings?.themeColors?.bgLight || "#f4f5fb",
        bgDark: settings?.themeColors?.bgDark || "#030714",
      },
      fontFamily,
      defaultLanguage,
      defaultCurrency,
      timezone,
      maintenanceMode: {
        enabled: maintenanceEnabled,
        message: maintenanceMessage,
      },
      appLock: {
        enabled: appLockEnabled,
        message: appLockMessage,
        downloadUrl: appLockDownloadUrl,
      },
      firebaseConfig: {
        apiKey: fbApiKey,
        authDomain: fbAuthDomain,
        projectId: fbProjectId,
        storageBucket: fbStorageBucket,
        messagingSenderId: fbMessagingSenderId,
        appId: fbAppId,
      },
      storageSettings: {
        maxFileSizeMb,
        allowedTypes,
      },
      securitySettings: {
        sessionTimeoutMinutes: sessionTimeout,
        maxLoginAttempts,
        ipWhitelist,
      },
      features: {
        aiFeatures,
        smartAttendance,
        qrAttendance,
        parentPortal,
        reports,
        onlinePayments,
        offlineLicense,
        notifications,
      }
    };

    try {
      await updateGlobalSettings(patch, admin);
      pushToast("تم حفظ كافة إعدادات المنصة بنجاح وسيتم تطبيقها ديناميكياً!", "success");
      // Trigger update state so UI notices
      const updated = await fetchGlobalSettings();
      setSettings(updated);
    } catch (e) {
      pushToast("حدث خطأ أثناء حفظ الإعدادات", "error");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleFileType = (type: string) => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter(t => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-3 border-rose-500/30 border-t-rose-600" />
          <span className="text-xs text-muted font-semibold">جارٍ تحميل إعدادات المنصة العامة...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Alert Banner */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex gap-3.5 items-start">
        <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200">صلاحيات تحكم عليا وحساسة للمنصة</h4>
          <p className="text-[11px] text-rose-700/80 leading-relaxed dark:text-rose-300/80">
            تتيح لك هذه اللوحة تغيير هوية المنصة الكاملة، الألوان، الخطوط، عملة الدفع الافتراضية، ومستويات الأمان والحماية.
            كل تغيير يتم حفظه هنا يطبّق فوراً على كافة واجهات المستخدمين، السناتر، وأجهزة الإدارة والطلاب دون الحاجة إلى تعديل الكود المصدري للمشروع.
          </p>
        </div>
      </div>

      {/* Main Settings Navigation Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-line pb-1">
        <button
          onClick={() => setActiveSubTab("visuals")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeSubTab === "visuals"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200"
              : "text-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          <Paintbrush className="h-4 w-4" />
          الهوية المرئية والألوان والخطوط
        </button>

        <button
          onClick={() => setActiveSubTab("regional")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeSubTab === "regional"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200"
              : "text-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          <Globe className="h-4 w-4" />
          الإعدادات الإقليمية والعملة
        </button>

        <button
          onClick={() => setActiveSubTab("maintenance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeSubTab === "maintenance"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200"
              : "text-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          <Layout className="h-4 w-4" />
          وضعية الصيانة (Maintenance)
        </button>

        <button
          onClick={() => setActiveSubTab("cloud")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeSubTab === "cloud"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200"
              : "text-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          <Database className="h-4 w-4" />
          قاعدة البيانات والملفات
        </button>

        <button
          onClick={() => setActiveSubTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeSubTab === "security"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200"
              : "text-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          <Shield className="h-4 w-4" />
          إعدادات الأمان والحماية
        </button>

        <button
          onClick={() => setActiveSubTab("features")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition ${
            activeSubTab === "features"
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-200"
              : "text-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          <Sliders className="h-4 w-4" />
          مركز التحكم بالميزات (Features)
        </button>
      </div>

      {/* SUBTAB 1: VISUALS */}
      {activeSubTab === "visuals" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* General Info Card */}
            <Card className="p-5 md:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-ink border-b border-line/40 pb-2">شعار واسم المنصة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="اسم المنصة الفني" required hint="يظهر كعنوان رئيسي في المتصفح وفي رسائل النظام">
                  <Input
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="مثال: مركز بلس لخدمات الطلاب"
                  />
                </Field>

                <Field label="خط المنصة الرئيسي" hint="يحدد نوع الخط المعتمد لعرض المحتوى في الواجهات">
                  <Select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                    {FONTS.map(font => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="رابط الشعار المخصص (Logo URL)" hint="رابط صورة شعار السنتر لعرضه بدلاً من الرمز الافتراضي">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </Field>

                <Field label="رابط الأيقونة المخصصة (Favicon URL)" hint="رابط أيقونة المتصفح المصغرة للمنصة">
                  <Input
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                  />
                </Field>
              </div>
            </Card>

            {/* Quick Preview Card */}
            <Card className="p-5 space-y-4 bg-elevated/25">
              <h3 className="text-sm font-bold text-ink border-b border-line/40 pb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-rose-500" />
                معاينة الهوية المرئية الحالية
              </h3>
              <div className="space-y-3.5 p-4 rounded-2xl bg-surface border border-line flex flex-col items-center text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-md"
                  style={{ backgroundColor: brand500 }}
                >
                  {platformName ? platformName.slice(0, 2).toUpperCase() : "CP"}
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-bold text-ink block">{platformName || "مركز بلس"}</span>
                  <span className="text-[10px] text-muted block" style={{ fontFamily }}>
                    الخط النشط: {fontFamily}
                  </span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <div className="w-5 h-5 rounded-full border border-line" style={{ backgroundColor: brand500 }} title="Brand 500" />
                  <div className="w-5 h-5 rounded-full border border-line" style={{ backgroundColor: brand600 }} title="Brand 600" />
                  <div className="w-5 h-5 rounded-full border border-line" style={{ backgroundColor: brand700 }} title="Brand 700" />
                  <div className="w-5 h-5 rounded-full border border-line" style={{ backgroundColor: accent600 }} title="Accent 600" />
                </div>
              </div>
              <p className="text-[10px] text-muted leading-relaxed text-center">
                تطبق هذه التغييرات على الفور بمجرد النقر على حفظ في الأسفل، ويتم تحديث الألوان الحية والخطوط على أجهزة جميع الزوار والطلاب الحاليين.
              </p>
            </Card>
          </div>

          {/* Theme Colors Customizer */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink border-b border-line/40 pb-2">تخصيص بالتة ألوان المنصة المتقدمة</h3>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-muted block">اختيار سريع من البالتات الجاهزة:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {COLOR_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => applyPreset(preset)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-line bg-surface hover:bg-elevated transition text-start"
                  >
                    <span className="text-[10px] font-semibold text-ink text-center truncate w-full">{preset.name}</span>
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.brand500 }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.brand600 }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.brand700 }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.accent600 }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <Field label="اللون الأساسي المتدرج (Brand 500)">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brand500}
                    onChange={(e) => setBrand500(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-line cursor-pointer"
                  />
                  <Input value={brand500} onChange={(e) => setBrand500(e.target.value)} className="font-mono text-xs text-center" />
                </div>
              </Field>

              <Field label="اللون المتوسط المتدرج (Brand 600)">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brand600}
                    onChange={(e) => setBrand600(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-line cursor-pointer"
                  />
                  <Input value={brand600} onChange={(e) => setBrand600(e.target.value)} className="font-mono text-xs text-center" />
                </div>
              </Field>

              <Field label="اللون الداكن المتدرج (Brand 700)">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brand700}
                    onChange={(e) => setBrand700(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-line cursor-pointer"
                  />
                  <Input value={brand700} onChange={(e) => setBrand700(e.target.value)} className="font-mono text-xs text-center" />
                </div>
              </Field>

              <Field label="اللون المساعد المميز (Accent 600)">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={accent600}
                    onChange={(e) => setAccent600(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-line cursor-pointer"
                  />
                  <Input value={accent600} onChange={(e) => setAccent600(e.target.value)} className="font-mono text-xs text-center" />
                </div>
              </Field>
            </div>
          </Card>
        </motion.div>
      )}

      {/* SUBTAB 2: REGIONAL */}
      {activeSubTab === "regional" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink border-b border-line/40 pb-2">الموقع واللغة والعملات الافتراضية</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="اللغة الأساسية للمنصة" hint="اللغة الافتراضية للطلاب والزوار الجدد">
                <Select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value as any)}>
                  <option value="ar">العربية (الأولى للأنظمة التعليمية المحلية)</option>
                  <option value="en">English (default international)</option>
                </Select>
              </Field>

              <Field label="العملة الافتراضية الافتراضية" hint="العملة الرسمية المستخدمة في الحسابات والتحصيلات">
                <Select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
                  {CURRENCIES.map(curr => (
                    <option key={curr.value} value={curr.value}>{curr.label}</option>
                  ))}
                </Select>
              </Field>

              <Field label="المنطقة الزمنية الرسمية (Timezone)" hint="تحدد كيفية تسجيل وعرض أوقات الدروس والحصص والعمليات">
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>
        </motion.div>
      )}

      {/* SUBTAB 3: MAINTENANCE */}
      {activeSubTab === "maintenance" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <h3 className="text-sm font-bold text-ink">تفعيل وضع الصيانة المجدولة للمنصة</h3>
              <Toggle checked={maintenanceEnabled} onChange={setMaintenanceEnabled} />
            </div>

            <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 text-amber-700 dark:text-amber-300 flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold">ماذا يحدث عند تفعيل وضع الصيانة؟</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  عند تفعيل هذا الخيار، سيتم فوراً منع جميع الطلاب، أولياء الأمور، السكرتارية، والمدراء الفرعيين من تصفح المنصة.
                  سيتم توجيههم لصفحة صيانة أنيقة تظهر لهم رسالة الصيانة بالأسفل. 
                  <strong className="text-ink font-semibold"> لكنك كمسؤول عام (Super Admin) ستتمكن دائماً من الدخول لتعديل المنصة وتحديثها وتعطيل هذه الوضعية في أي وقت.</strong>
                </p>
              </div>
            </div>

            <Field label="رسالة التنبيه للزوار والطلاب أثناء وضع الصيانة">
              <Textarea
                rows={4}
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="يرجى كتابة الرسالة التي يراها زوار الموقع هنا أثناء تفعيل وضعية الصيانة..."
              />
            </Field>
          </Card>

          {/* App Lock Settings Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-2">
              <h3 className="text-sm font-bold text-ink">قفل وإغلاق التطبيق لتحديث البرنامج (App Lock for Update)</h3>
              <Toggle checked={appLockEnabled} onChange={setAppLockEnabled} />
            </div>

            <div className="p-4 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-700 dark:text-rose-300 flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold">ماذا يحدث عند قفل التطبيق؟</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  عند قفل التطبيق، سيتم إغلاق التطبيق بالكامل أمام المستخدمين العاديين ويظهر لهم شاشة تفيد بضرورة التحديث مع زر لتحميل الإصدار الجديد من موقعك.
                  يستخدم هذا الخيار لشطر التطبيق وإجبار المستخدمين على استخدام أحدث إصدار عند إصدار تحديثات برمجية هامة.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="رابط تحميل التحديث الجديد (Download URL)">
                <Input
                  value={appLockDownloadUrl}
                  onChange={(e) => setAppLockDownloadUrl(e.target.value)}
                  placeholder="https://ovidra.com/download"
                />
              </Field>

              <Field label="رسالة التنبيه التي تظهر للمستخدمين عند قفل التطبيق">
                <Input
                  value={appLockMessage}
                  onChange={(e) => setAppLockMessage(e.target.value)}
                  placeholder="تم إيقاف هذا الإصدار من التطبيق مؤقتاً لإجراء تحديثات هامة. يرجى تحميل النسخة الجديدة للاستمرار."
                />
              </Field>
            </div>
          </Card>
        </motion.div>
      )}

      {/* SUBTAB 4: CLOUD STORAGE */}
      {activeSubTab === "cloud" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Firebase config card */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-line/40 pb-2">
                <Database className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold text-ink">تخصيص اتصال Firebase</h3>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                مطور أو مستضيف هذه المنصة يمكنه ضبط بيانات الاتصال السحابية بـ Firebase الخاصة به بالأسفل. 
                في حال ترك هذه الحقول فارغة، ستستمر المنصة بالعمل تلقائياً على قاعدة البيانات الافتراضية المؤمنة.
              </p>

              <div className="space-y-3.5">
                <Field label="API Key">
                  <Input value={fbApiKey} onChange={(e) => setFbApiKey(e.target.value)} className="font-mono text-xs" placeholder="AIzaSy..." />
                </Field>
                <Field label="Auth Domain">
                  <Input value={fbAuthDomain} onChange={(e) => setFbAuthDomain(e.target.value)} className="font-mono text-xs" placeholder="ovidra-app.firebaseapp.com" />
                </Field>
                <Field label="Project ID">
                  <Input value={fbProjectId} onChange={(e) => setFbProjectId(e.target.value)} className="font-mono text-xs" placeholder="ovidra-app" />
                </Field>
                <Field label="Storage Bucket">
                  <Input value={fbStorageBucket} onChange={(e) => setFbStorageBucket(e.target.value)} className="font-mono text-xs" placeholder="ovidra-app.appspot.com" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Messaging Sender ID">
                    <Input value={fbMessagingSenderId} onChange={(e) => setFbMessagingSenderId(e.target.value)} className="font-mono text-xs" placeholder="8172930219" />
                  </Field>
                  <Field label="App ID">
                    <Input value={fbAppId} onChange={(e) => setFbAppId(e.target.value)} className="font-mono text-xs" placeholder="1:8172:web:910" />
                  </Field>
                </div>
              </div>
            </Card>

            {/* Storage Settings Card */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-line/40 pb-2">
                <HardDrive className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold text-ink">محددات حجم الملفات والرفع</h3>
              </div>

              <div className="space-y-4">
                <Field label="الحد الأقصى لحجم الملف المرفوع (بالـ ميجابايت MB)" hint="أقصى حجم مسموح برفع في حقول ملفات الواجبات والملخصات">
                  <Input
                    type="number"
                    value={maxFileSizeMb}
                    onChange={(e) => setMaxFileSizeMb(Number(e.target.value))}
                    min={1}
                    max={100}
                  />
                </Field>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted block">صيغ الملفات المصرح بها:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3.5">
                    {[
                      { key: "image/*", label: "الصور بجميع أنواعها (Images)" },
                      { key: "application/pdf", label: "ملفات PDF التعليمية" },
                      { key: "application/msword", label: "ملفات Word المستندية (.doc)" },
                      { key: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "ملفات Word الحديثة (.docx)" },
                      { key: "application/vnd.ms-excel", label: "جداول بيانات Excel (.xls)" },
                      { key: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "جداول Excel الحديثة (.xlsx)" }
                    ].map((item) => {
                      const active = allowedTypes.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          onClick={() => toggleFileType(item.key)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-start text-xs font-semibold transition ${
                            active
                              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                              : "border-line bg-surface text-muted hover:bg-elevated"
                          }`}
                        >
                          <span>{item.label}</span>
                          {active && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>

            {/* Gemini API Key Card */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-line/40 pb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <h3 className="text-sm font-bold text-ink">مفتاح Gemini API للذكاء الاصطناعي</h3>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                يستخدم هذا المفتاح لتشغيل المساعد الذكي وتلخيص البيانات والمصنفات الأكاديمية على مستوى المنصة.
                يمكنك الحصول على مفتاح مجاني من Google AI Studio.
              </p>
              <Field label="Gemini API Key">
                <Input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="AIzaSy..."
                />
              </Field>
            </Card>
          </div>
        </motion.div>
      )}

      {/* SUBTAB 5: SECURITY */}
      {activeSubTab === "security" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-line/40 pb-2">
              <Shield className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-bold text-ink">محددات الأمان ومنع الاختراق</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="مدة انتهاء الجلسة التلقائية (بالدقائق)" hint="سيتم تسجيل خروج الموظف أو المستخدمين بعد هذه المدة من الخمول">
                <Input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  min={5}
                />
              </Field>

              <Field label="أقصى عدد من محاولات تسجيل الخاطئة المتتالية" hint="قبل حظر الحساب أو طلب رمز التحقق OTP">
                <Input
                  type="number"
                  value={maxLoginAttempts}
                  onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
                  min={3}
                  max={20}
                />
              </Field>
            </div>

            <Field label="قائمة العناوين البيضاء المسموحة (IP Whitelist)" hint="عناوين IP المسموح لها حصرياً بالدخول إلى لوحة Super Admin (اتركها فارغة للسماح للكل)">
              <Input
                value={ipWhitelist}
                onChange={(e) => setIpWhitelist(e.target.value)}
                placeholder="مثال: 192.168.1.1, 197.34.12.98"
              />
            </Field>
          </Card>
        </motion.div>
      )}

      {/* SUBTAB 6: FEATURE MANAGEMENT CENTER */}
      {activeSubTab === "features" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex gap-3.5 items-start">
            <Sliders className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-200">مركز إدارة وتفعيل الميزات للمنصة (Feature Management Center)</h4>
              <p className="text-[11px] text-emerald-700/80 leading-relaxed dark:text-emerald-300/80">
                يتيح لك هذا القسم إمكانية تفعيل أو تعطيل الخدمات البرمجية والمميزات المتقدمة بضغطة زر واحدة. 
                أي ميزة تقوم بتعطيلها هنا سيتم إخفاؤها أو قفلها فوراً عن جميع السناتر والمستخدمين والطلاب المشتركين بالمنصة دون الحاجة لإعادة تشغيل الخوادم أو تعديل الكود المصدري.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature Cards Grid */}
            {[
              {
                id: "aiFeatures",
                name: "مساعد الذكاء الاصطناعي (AI Features)",
                desc: "تفعيل الميزات الذكية مثل المساعد الشخصي، تلخيص البيانات، وتوليد الأسئلة والاختبارات الآلية.",
                icon: Sparkles,
                color: "text-purple-500 bg-purple-500/10",
                state: aiFeatures,
                setter: setAiFeatures,
              },
              {
                id: "smartAttendance",
                name: "التحضير الذكي للطلاب (Smart Attendance)",
                desc: "تفعيل نظام تسجيل الحضور الذكي والتحضير السريع للطلاب والمدرسين في الحصص.",
                icon: ScanLine,
                color: "text-sky-500 bg-sky-500/10",
                state: smartAttendance,
                setter: setSmartAttendance,
              },
              {
                id: "qrAttendance",
                name: "تحضير رمز الاستجابة السريعة (QR Attendance)",
                desc: "تفعيل مسح الكود QR للتحضير السريع للطلاب عبر الكاميرا أو الأجهزة الخارجية المدمجة.",
                icon: Sliders,
                color: "text-indigo-500 bg-indigo-500/10",
                state: qrAttendance,
                setter: setQrAttendance,
              },
              {
                id: "parentPortal",
                name: "بوابة أولياء الأمور والطلاب (Parent/Student Portal)",
                desc: "تفعيل لوحة المتابعة للطلاب والآباء لمتابعة النتائج، التقارير المالية، الحضور، والواجبات.",
                icon: Smartphone,
                color: "text-emerald-500 bg-emerald-500/10",
                state: parentPortal,
                setter: setParentPortal,
              },
              {
                id: "reports",
                name: "التقارير والإحصائيات المتقدمة (Reports)",
                desc: "توليد تقارير مالية وتحليلية شاملة حول أداء المركز والطلاب والتدفقات المالية والمصروفات.",
                icon: LineChart,
                color: "text-rose-500 bg-rose-500/10",
                state: reports,
                setter: setReports,
              },
              {
                id: "onlinePayments",
                name: "بوابة الدفع الإلكتروني (Online Payments)",
                desc: "تفعيل عمليات السداد أونلاين وتحصيل الرسوم والاشتراكات إلكترونياً عبر بوابات الدفع المعتمدة.",
                icon: CreditCard,
                color: "text-amber-500 bg-amber-500/10",
                state: onlinePayments,
                setter: setOnlinePayments,
              },
              {
                id: "offlineLicense",
                name: "التراخيص دون اتصال (Offline License)",
                desc: "السماح بتشغيل وتفعيل السناتر دون اتصال دائم بالإنترنت عبر حزم التراخيص المشفرة محلياً.",
                icon: Key,
                color: "text-teal-500 bg-teal-500/10",
                state: offlineLicense,
                setter: setOfflineLicense,
              },
              {
                id: "notifications",
                name: "مركز الإشعارات والرسائل (Notifications)",
                desc: "تفعيل إرسال الرسائل الفورية والتنبيهات العامة والخاصة بين الإدارة، المدرسين، والطلاب.",
                icon: Bell,
                color: "text-blue-500 bg-blue-500/10",
                state: notifications,
                setter: setNotifications,
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.id} className="p-4 flex items-center justify-between hover:shadow-md transition duration-150">
                  <div className="flex gap-3 items-start min-w-0 flex-1 pl-4">
                    <div className={`p-2.5 rounded-xl shrink-0 ${feature.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-bold text-ink truncate">{feature.name}</h4>
                      <p className="text-[10px] text-muted leading-relaxed line-clamp-2">{feature.desc}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Toggle checked={feature.state} onChange={feature.setter} />
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Save Action Bars */}
      <div className="flex justify-between items-center bg-surface border border-line rounded-2xl p-4">
        <Button variant="ghost" className="text-xs flex items-center gap-1.5" onClick={handleResetToDefaults} disabled={saving}>
          <RotateCcw className="h-3.5 w-3.5" />
          إعادة تعيين للوضع الافتراضي
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings} disabled={saving}>
            إلغاء التعديلات
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveSettings} disabled={saving}>
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                حفظ كافة الإعدادات الحالية
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
