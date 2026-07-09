import { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  X,
  Trash2,
  Laptop,
  Tablet,
  Smartphone,
  Globe,
  Activity,
  Eye,
  Lock,
  User,
  Crown,
  ArrowRightLeft,
  EyeOff,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AuditLog } from "../../lib/superadmin";

export function getActionArabic(action: string): { title: string; desc: string } {
  const act = (action || "").toLowerCase();
  
  if (act === "staff:created") {
    return { title: "إضافة موظف", desc: "تم إنشاء حساب موظف جديد بالمنصة وتعيين الصلاحيات له" };
  }
  if (act === "staff:assigned") {
    return { title: "تغيير الصلاحيات", desc: "تمت إعادة تعيين الدور والصلاحيات لموظف مسجل" };
  }
  if (act === "staff:activated") {
    return { title: "تنشيط موظف", desc: "تم إلغاء التجميد وتنشيط حساب الموظف للوصول للمنصة" };
  }
  if (act === "staff:suspended") {
    return { title: "تجميد موظف", desc: "تم تجميد حساب الموظف لتعليق وصوله مؤقتاً" };
  }
  if (act === "staff:deleted") {
    return { title: "حذف موظف", desc: "تم حذف حساب الموظف نهائياً من سجلات الإدارة" };
  }
  if (act === "role:created") {
    return { title: "إنشاء صلاحية", desc: "تم تصميم دور مخصص جديد وتحديد ميزاته وصلاحياته" };
  }
  if (act === "role:deleted") {
    return { title: "حذف صلاحية", desc: "تم إلغاء صلاحية مخصصة وتحويل موظفيها للـ Support" };
  }
  if (act === "subscription:activated") {
    return { title: "تنشيط باقة", desc: "تم تنشيط اشتراك سنتر متكامل مع إصدار الفاتورة والإيصال المالي" };
  }
  if (act === "subscription:extended") {
    return { title: "مد التجربة المجانية", desc: "تم مد فترة التجربة المجانية لسنتر كخدمة إضافية" };
  }
  if (act === "subscription:discount") {
    return { title: "خصم يدوي خاص", desc: "تم تسجيل خصم مالي يدوي يظهر للسنتر في خطته الاشتراكية" };
  }
  if (act === "subscription:compensation") {
    return { title: "أيام تعويضية", desc: "تم منح السنتر أيام تعويض إضافية تضاف لصلاحية باقته الحالية" };
  }
  if (act === "settings:updated") {
    return { title: "تعديل إعدادات النظام", desc: "تحديث الإعدادات العامة أو إيقاف التسجيلات الجديدة مؤقتاً" };
  }
  if (act === "auth:login" || act === "login") {
    return { title: "تسجيل الدخول", desc: "تسجيل دخول ناجح لحساب المشرف إلى لوحة التحكم الرئيسية" };
  }
  if (act === "auth:logout" || act === "logout") {
    return { title: "تسجيل الخروج", desc: "تسجيل خروج آمن لحساب المشرف لإنهاء الجلسة الفعالة" };
  }

  // Generics
  if (act.includes("create") || act.includes("add")) {
    return { title: "إضافة سجل جديد", desc: `تمت إضافة أو إنشاء عنصر جديد بالمنصة: ${action}` };
  }
  if (act.includes("update") || act.includes("edit") || act.includes("patch")) {
    return { title: "تعديل وتحديث", desc: `تم تعديل بيانات السجل بنجاح: ${action}` };
  }
  if (act.includes("delete") || act.includes("remove")) {
    return { title: "حذف نهائي", desc: `تم حذف السجل وإلغاؤه من قاعدة البيانات: ${action}` };
  }
  if (act.includes("ticket") || act.includes("support")) {
    return { title: "الدعم والتذاكر", desc: `إجراء يتعلق بتذاكر الدعم الفني أو تحديثها: ${action}` };
  }

  return { title: action, desc: "تعديل فني وإجراء تنظيمي بقاعدة البيانات" };
}

interface AuditLogCenterProps {
  logs: AuditLog[];
  onRefresh: () => Promise<void>;
}

export function AuditLogCenter({ logs, onRefresh }: AuditLogCenterProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  // Categories helper
  const getCategory = (action: string, targetType: string): string => {
    const act = action.toLowerCase();
    const targ = targetType.toLowerCase();

    if (act.includes("login") || act.includes("logout") || act.includes("signup") || targ === "auth") {
      return "auth";
    }
    if (act.includes("subscription") || act.includes("plan") || act.includes("license") || targ === "subscription") {
      return "subscription";
    }
    if (act.includes("payment") || act.includes("expense") || act.includes("safe") || targ === "payment") {
      return "payment";
    }
    if (act.includes("settings") || act.includes("profile") || act.includes("config") || targ === "settings") {
      return "settings";
    }
    if (act.includes("limit") || act.includes("feature") || targ === "feature") {
      return "feature";
    }
    if (act.includes("delete")) {
      return "delete";
    }
    if (act.includes("create")) {
      return "create";
    }
    if (act.includes("update") || act.includes("edit")) {
      return "edit";
    }
    return "other";
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        log.adminEmail?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.targetName?.toLowerCase().includes(q) ||
        log.targetId?.toLowerCase().includes(q) ||
        log.ipAddress?.toLowerCase().includes(q) ||
        log.browser?.toLowerCase().includes(q) ||
        log.device?.toLowerCase().includes(q);

      // Category filter
      const category = getCategory(log.action || "", log.targetType || "");
      const matchCategory = categoryFilter === "all" || category === categoryFilter;

      // Role filter
      const role = log.userRole?.toLowerCase() || "";
      const matchRole =
        roleFilter === "all" ||
        (roleFilter === "super_admin" && role.includes("admin")) ||
        (roleFilter === "owner" && role.includes("owner")) ||
        (roleFilter === "secretary" && role.includes("secretary")) ||
        (roleFilter === "teacher" && role.includes("teacher")) ||
        (roleFilter === "student" && role.includes("student")) ||
        (roleFilter === "parent" && role.includes("parent")) ||
        (roleFilter === "anonymous" && (role === "" || role === "anonymous"));

      // Action Type filter (create, update, delete)
      const act = log.action?.toLowerCase() || "";
      let matchActionType = true;
      if (actionTypeFilter === "create") matchActionType = act.includes("create");
      else if (actionTypeFilter === "edit") matchActionType = act.includes("update") || act.includes("edit") || act.includes("patch");
      else if (actionTypeFilter === "delete") matchActionType = act.includes("delete") || act.includes("remove") || act.includes("clear") || act.includes("suspend");

      // Date filter
      let matchDate = true;
      const logTime = log.timestamp || Date.now();
      const now = Date.now();

      if (dateFilter === "today") {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        matchDate = logTime >= todayStart;
      } else if (dateFilter === "7days") {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        matchDate = logTime >= sevenDaysAgo;
      } else if (dateFilter === "30days") {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        matchDate = logTime >= thirtyDaysAgo;
      } else if (dateFilter === "custom" && startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Date.now();
        matchDate = logTime >= start && logTime <= end;
      }

      return matchSearch && matchCategory && matchRole && matchActionType && matchDate;
    });
  }, [logs, searchQuery, categoryFilter, roleFilter, actionTypeFilter, dateFilter, startDate, endDate]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const logins = filteredLogs.filter(l => l.action?.toLowerCase().includes("login")).length;
    const subscriptions = filteredLogs.filter(l => {
      const cat = getCategory(l.action || "", l.targetType || "");
      return cat === "subscription";
    }).length;
    const deletes = filteredLogs.filter(l => l.action?.toLowerCase().includes("delete")).length;

    return { total, logins, subscriptions, deletes };
  }, [filteredLogs]);

  // JSON Diff Extractor Helper
  const renderValueDiff = (prevStr?: string, newStr?: string) => {
    if (!prevStr && !newStr) return <p className="text-xs text-muted">لا توجد قيم معروضة</p>;

    let prevObj: any = null;
    let newObj: any = null;

    try {
      if (prevStr) prevObj = JSON.parse(prevStr);
    } catch {
      prevObj = prevStr;
    }

    try {
      if (newStr) newObj = JSON.parse(newStr);
    } catch {
      newObj = newStr;
    }

    // If they are just simple strings, display them directly
    if (typeof prevObj !== "object" && typeof newObj !== "object") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-rose-500/10 bg-rose-50/5 p-4 dark:bg-rose-500/5">
            <span className="text-[10px] font-bold text-rose-500 uppercase">القيمة السابقة</span>
            <p className="mt-1 text-sm font-semibold text-rose-600 dark:text-rose-400 break-words">{String(prevObj || "فارغ")}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-50/5 p-4 dark:bg-emerald-500/5">
            <span className="text-[10px] font-bold text-emerald-500 uppercase">القيمة الجديدة</span>
            <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 break-words">{String(newObj || "فارغ")}</p>
          </div>
        </div>
      );
    }

    // Form flat comparison if they are objects
    const keys = Array.from(
      new Set([
        ...Object.keys(prevObj || {}),
        ...Object.keys(newObj || {})
      ])
    ).filter(k => k !== "lastUpdated" && k !== "timestamp" && k !== "id");

    if (keys.length === 0) {
      return (
        <div className="rounded-xl border border-line bg-surface p-4 text-center">
          <p className="text-xs text-muted">البيانات متطابقة أو لا تحتوي على تفاصيل قابلة للمقارنة.</p>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface text-right" dir="rtl">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line bg-elevated/40 text-muted font-bold">
              <th className="px-4 py-2 text-right font-semibold">الحقل</th>
              <th className="px-4 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">القيمة السابقة</th>
              <th className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">القيمة الجديدة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {keys.map((key) => {
              const val1 = prevObj ? prevObj[key] : undefined;
              const val2 = newObj ? newObj[key] : undefined;
              const isChanged = JSON.stringify(val1) !== JSON.stringify(val2);

              const formatVal = (v: any) => {
                if (v === undefined || v === null) return <span className="text-faint italic">فارغ</span>;
                if (typeof v === "object") return <code className="text-[10px] text-muted font-mono">{JSON.stringify(v)}</code>;
                if (typeof v === "boolean") return v ? "نعم" : "لا";
                return String(v);
              };

              return (
                <tr
                  key={key}
                  className={isChanged ? "bg-amber-500/5 hover:bg-amber-500/10 transition" : "hover:bg-elevated/10 transition"}
                >
                  <td className="px-4 py-2.5 font-bold text-ink">{key}</td>
                  <td className="px-4 py-2.5 text-muted break-all">{formatVal(val1)}</td>
                  <td className="px-4 py-2.5 text-muted break-all font-semibold">{formatVal(val2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Export functions
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["ID", "User Email", "User Role", "Action", "Target Type", "Target Name/ID", "IP Address", "Browser", "Device", "Date", "Time", "Previous Value", "New Value"];
    const rows = filteredLogs.map((log) => {
      const date = new Date(log.timestamp);
      return [
        log.id,
        log.adminEmail || "anonymous",
        log.userRole || "unknown",
        log.action,
        log.targetType,
        log.targetName || log.targetId || "",
        log.ipAddress || "",
        log.browser || "",
        log.device || "",
        date.toLocaleDateString("en-US"),
        date.toLocaleTimeString("en-US"),
        log.previousValue ? log.previousValue.replace(/"/g, '""') : "",
        log.newValue ? log.newValue.replace(/"/g, '""') : ""
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Style helper for actions
  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("delete") || act.includes("remove") || act.includes("suspend") || act.includes("disable")) {
      return "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200/20";
    }
    if (act.includes("create") || act.includes("add") || act.includes("signup")) {
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200/20";
    }
    if (act.includes("update") || act.includes("edit") || act.includes("profile") || act.includes("settings")) {
      return "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200/20";
    }
    if (act.includes("login") || act.includes("logout")) {
      return "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400 border border-purple-200/20";
    }
    return "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400 border border-sky-200/20";
  };

  // Category labels (Arabic)
  const categoryLabels: Record<string, string> = {
    all: "كل التصنيفات",
    auth: "أمن وتسجيل دخول",
    subscription: "الاشتراكات والترخيص",
    payment: "المدفوعات والمصروفات",
    settings: "إعدادات المنصة",
    feature: "الميزات والصلاحيات",
    create: "إنشاء سجلات",
    edit: "تعديل سجلات",
    delete: "حذف سجلات",
    other: "أخرى"
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner with Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm relative overflow-hidden">
          <div className="absolute left-4 top-4 rounded-xl bg-brand-500/10 p-2.5 text-brand-500">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-bold text-muted uppercase tracking-wider">إجمالي السجلات المفلترة</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{stats.total}</p>
          <p className="mt-1 text-xs text-muted">من أصل {logs.length} سجل متاح</p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-50/5 p-5 shadow-sm relative overflow-hidden">
          <div className="absolute left-4 top-4 rounded-xl bg-purple-500/10 p-2.5 text-purple-500">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">عمليات تسجيل الدخول</p>
          <p className="mt-2 text-3xl font-extrabold text-purple-600 dark:text-purple-400">{stats.logins}</p>
          <p className="mt-1 text-xs text-muted">محاولات تسجيل دخول ناجحة</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-50/5 p-5 shadow-sm relative overflow-hidden">
          <div className="absolute left-4 top-4 rounded-xl bg-amber-500/10 p-2.5 text-amber-500">
            <Crown className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">تغييرات الاشتراكات</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600 dark:text-amber-400">{stats.subscriptions}</p>
          <p className="mt-1 text-xs text-muted">تحديث الخطط والميزات والترخيص</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-50/5 p-5 shadow-sm relative overflow-hidden">
          <div className="absolute left-4 top-4 rounded-xl bg-rose-500/10 p-2.5 text-rose-500">
            <Trash2 className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">عمليات الحذف</p>
          <p className="mt-2 text-3xl font-extrabold text-rose-600 dark:text-rose-400">{stats.deletes}</p>
          <p className="mt-1 text-xs text-muted">إجراءات حذف لضمان سلامة البيانات</p>
        </div>
      </div>

      {/* Control panel & Advanced filters */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">مصفاة السجلات المتقدمة</h2>
              <p className="text-xs text-muted">استخدم خيارات البحث والفرز للعثور على أي إجراء دقيق بالمنصة</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:bg-elevated transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                تحديث السجلات
              </button>

              <button
                onClick={handleExportCSV}
                disabled={filteredLogs.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                تصدير ملف Excel / CSV
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute right-3.5 top-3 h-4.5 w-4.5 text-muted" />
            <input
              type="text"
              placeholder="البحث بالبريد الإلكتروني، اسم الإجراء، السنتر، نوع الهدف، المعرّف، IP، أو المتصفح..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-line bg-surface pr-10 pl-4 py-2.5 text-xs text-ink outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Grid Filters */}
          <div className="grid gap-4 sm:grid-cols-4">
            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold text-muted mb-1.5">تصنيف الإجراء الرئيسي</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 outline-none"
              >
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* User Role */}
            <div>
              <label className="block text-[10px] font-bold text-muted mb-1.5">دور المستخدم الفاعل</label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 outline-none"
              >
                <option value="all">كل الأدوار</option>
                <option value="super_admin">مدير المنصة (Super Admin)</option>
                <option value="owner">مالك سنتر (Owner)</option>
                <option value="secretary">سكرتارية (Secretary)</option>
                <option value="teacher">مدرس (Teacher)</option>
                <option value="student">طالب (Student)</option>
                <option value="parent">ولي أمر (Parent)</option>
                <option value="anonymous">مجهول / غير مسجل</option>
              </select>
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-[10px] font-bold text-muted mb-1.5">نوع العملية (CRUD)</label>
              <select
                value={actionTypeFilter}
                onChange={(e) => {
                  setActionTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 outline-none"
              >
                <option value="all">كل العمليات</option>
                <option value="create">إنشاء وإضافة (Create)</option>
                <option value="edit">تحديث وتعديل (Edit)</option>
                <option value="delete">حذف وإيقاف (Delete)</option>
              </select>
            </div>

            {/* Date Range Select */}
            <div>
              <label className="block text-[10px] font-bold text-muted mb-1.5">تاريخ الإجراء</label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 outline-none"
              >
                <option value="all">كل الأوقات</option>
                <option value="today">اليوم</option>
                <option value="7days">آخر 7 أيام</option>
                <option value="30days">آخر 30 يوم</option>
                <option value="custom">نطاق مخصص...</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Pickers */}
          {dateFilter === "custom" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="grid gap-3 sm:grid-cols-2 bg-elevated/20 p-3 rounded-xl border border-line"
            >
              <div>
                <label className="block text-[10px] font-bold text-muted mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 outline-none"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Grid View / Table */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-line bg-elevated/40 text-[11px] font-bold text-muted">
                <th className="px-5 py-3 font-bold">الفاعل والدور</th>
                <th className="px-5 py-3 font-bold">الإجراء</th>
                <th className="px-5 py-3 font-bold">الهدف</th>
                <th className="px-5 py-3 font-bold">الموقع والعميل</th>
                <th className="px-5 py-3 font-bold">التاريخ والوقت</th>
                <th className="px-5 py-3 font-bold text-center">التفاصيل والـ Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <EyeOff className="mx-auto h-10 w-10 text-faint" />
                    <p className="mt-3 text-sm font-semibold text-muted">لم يتم العثور على أي سجلات مطابقة للبحث أو المصفاة.</p>
                    <p className="text-xs text-faint mt-1">تأكد من عدم وجود قيود مصفاة شديدة أو جرب كتابة كلمات أبسط.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const deviceLower = log.device?.toLowerCase() || "";
                  const isSuper = log.userRole?.toLowerCase() === "super_admin" || log.adminEmail === "mohamedelgazzar700@gmail.com" || log.adminEmail === "mohamedelgazzar748@gmail.com";

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-elevated/15 transition group"
                    >
                      {/* User Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSuper ? "bg-rose-500/10 text-rose-600" : "bg-brand-500/10 text-brand-500"}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-ink leading-tight">{log.adminEmail || "anonymous@ovidra.com"}</p>
                            <span className={`inline-flex items-center mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              isSuper ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" :
                              log.userRole === "OWNER" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
                              "bg-elevated text-muted"
                            }`}>
                              {log.userRole || "unknown"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${getActionBadge(log.action || "")}`}>
                            {getActionArabic(log.action || "").title}
                          </span>
                          <p className="text-[10px] text-muted max-w-[200px] leading-relaxed">
                            {getActionArabic(log.action || "").desc}
                          </p>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <p className="font-medium text-ink break-all max-w-[160px] truncate" title={log.targetName || log.targetId}>
                            {log.targetName || log.targetId || "غير محدد"}
                          </p>
                          <span className="text-[10px] text-muted capitalize">نوع: {log.targetType}</span>
                        </div>
                      </td>

                      {/* Client Info */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-muted">
                            <Globe className="h-3 w-3 shrink-0 text-faint" />
                            <span>IP: {log.ipAddress || "127.0.0.1"}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted">
                            {deviceLower.includes("mobile") ? (
                              <Smartphone className="h-3 w-3 shrink-0 text-faint" />
                            ) : deviceLower.includes("tablet") ? (
                              <Tablet className="h-3 w-3 shrink-0 text-faint" />
                            ) : (
                              <Laptop className="h-3 w-3 shrink-0 text-faint" />
                            )}
                            <span className="truncate max-w-[140px]" title={`${log.browser} on ${log.device}`}>
                              {log.browser} · {log.device}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="px-5 py-3.5 text-muted">
                        <div className="space-y-0.5">
                          <p className="font-bold text-ink">{dateObj.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</p>
                          <p className="text-[10px] text-faint">{dateObj.toLocaleDateString("ar-EG")}</p>
                        </div>
                      </td>

                      {/* Details Trigger */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-500/5 hover:border-brand-500/20 transition shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          عرض الـ Diff والتفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line bg-elevated/25 px-5 py-3 text-right">
            <span className="text-xs text-muted">
              عرض الصفحة <strong>{currentPage}</strong> من أصل <strong>{totalPages}</strong> صفحات ({filteredLogs.length} سجل مفلتر)
            </span>
            <div className="flex items-center gap-1.5" dir="ltr">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40 transition"
              >
                السابق
              </button>
              {[...Array(totalPages)].map((_, idx) => {
                const page = idx + 1;
                // Only render first few, current, and last few
                if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        currentPage === page
                          ? "bg-brand-500 text-white shadow-sm"
                          : "border border-line bg-surface text-muted hover:text-ink"
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="text-xs text-muted px-1">...</span>;
                }
                return null;
              })}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40 transition"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Details & Diff comparison */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Sidebar drawer container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative flex h-full w-full max-w-4xl flex-col bg-bg shadow-2xl border-r border-line"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">تفاصيل ومقارنة التغييرات (Diff)</h3>
                    <p className="text-xs text-muted">مقارنة حالة البيانات قبل التغيير وبعده بشكل مفصل</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg border border-line p-1.5 hover:bg-elevated transition"
                >
                  <X className="h-4 w-4 text-muted" />
                </button>
              </div>

              {/* Content body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Meta details cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <h4 className="text-xs font-bold text-muted border-b border-line pb-1.5">معلومات الفاعل والمستخدم</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">المستخدم:</span>
                        <span className="text-ink font-bold">{selectedLog.adminEmail || "anonymous@ovidra.com"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">الدور بالمنصة:</span>
                        <span className="text-ink font-bold">{selectedLog.userRole || "unknown"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">معرّف المستخدم (UID):</span>
                        <span className="text-muted font-mono select-all text-[11px]">{selectedLog.adminUid}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <h4 className="text-xs font-bold text-muted border-b border-line pb-1.5">تفاصيل الإجراء والموقع</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-muted font-semibold shrink-0">الحدث / الإجراء:</span>
                        <div className="text-left">
                          <span className="text-brand-600 dark:text-brand-400 font-extrabold block">{getActionArabic(selectedLog.action || "").title}</span>
                          <span className="text-[10px] text-faint block font-mono">{selectedLog.action}</span>
                          <p className="text-[10px] text-muted max-w-[200px] mt-1 text-right leading-relaxed">
                            {getActionArabic(selectedLog.action || "").desc}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">نوع ومسمى الهدف:</span>
                        <span className="text-ink font-bold capitalize">{selectedLog.targetType} ({selectedLog.targetName || selectedLog.targetId})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted font-semibold">عنوان الـ IP:</span>
                        <span className="text-ink font-mono">{selectedLog.ipAddress || "127.0.0.1"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Client system details */}
                <div className="rounded-xl border border-line bg-surface p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 border-b border-line pb-1.5 mb-2">
                    <Laptop className="h-4 w-4 text-muted" />
                    <span className="font-bold text-muted">تفاصيل المتصفح والعميل (Client User-Agent)</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted">المتصفح</p>
                      <p className="font-bold text-ink">{selectedLog.browser || "Chrome"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted">نوع الجهاز</p>
                      <p className="font-bold text-ink">{selectedLog.device || "Desktop"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted">الوقت الدقيق</p>
                      <p className="font-bold text-ink">{new Date(selectedLog.timestamp).toLocaleString("ar-EG")}</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] text-muted mb-1">الرمز التعريفي للمتصفح الكامل (UserAgent)</p>
                    <code className="block bg-elevated/40 p-2.5 rounded-lg text-[10px] text-muted leading-relaxed select-all font-mono break-all text-left" dir="ltr">
                      {selectedLog.userAgent || "Mozilla/5.0"}
                    </code>
                  </div>
                </div>

                {/* Before and After Comparer */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-brand-500" />
                    <h4 className="text-sm font-bold text-ink">مقارنة التغييرات التفصيلية (JSON Payload Comparison)</h4>
                  </div>
                  {renderValueDiff(selectedLog.previousValue, selectedLog.newValue)}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-line bg-surface px-6 py-4 flex justify-between">
                <span className="text-[10px] text-muted font-mono leading-loose">معرّف السجل: {selectedLog.id}</span>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-xl bg-elevated px-4 py-2 text-xs font-bold text-ink hover:bg-elevated-hover transition"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
