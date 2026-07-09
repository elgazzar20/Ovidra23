import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Plus, Search, ShieldAlert, ShieldCheck, RefreshCw,
  Smartphone, HelpCircle, Download, Calendar, Copy, Check,
  X, ArrowLeft, Laptop, Server, Ban
} from "lucide-react";
import {
  fetchLicenses,
  createLicense,
  updateLicenseStatus,
  resetLicenseActivations,
  activateLicenseDevice,
  deactivateLicenseDevice,
  type PlatformLicense,
  type CenterRecord
} from "../../lib/superadmin";
import { cn } from "../../utils/cn";
import { pushToast } from "../../components/ui";
import { generateLicenseKey } from "../../lib/license";

interface LicensesTabProps {
  admin: { uid: string; email: string };
  centers: CenterRecord[];
}

export function LicensesTab({ admin, centers }: LicensesTabProps) {
  const [licenses, setLicenses] = useState<PlatformLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Selected License Inspector View
  const [selectedLicense, setSelectedLicense] = useState<PlatformLicense | null>(null);

  // Simulation Form States (Admin can activate/deactivate a device on-the-fly to test)
  const [simDeviceId, setSimDeviceId] = useState("");
  const [simDeviceName, setSimDeviceName] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  // Create License Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [customCenterName, setCustomCenterName] = useState("");
  const [centerSearchCreate, setCenterSearchCreate] = useState("");
  const [licenseType, setLicenseType] = useState<"pro" | "enterprise">("pro");
  const [licensePurpose, setLicensePurpose] = useState<"activation" | "trial" | "discount">("activation");
  const [discountValue, setDiscountValue] = useState("");
  const [deviceLimit, setDeviceLimit] = useState(3);
  const [expirationPreset, setExpirationPreset] = useState<"30" | "90" | "365" | "custom">("365");
  const [customExpirationDate, setCustomExpirationDate] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    loadLicensesList();
  }, []);

  const loadLicensesList = async () => {
    setLoading(true);
    try {
      const data = await fetchLicenses();
      setLicenses(data);
      if (selectedLicense) {
        const fresh = data.find(l => l.key === selectedLicense.key);
        if (fresh) setSelectedLicense(fresh);
      }
    } catch (e) {
      console.error("[LicensesTab] Failed to load licenses:", e);
    } finally {
      setLoading(false);
    }
  };

  // Generate a cryptographically valid license key
  const handleGenerateKeySuggestion = () => {
    if (!selectedCenterId && !customCenterName.trim()) {
      pushToast("يرجى تحديد سنتر أو كتابة اسم الجهة المستفيدة أولاً", "info");
      return;
    }
    const finalCenterId = selectedCenterId || `custom_${Date.now()}`;
    
    let durationDays = 30;
    if (expirationPreset !== "custom") {
      durationDays = parseInt(expirationPreset, 10);
    } else {
      if (!customExpirationDate) {
        pushToast("يرجى تحديد تاريخ انتهاء مخصص أولاً", "info");
        return;
      }
      const diffTime = Math.abs(new Date(customExpirationDate).getTime() - Date.now());
      durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    try {
      const key = generateLicenseKey(
        finalCenterId,
        licenseType,
        durationDays,
        licensePurpose,
        licensePurpose === "discount" ? discountValue : undefined
      );
      setGeneratedKey(key);
      pushToast("تم توليد المفتاح المشفر بنجاح", "success");
    } catch (e) {
      pushToast("فشل توليد المفتاح: " + (e as Error).message, "error");
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    pushToast("تم نسخ مفتاح الترخيص للحافظة", "success");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Submit new license creation
  const handleCreateLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatedKey.trim()) {
      pushToast("يرجى توليد مفتاح ترخيص أولاً", "info");
      return;
    }

    // Determine center name
    let centerName = customCenterName;
    let finalCenterId = selectedCenterId;
    if (selectedCenterId) {
      const found = centers.find(c => c.id === selectedCenterId);
      if (found) {
        centerName = found.name;
      }
    } else if (!customCenterName.trim()) {
      pushToast("يرجى تحديد سنتر أو كتابة اسم الجهة المستفيدة", "info");
      return;
    } else {
      finalCenterId = `custom_${Date.now()}`;
    }

    // Calculate expiration timestamp
    let expiresAt = 0;
    if (expirationPreset !== "custom") {
      const days = parseInt(expirationPreset, 10);
      expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    } else {
      if (!customExpirationDate) {
        pushToast("يرجى تحديد تاريخ انتهاء مخصص", "info");
        return;
      }
      expiresAt = new Date(customExpirationDate).getTime();
    }

    setCreateLoading(true);
    try {
      await createLicense({
        key: generatedKey.trim(),
        centerId: finalCenterId,
        centerName,
        type: licenseType, // map pro/enterprise
        status: "active",
        deviceLimit,
        expiresAt
      });

      pushToast("تم إنشاء وتخزين مفتاح الترخيص بنجاح في السيرفر", "success");
      setIsCreateOpen(false);
      // Reset states
      setGeneratedKey("");
      setSelectedCenterId("");
      setCustomCenterName("");
      setLicensePurpose("activation");
      setDiscountValue("");
      setDeviceLimit(3);
      setExpirationPreset("365");
      setCustomExpirationDate("");
      loadLicensesList();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (status: PlatformLicense["status"]) => {
    if (!selectedLicense) return;
    const arabicStatus = 
      status === "active" ? "تنشيط" : 
      status === "revoked" ? "إلغاء وإبطال" : 
      status === "blacklisted" ? "إدراج بالقائمة السوداء" : "إنهاء صلاحية";

    if (!window.confirm(`هل أنت متأكد من رغبتك في ${arabicStatus} هذا الترخيص؟`)) return;

    try {
      await updateLicenseStatus(selectedLicense.key, status, admin);
      pushToast(`تم ${arabicStatus} الترخيص بنجاح`, "success");
      loadLicensesList();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Reset activations
  const handleResetActivations = async () => {
    if (!selectedLicense) return;
    if (!window.confirm("هل أنت متأكد من رغبتك في تصفير الترخيص وإلغاء تنشيط كافة الأجهزة المتصلة به دفعة واحدة؟")) return;

    try {
      await resetLicenseActivations(selectedLicense.key, admin);
      pushToast("تم إلغاء تنشيط كافة الأجهزة وتصفير العداد بنجاح", "success");
      loadLicensesList();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Simulate device activation in admin panel
  const handleSimulateActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !simDeviceId.trim() || !simDeviceName.trim()) {
      pushToast("يرجى ملء جميع حقول محاكاة الجهاز", "info");
      return;
    }

    setSimLoading(true);
    try {
      await activateLicenseDevice(selectedLicense.key, simDeviceId.trim(), simDeviceName.trim());
      pushToast("تم محاكاة تنشيط الجهاز بنجاح وإضافته للترخيص", "success");
      setSimDeviceId("");
      setSimDeviceName("");
      loadLicensesList();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSimLoading(false);
    }
  };

  // Deactivate a single device
  const handleDeactivateDevice = async (deviceId: string) => {
    if (!selectedLicense) return;
    if (!window.confirm("هل أنت متأكد من إلغاء تنشيط هذا الجهاز؟")) return;

    try {
      await deactivateLicenseDevice(selectedLicense.key, deviceId);
      pushToast("تم إلغاء تنشيط الجهاز بنجاح", "success");
      loadLicensesList();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Export licenses to JSON
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(licenses, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `licenses_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      pushToast("تم تصدير التراخيص كملف JSON بنجاح", "success");
    } catch (e) {
      console.error(e);
    }
  };

  // Export licenses to CSV
  const handleExportCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      // Headers
      csvContent += "License Key,Center ID,Center Name,Type,Status,Device Limit,Active Devices,Expiration Date,Created Date\n";
      
      licenses.forEach(l => {
        const row = [
          `"${l.key}"`,
          `"${l.centerId}"`,
          `"${l.centerName}"`,
          `"${l.type}"`,
          `"${l.status}"`,
          l.deviceLimit,
          l.deviceCount,
          `"${new Date(l.expiresAt).toISOString()}"`,
          `"${new Date(l.createdAt).toISOString()}"`
        ].join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `licenses_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      pushToast("تم تصدير التراخيص كملف CSV بنجاح", "success");
    } catch (e) {
      console.error(e);
    }
  };

  // Filtering Licenses
  const filteredLicenses = licenses.filter(l => {
    const searchStr = `${l.key} ${l.centerName} ${l.centerId}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : l.status === statusFilter;
    const matchesType = typeFilter === "all" ? true : l.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: PlatformLicense["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            نشط
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <ShieldAlert className="h-3 w-3" />
            ملغى
          </span>
        );
      case "blacklisted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-0.5 text-xs font-bold text-slate-100 dark:bg-slate-900 dark:text-slate-200">
            <ShieldAlert className="h-3 w-3" />
            قائمة سوداء
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <Calendar className="h-3 w-3" />
            منتهي
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: PlatformLicense["type"] | any) => {
    switch (type) {
      case "pro":
        return (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            خطة احترافية (Professional)
          </span>
        );
      case "enterprise":
        return (
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            خطة مؤسسية (Enterprise)
          </span>
        );
      default:
        return (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            خطة احترافية (Professional)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 dir-rtl text-right select-none">
      {selectedLicense ? (
        /* Detailed View (License Inspector Panel) */
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <button
              onClick={() => { setSelectedLicense(null); loadLicensesList(); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              العودة لكافة مفاتيح التراخيص
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleUpdateStatus("active")}
                disabled={selectedLicense.status === "active"}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                تنشيط الترخيص
              </button>

              <button
                onClick={() => handleUpdateStatus("revoked")}
                disabled={selectedLicense.status === "revoked"}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                إبطال وإلغاء (Revoke)
              </button>

              <button
                onClick={() => handleUpdateStatus("blacklisted")}
                disabled={selectedLicense.status === "blacklisted"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                <Ban className="h-3.5 w-3.5" />
                قائمة سوداء (Blacklist)
              </button>

              <button
                onClick={handleResetActivations}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                إعادة ضبط الأجهزة (Reset)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Main Col: License overview & Activation History */}
            <div className="lg:col-span-2 space-y-4">
              {/* Primary Info Card */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-brand-600">تفاصيل الترخيص الفني</span>
                      {getTypeBadge(selectedLicense.type)}
                      {getStatusBadge(selectedLicense.status)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 select-all min-w-0 w-full">
                      <Key className="h-5 w-5 text-brand-500 shrink-0" />
                      <h1 className="text-sm sm:text-base md:text-xl font-mono font-extrabold text-ink tracking-wider break-all flex-1 min-w-0">
                        {selectedLicense.key}
                      </h1>
                      <button
                        onClick={() => handleCopyKey(selectedLicense.key)}
                        className="rounded p-1 text-muted hover:bg-elevated transition cursor-pointer shrink-0"
                        title="نسخ المفتاح"
                      >
                        {copiedKey ? <Check className="h-4 w-4 text-emerald-500 animate-pulse" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted mt-2">
                      الجهة المستفيدة: <span className="font-bold text-ink">{selectedLicense.centerName}</span> (ID: {selectedLicense.centerId})
                    </p>
                  </div>

                  <div className="bg-elevated/40 rounded-2xl px-4 py-3 border border-line text-center min-w-32">
                    <p className="text-[10px] font-bold text-muted">الأجهزة النشطة</p>
                    <p className="text-xl font-black text-ink mt-1">
                      {selectedLicense.deviceCount} <span className="text-xs text-muted">/ {selectedLicense.deviceLimit}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-line/50 pt-4 text-xs">
                  <div>
                    <span className="text-muted block mb-1">تاريخ الإنشاء والولادة:</span>
                    <span className="font-semibold text-ink">
                      {new Date(selectedLicense.createdAt).toLocaleString("ar-EG")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block mb-1">تاريخ انتهاء الترخيص:</span>
                    <span className={cn(
                      "font-semibold", 
                      selectedLicense.expiresAt < Date.now() ? "text-rose-600" : "text-ink"
                    )}>
                      {new Date(selectedLicense.expiresAt).toLocaleDateString("ar-EG")} ({selectedLicense.expiresAt < Date.now() ? "منتهي" : "صالح"})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block mb-1">مستوى الأمان والاستخدام:</span>
                    <span className="font-semibold text-ink">
                      {selectedLicense.deviceCount >= selectedLicense.deviceLimit ? "🔴 مكتمل ومغلق" : "🟢 متاح للتنشيط"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Activation History Timeline */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">سجل التنشيطات التفصيلي للأجهزة (Activation History)</h3>

                {selectedLicense.activationHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted text-xs">
                    <Laptop className="mx-auto h-8 w-8 text-faint mb-2 opacity-50" />
                    لا يوجد سجل تنشيط أو أجهزة متصلة بهذا المفتاح حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="border-b border-line text-muted">
                          <th className="pb-2 font-bold">الجهاز / النظام</th>
                          <th className="pb-2 font-bold">معرف الجهاز (Device ID)</th>
                          <th className="pb-2 font-bold">تاريخ التنشيط</th>
                          <th className="pb-2 font-bold">الحالة</th>
                          <th className="pb-2 font-bold text-left">التحكم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {selectedLicense.activationHistory.map((act) => (
                          <tr key={act.id} className="hover:bg-elevated/10">
                            <td className="py-2.5 font-bold text-ink inline-flex items-center gap-1.5">
                              <Smartphone className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                              {act.deviceInfo}
                            </td>
                            <td className="py-2.5 font-mono text-faint select-text">{act.deviceId}</td>
                            <td className="py-2.5 text-muted">
                              {new Date(act.activatedAt).toLocaleString("ar-EG")}
                            </td>
                            <td className="py-2.5">
                              {act.status === "active" ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  نشط حالياً
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  ملغى النشاط {act.deactivatedAt && `(${new Date(act.deactivatedAt).toLocaleDateString("ar-EG")})`}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-left">
                              {act.status === "active" && (
                                <button
                                  onClick={() => handleDeactivateDevice(act.deviceId)}
                                  className="rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 transition cursor-pointer"
                                >
                                  إلغاء تنشيط
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Admin Simulation & Guide */}
            <div className="space-y-4">
              {/* Simulator Block */}
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-line/60 pb-2">
                  <Server className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-ink">محاكي تنشيط الأجهزة فوري</h3>
                </div>
                <p className="text-[11px] text-muted">
                  تتيح لك هذه الأداة محاكاة تفعيل هذا المفتاح من جهاز خارجي للتحقق من سلامة القيود والحدود الأمنية للرخصة.
                </p>

                <form onSubmit={handleSimulateActivation} className="space-y-3 pt-1">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-muted">اسم وجهاز المحاكاة</label>
                    <input
                      type="text"
                      value={simDeviceName}
                      onChange={(e) => setSimDeviceName(e.target.value)}
                      placeholder="مثال: Windows 11 - Chrome"
                      className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-muted">معرف الجهاز (Device ID)</label>
                    <input
                      type="text"
                      value={simDeviceId}
                      onChange={(e) => setSimDeviceId(e.target.value)}
                      placeholder="مثال: dev_pc_x92a"
                      className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={simLoading || selectedLicense.status !== "active"}
                    className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-sm hover:bg-amber-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    {simLoading ? "جاري التنشيط..." : "تنشيط الجهاز الآن"}
                  </button>
                </form>
              </div>

              {/* Troubleshooting and guide */}
              <div className="rounded-2xl border border-line bg-elevated/20 p-4 space-y-3">
                <h4 className="text-xs font-bold text-ink inline-flex items-center gap-1">
                  <HelpCircle className="h-4 w-4 text-brand-500" /> دليل معاني الحالات
                </h4>
                <ul className="text-[11px] text-muted space-y-2 list-disc list-inside">
                  <li><strong className="text-ink">إلغاء الترخيص (Revoke)</strong>: يوقف الترخيص مؤقتاً أو نهائياً مع إمكانية إعادة تفعيله لاحقاً.</li>
                  <li><strong className="text-ink">القائمة السوداء (Blacklist)</strong>: حظر نهائي وصارم يمنع استخدام المفتاح أو فك حظره إلا بإجراء يدوي.</li>
                  <li><strong className="text-ink">تصفير الترخيص (Reset)</strong>: يلغي تسجيل كافة الأجهزة المسجلة فوراً لتمكين العميل من ربط أجهزة جديدة.</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Board Overview List View */
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-black text-ink">مركز إدارة وتراخيص الأنظمة</h1>
              <p className="text-xs text-muted">
                توليد وإدارة مفاتيح ترخيص المنصة للسناتر التعليمية، التحكم بحدود الأجهزة المرتبطة، وتتبع سجل النشاط بشكل فوري.
              </p>
            </div>

            <div className="flex gap-2">
              {/* Export Buttons */}
              <div className="flex gap-1">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-muted hover:text-ink hover:bg-elevated transition cursor-pointer"
                  title="تصدير CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  تصدير CSV
                </button>
                <button
                  onClick={handleExportJSON}
                  className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-muted hover:text-ink hover:bg-elevated transition cursor-pointer"
                  title="تصدير JSON"
                >
                  <Server className="h-3.5 w-3.5 text-brand-500" />
                  JSON
                </button>
              </div>

              <button
                onClick={() => { setIsCreateOpen(true); handleGenerateKeySuggestion(); }}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-brand-700 active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                توليد رخصة جديدة
              </button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "إجمالي تراخيص المنصة", value: licenses.length, color: "border-line" },
              { label: "رخص نشطة وفعالة", value: licenses.filter(l => l.status === "active").length, color: "border-emerald-200 text-emerald-600" },
              { label: "رخص مكتملة الأجهزة", value: licenses.filter(l => l.deviceCount >= l.deviceLimit).length, color: "border-blue-200 text-blue-600" },
              { label: "تراخيص ملغية / محظورة", value: licenses.filter(l => l.status === "revoked" || l.status === "blacklisted").length, color: "border-rose-200 text-rose-600" }
            ].map((st, i) => (
              <div key={i} className={cn("rounded-2xl border bg-surface p-4 shadow-xs", st.color)}>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{st.label}</p>
                <p className="mt-1 text-xl font-extrabold">{st.value}</p>
              </div>
            ))}
          </div>

          {/* Search & Filter bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-faint" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بمفتاح الترخيص، اسم السنتر، المعرف..."
                className="h-10 w-full rounded-xl border border-line bg-surface pr-9 pl-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none font-mono"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-40">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value="all">كافة الحالات</option>
                <option value="active">نشطة</option>
                <option value="revoked">ملغاة</option>
                <option value="blacklisted">قائمة سوداء</option>
                <option value="expired">منتهية الصلاحية</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="w-full sm:w-40">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value="all">كافة الخطط</option>
                <option value="pro">احترافية (Pro)</option>
                <option value="enterprise">مؤسسية (Enterprise)</option>
              </select>
            </div>
          </div>

          {/* Licenses List Grid */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600" />
              </div>
            ) : filteredLicenses.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface py-16 text-center text-muted">
                <Key className="mx-auto h-10 w-10 text-faint opacity-50 mb-2" />
                <p className="text-sm">لم يتم العثور على أي تراخيص فنية تطابق شروط البحث.</p>
              </div>
            ) : (
              filteredLicenses.map((lic) => (
                <motion.div
                  key={lic.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedLicense(lic)}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-sm hover:bg-elevated/30 transition cursor-pointer flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] sm:text-xs font-bold text-brand-600 tracking-wider break-all">
                        {lic.key}
                      </span>
                      {getTypeBadge(lic.type)}
                      {getStatusBadge(lic.status)}
                    </div>

                    <h3 className="font-bold text-ink text-sm sm:text-base">
                      سنتر: {lic.centerName}
                    </h3>

                    <div className="flex items-center gap-4 text-[10px] text-faint">
                      <span>الحد الأقصى للأجهزة: <strong className="text-ink">{lic.deviceLimit} أجهزة</strong></span>
                      <span>تاريخ الانتهاء: <strong className="text-ink">{new Date(lic.expiresAt).toLocaleDateString("ar-EG")}</strong></span>
                    </div>
                  </div>

                  {/* Device Count Progress Meter */}
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-muted block">الأجهزة النشطة</span>
                      <strong className="text-xs text-ink block font-mono">
                        {lic.deviceCount} / {lic.deviceLimit}
                      </strong>
                    </div>

                    {/* Simple progress pill bar */}
                    <div className="h-1.5 w-24 bg-line rounded-full overflow-hidden shrink-0">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          lic.deviceCount >= lic.deviceLimit ? "bg-rose-500" : lic.deviceCount > 0 ? "bg-brand-500" : "bg-faint"
                        )}
                        style={{ width: `${Math.min(100, (lic.deviceCount / lic.deviceLimit) * 100)}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Generate License Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line bg-elevated/40 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-brand-600" />
                  <h3 className="font-bold text-ink">توليد وإصدار مفتاح ترخيص جديد</h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateLicenseSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Key Generator Field */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">مفتاح الترخيص المولد</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={generatedKey}
                      onChange={(e) => setGeneratedKey(e.target.value)}
                      placeholder="CPD-XXXX-XXXX-XXXX-XXXX"
                      className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand-400 focus:outline-none font-mono tracking-widest text-center"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleGenerateKeySuggestion}
                      className="rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 text-xs font-bold hover:opacity-90 transition cursor-pointer"
                    >
                      توليد مفتاح عشوائي
                    </button>
                  </div>
                </div>

                {/* Center Selector */}
                <div className="bg-elevated/20 p-3 rounded-xl border border-line space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-muted">البحث عن جهة أو سنتر مسجل</label>
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو البريد..."
                      value={centerSearchCreate}
                      onChange={(e) => setCenterSearchCreate(e.target.value)}
                      className="h-9 w-full mb-2 rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                    />
                    <select
                      value={selectedCenterId}
                      onChange={(e) => {
                        setSelectedCenterId(e.target.value);
                        if (e.target.value) setCustomCenterName("");
                      }}
                      className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                    >
                      <option value="">-- اختر من السناتر --</option>
                      {centers
                        .filter(c => 
                          !centerSearchCreate || 
                          c.name?.toLowerCase().includes(centerSearchCreate.toLowerCase()) || 
                          c.ownerEmail?.toLowerCase().includes(centerSearchCreate.toLowerCase())
                        )
                        .map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.ownerEmail})</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-line"></div>
                    <span className="flex-shrink-0 mx-4 text-[10px] text-muted font-bold">أو إن لم تكن مسجلة</span>
                    <div className="flex-grow border-t border-line"></div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-muted">اسم الجهة (يدوي)</label>
                    <input
                      type="text"
                      value={customCenterName}
                      onChange={(e) => {
                        setCustomCenterName(e.target.value);
                        if (e.target.value) setSelectedCenterId("");
                      }}
                      placeholder="مثال: مدرسة المستقبل الخاصة"
                      className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                      disabled={!!selectedCenterId}
                    />
                  </div>
                </div>

                {/* Purpose, Target Plan, and Device Limits */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-muted">الغرض من المفتاح</label>
                      <select
                        value={licensePurpose}
                        onChange={(e) => setLicensePurpose(e.target.value as any)}
                        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                      >
                        <option value="activation">تنشيط خطة كاملة (Full Activation)</option>
                        <option value="trial">فتح فترة تجريبية (Free Trial)</option>
                        <option value="discount">تطبيق كود خصم (Discount Code)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-muted">الخطة المستهدفة</label>
                      <select
                        value={licenseType}
                        onChange={(e) => setLicenseType(e.target.value as any)}
                        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                      >
                        <option value="pro">احترافية (Professional Plan)</option>
                        <option value="enterprise">مؤسسية (Enterprise Plan)</option>
                      </select>
                    </div>
                  </div>

                  {licensePurpose === "discount" && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-dashed border-amber-300 bg-amber-500/5 p-3"
                    >
                      <label className="mb-1.5 block text-xs font-bold text-amber-800 dark:text-amber-400">قيمة / نسبة الخصم</label>
                      <input
                        type="text"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="مثال: 50% أو 100$"
                        className="h-10 w-full rounded-xl border border-amber-300 bg-surface px-3 text-xs text-ink focus:border-amber-500 focus:outline-none"
                        required
                      />
                      <p className="mt-1 text-[10px] text-amber-700/80">سيتم تطبيق هذه القيمة مباشرة على الفواتير أو شاشة الدفع للسنتر.</p>
                    </motion.div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-muted">الحد الأقصى للأجهزة المتزامنة</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={deviceLimit}
                      onChange={(e) => setDeviceLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Expiration presets */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">مدة صلاحية الترخيص</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "شهر واحد", value: "30" },
                      { label: "3 أشهر", value: "90" },
                      { label: "سنة كاملة", value: "365" },
                      { label: "تاريخ مخصص", value: "custom" }
                    ].map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setExpirationPreset(p.value as any)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold border transition",
                          expirationPreset === p.value
                            ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                            : "border-line bg-surface text-muted hover:bg-elevated/40"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {expirationPreset === "custom" && (
                    <div className="mt-3">
                      <label className="mb-1 block text-[10px] text-muted font-bold">اختر تاريخ انتهاء الصلاحية المخصص</label>
                      <input
                        type="date"
                        value={customExpirationDate}
                        onChange={(e) => setCustomExpirationDate(e.target.value)}
                        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-line bg-elevated/40 -mx-5 -mb-5 px-5 py-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-muted hover:bg-elevated transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {createLoading ? "جاري الحفظ..." : "إصدار وتخزين الترخيص"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
