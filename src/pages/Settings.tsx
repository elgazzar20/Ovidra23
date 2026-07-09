import { useState, useEffect, useRef } from "react";
import {
  Building2, Palette, Save, RotateCcw,
  Shield, Sun, Moon, Check, Archive, Download, Upload,
  GraduationCap, AlertTriangle, Crown, Key, Smartphone
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { CURRENCIES } from "../lib/constants";
import {
  PageHeader, Button, Card, Input, Select, Field, Badge, Modal, pushToast, Toggle,
} from "../components/ui";
import { cn } from "../utils/cn";
import {
  fetchLicenses,
  activateLicenseDevice,
  deactivateLicenseDevice,
  type PlatformLicense
} from "../lib/superadmin";

export function Settings() {
  const {
    db, t, user, lang, updateProfile,
    setLang, theme, toggleTheme, fontScale, setFontScale, can,
    backups, createBackup, restoreFromBackup, removeBackup, exportBackup, restoreBackupFromFile, promoteYear,
    subscriptionPlan,
  } = useApp();
  const [name, setName] = useState(db.profile.name);
  const [currency, setCurrency] = useState(db.profile.currency);
  const [logo, setLogo] = useState(db.profile.logoText ?? "");
  const [geminiKey, setGeminiKey] = useState(db.profile.geminiApiKey ?? "");
  const [saved, setSaved] = useState(false);

  // year promotion
  const [yearOpen, setYearOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // License Management Center States
  const [license, setLicense] = useState<PlatformLicense | null>(null);
  const [loadingLic, setLoadingLic] = useState(false);
  const [licKeyInput, setLicKeyInput] = useState("");
  const [licDeviceName, setLicDeviceName] = useState("جهاز الإدارة الرئيسي");

  const loadLic = async () => {
    setLoadingLic(true);
    try {
      const licensesList = await fetchLicenses();
      const found = licensesList.find(
        (l) => l.centerName === db.profile.name
      );
      setLicense(found || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLic(false);
    }
  };

  useEffect(() => {
    loadLic();
  }, [db.profile.name]);

  const handleActivateLicense = async () => {
    if (!licKeyInput.trim()) return;
    try {
      const deviceId = `dev_${Math.random().toString(36).slice(2, 8)}`;
      await activateLicenseDevice(licKeyInput.trim(), deviceId, licDeviceName.trim() || "جهاز افتراضي");
      pushToast(lang === "ar" ? "تم تفعيل الترخيص وربط الجهاز بنجاح!" : "License activated successfully!", "success");
      setLicKeyInput("");
      loadLic();
    } catch (e) {
      pushToast((e as Error).message, "error");
    }
  };

  const handleDeactivateDevice = async (deviceId: string) => {
    if (!license) return;
    try {
      await deactivateLicenseDevice(license.key, deviceId);
      pushToast(lang === "ar" ? "تم إلغاء تنشيط الجهاز بنجاح" : "Device deactivated successfully", "success");
      loadLic();
    } catch (e) {
      pushToast((e as Error).message, "error");
    }
  };

  const saveProfile = () => {
    updateProfile({
      name,
      currency,
      logoText: logo.slice(0, 2).toUpperCase() || "C",
      geminiApiKey: geminiKey.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startPromote = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCountdown(10);
    setYearOpen(true);
    const tick = (n: number) => {
      if (n <= 0) {
        const { promoted, skipped } = promoteYear();
        setYearOpen(false);
        pushToast(t("year.promoted", { p: promoted, s: skipped }));
        return;
      }
      setCountdown(n);
      timerRef.current = setTimeout(() => tick(n - 1), 1000);
    };
    createBackup(t("backup.auto"));
    timerRef.current = setTimeout(() => tick(10), 100);
  };

  const cancelPromote = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setYearOpen(false);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("settings.title")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* profile */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("settings.profile")}</h3>
          </div>
          <div className="space-y-3">
            <Field label={t("settings.centerName")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("settings.currency")}>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{lang === "ar" ? c.ar : c.en} ({c.symbol})</option>)}
                </Select>
              </Field>
              <Field label="Logo"><Input value={logo} maxLength={2} onChange={(e) => setLogo(e.target.value)} /></Field>
            </div>
            <Field label={lang === "ar" ? "مفتاح Gemini API (للذكاء الاصطناعي)" : "Gemini API Key (for AI)"}>
              <Input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
            </Field>
            <Button onClick={saveProfile} variant={saved ? "subtle" : "primary"}>
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? t("settings.saved") : t("action.save")}
            </Button>
          </div>
        </Card>

        {/* appearance */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-600" />
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("settings.appearance")}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">{t("settings.language")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["en", "ar"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition", lang === l ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">{t("settings.theme")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => theme !== "light" && toggleTheme()} className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", theme === "light" ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  <Sun className="h-4 w-4" /> {t("settings.light")}
                </button>
                <button onClick={() => theme !== "dark" && toggleTheme()} className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", theme === "dark" ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  <Moon className="h-4 w-4" /> {t("settings.dark")}
                </button>
              </div>
            </div>
            {/* font size */}
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t("settings.fontSize")}</p>
              <p className="mb-2 text-[10px] text-faint">{t("settings.fontSizeHint")}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "small" as const, label: t("settings.fontSizeSmall"), size: "text-xs" },
                  { v: "medium" as const, label: t("settings.fontSizeMedium"), size: "text-sm" },
                  { v: "large" as const, label: t("settings.fontSizeLarge"), size: "text-base" },
                ]).map((opt) => (
                  <button key={opt.v} onClick={() => setFontScale(opt.v)}
                    className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition", fontScale === opt.v ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15" : "border-line text-muted hover:bg-elevated")}>
                    <span className={cn("font-semibold", opt.size)}>Aa</span>
                    <span className="text-[10px]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-2 rounded-lg bg-elevated/60 px-3 py-2 text-xs">
                <Shield className="h-4 w-4 text-brand-600" />
                <span className="text-muted">{t("settings.role")}:</span>
                <Badge tone="brand">{t(`role.${user.role}`)}</Badge>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Subscription / Upgrade */}
      <Card className="relative overflow-hidden border-brand-200/60 p-5 dark:border-brand-500/20">
        <div className="mesh-brand pointer-events-none absolute inset-0 opacity-[0.03]" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{lang === "ar" ? "الاشتراك" : "Subscription"}</h3>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-elevated/60 px-4 py-3">
            <div>
              <p className="text-xs text-muted">{lang === "ar" ? "خطتك الحالية" : "Current Plan"}</p>
              <p className="text-lg font-bold text-ink">
                {subscriptionPlan === "pro" 
                  ? (lang === "ar" ? "الخطة الاحترافية" : "Professional Plan") 
                  : subscriptionPlan === "enterprise" 
                    ? (lang === "ar" ? "الخطة المؤسسية" : "Enterprise Plan") 
                    : (lang === "ar" ? "الخطة المجانية" : "Free Plan")}
              </p>
            </div>
            <div className="text-end">
              <p className="text-[11px] text-muted">{lang === "ar" ? "الحد الأقصى" : "Limits"}</p>
              <p className="text-xs font-bold text-ink">
                {subscriptionPlan === "enterprise"
                  ? (lang === "ar" ? "طلاب ومعلمين غير محدود" : "Unlimited students & teachers")
                  : subscriptionPlan === "pro"
                    ? (lang === "ar" ? "500 طالب · 30 معلم" : "500 students · 30 teachers")
                    : (lang === "ar" ? "30 طالب · 2 معلم" : "30 students · 2 teachers")}
              </p>
            </div>
          </div>
          <Button
            className="mt-3 w-full bg-gradient-to-br from-brand-500 to-brand-700"
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "upgrade" }))}
          >
            <Crown className="h-4 w-4" />
            {lang === "ar" ? "ترقية الآن" : "Upgrade Now"}
          </Button>
        </div>
      </Card>



      {/* backup & restore */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-500" />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("backup.title")}</h3>
              <p className="text-xs text-muted">{t("backup.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => { createBackup("manual"); pushToast(t("toast.backup")); }}><Archive className="h-4 w-4" />{t("backup.create")}</Button>
            <Button size="sm" variant="secondary" onClick={exportBackup}><Download className="h-4 w-4" />{t("backup.export")}</Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 text-xs font-medium text-ink transition hover:bg-line">
              <Upload className="h-4 w-4" />{t("backup.import")}
              <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const ok = await restoreBackupFromFile(file);
                pushToast(ok ? t("toast.restored") : t("backup.invalid"), ok ? "success" : "error");
                e.target.value = "";
              }} />
            </label>
          </div>
        </div>
        {backups.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t("backup.empty")}</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b.ts} className="flex items-center gap-2 rounded-lg border border-line p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15"><Archive className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink">{b.label}</p>
                  <p className="text-[10px] text-faint">{new Date(b.ts).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="subtle" onClick={() => { restoreFromBackup(b.ts); pushToast(t("toast.restored")); }}><Upload className="h-3.5 w-3.5" />{t("backup.restore")}</Button>
                <Button size="sm" variant="ghost" onClick={() => removeBackup(b.ts)}><RotateCcw className="h-3.5 w-3.5 text-rose-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* End of Academic Year */}
      {can("settings.manage") && (
        <Card className="p-5 border-rose-200/60 dark:border-rose-500/20">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-rose-500" />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                {lang === "ar" ? "حالة العام الدراسي" : "Academic Year Status"}
              </h3>
              <p className="text-xs text-muted">
                {lang === "ar" ? "إيقاف أو تفعيل السنة الدراسية الحالية" : "Deactivate or activate the current school year"}
              </p>
            </div>
          </div>
          <p className="mb-4 rounded-lg bg-rose-50/50 px-3 py-2 text-[11px] leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {lang === "ar"
              ? "عند إنهاء العام الدراسي، سيتم إيقاف تسجيل الحضور والغياب للطلاب وحساباتهما تلقائيًا. ومع ذلك، ستتمكن كالعادة من إضافة الطلاب والمعلمين والمصروفات وغير ذلك."
              : "When ending the academic year, attendance taking and its calculation will be suspended. However, you can still add students, teachers, expenses, etc. normally."}
          </p>
          <div className="flex items-center justify-between border-t border-line/50 pt-3">
            <span className="text-xs font-semibold text-ink">
              {lang === "ar" ? "إعلان انتهاء العام الدراسي" : "Declare End of Academic Year"}
            </span>
            <Toggle
              checked={!!db.profile.academicYearEnded}
              onChange={(val) => {
                updateProfile({ academicYearEnded: val });
                pushToast(
                  lang === "ar"
                    ? (val ? "تم إنهاء العام الدراسي وتجميد الحضور" : "تم تنشيط العام الدراسي")
                    : (val ? "Academic year ended and attendance suspended" : "Academic year activated")
                );
              }}
            />
          </div>
        </Card>
      )}

      {/* academic year promotion */}
      {can("settings.manage") && (
        <Card className="border-amber-200/60 p-5 dark:border-amber-500/20">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-amber-600" />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("year.title")}</h3>
              <p className="text-xs text-muted">{t("year.subtitle")}</p>
            </div>
          </div>
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {t("year.warning")}
          </p>
          <Button variant="danger" onClick={startPromote}><GraduationCap className="h-4 w-4" />{t("year.promote")}</Button>
        </Card>
      )}

      {/* year promotion confirmation with countdown */}
      <Modal open={yearOpen} onClose={cancelPromote} title={t("year.promote")} size="sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm text-ink">{t("year.warning")}</p>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-rose-600 text-2xl font-bold text-white">
            {countdown}
          </div>
          <p className="text-xs font-medium text-muted">{t("year.countdown", { n: countdown })}</p>
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={cancelPromote}>{t("year.cancel")}</Button>
          </div>
        </div>
      </Modal>

      {/* License Management Center Section */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-brand-600" />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                {lang === "ar" ? "مركز التراخيص والأجهزة" : "License & Device Center"}
              </h3>
              <p className="text-xs text-muted">
                {lang === "ar" ? "إدارة وتنشيط رخصة المنصة والأجهزة المرتبطة بها" : "Manage active platform license and devices"}
              </p>
            </div>
          </div>
          {license && (
            <Badge tone={license.status === "active" ? "success" : "danger"}>
              {license.status === "active" ? (lang === "ar" ? "نشط ومفعل" : "Active") : (lang === "ar" ? "غير نشط" : "Inactive")}
            </Badge>
          )}
        </div>

        {loadingLic ? (
          <div className="flex justify-center py-6">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600" />
          </div>
        ) : license ? (
          /* Active License Info */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-elevated/40 p-4 border border-line">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted uppercase block">مفتاح الترخيص الخاص بك</span>
                <span className="font-mono text-sm font-extrabold text-ink tracking-wider block select-all">{license.key}</span>
              </div>
              <div className="space-y-1 sm:text-left">
                <span className="text-[10px] font-bold text-muted uppercase block">عدد الأجهزة المرتبطة</span>
                <span className="text-sm font-extrabold text-ink block">{license.deviceCount} / {license.deviceLimit} أجهزة</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted uppercase block">نوع الاشتراك</span>
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-300 block uppercase">{license.type}</span>
              </div>
              <div className="space-y-1 sm:text-left">
                <span className="text-[10px] font-bold text-muted uppercase block">تاريخ انتهاء الصلاحية</span>
                <span className="text-xs font-semibold text-ink block">{new Date(license.expiresAt).toLocaleDateString("ar-EG")}</span>
              </div>
            </div>

            {/* List of active devices */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-ink">الأجهزة المصرح لها حالياً ({license.deviceCount})</h4>
              {license.activationHistory.filter((entry: any) => entry.status === "active").length === 0 ? (
                <p className="text-xs text-muted py-2 text-center">لا توجد أجهزة نشطة مرتبطة بهذا المفتاح.</p>
              ) : (
                <div className="divide-y divide-line/40 rounded-xl border border-line bg-surface overflow-hidden">
                  {license.activationHistory
                    .filter((entry: any) => entry.status === "active")
                    .map((act: any) => (
                      <div key={act.id} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-brand-500" />
                          <div>
                            <span className="font-semibold text-ink block">{act.deviceInfo}</span>
                            <span className="text-[9px] text-faint font-mono block select-all">{act.deviceId}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted">{new Date(act.activatedAt).toLocaleDateString("ar-EG")}</span>
                          <button
                            onClick={() => handleDeactivateDevice(act.deviceId)}
                            className="rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2 py-1 text-[10px] transition cursor-pointer"
                          >
                            {lang === "ar" ? "إلغاء ربط" : "Unlink"}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Activate form if no license is active */
          <div className="space-y-4">
            <p className="text-xs text-muted leading-relaxed">
              {lang === "ar"
                ? "لا يوجد ترخيص فني نشط مرتبط بهذا السنتر حالياً. لتفعيل السنتر وربط الأجهزة، يرجى كتابة مفتاح الترخيص المستلم من الإدارة أدناه."
                : "No active platform license is currently linked to this center. Enter your license key to activate your devices."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Field label={lang === "ar" ? "اسم الجهاز" : "Device Name"}>
                <Input
                  value={licDeviceName}
                  onChange={(e) => setLicDeviceName(e.target.value)}
                  placeholder="مثال: جهاز الإدارة الرئيسي"
                />
              </Field>
              <Field label={lang === "ar" ? "مفتاح الترخيص" : "License Key"}>
                <Input
                  value={licKeyInput}
                  onChange={(e) => setLicKeyInput(e.target.value)}
                  placeholder="CPD-XXXX-XXXX-XXXX-XXXX"
                  className="font-mono text-center tracking-wider"
                />
              </Field>
            </div>

            <Button onClick={handleActivateLicense} className="w-full">
              <Key className="h-4 w-4" />
              {lang === "ar" ? "تنشيط وربط السنتر الآن" : "Activate & Link Center"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
