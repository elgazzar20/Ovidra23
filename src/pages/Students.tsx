import { useMemo, useState, useEffect } from "react";
import {
  Plus, Search, Pencil, Trash2, QrCode, GraduationCap, Download,
  X, UserCog, ExternalLink, Upload, AlertTriangle, Wallet, ListChecks,
  Image as ImageIcon, FileText, MessageSquare,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader, Button, Card, Input, Select, Field, Toggle, Badge, Modal,
  EmptyState, Combobox, MultiCombobox, FilterSelect, pushToast,
} from "../components/ui";
import { QRCodeImage } from "../components/QRCode";
import { ViewToggle, type ViewMode } from "../components/ViewToggle";
import { PaymentTypeBadge, EnrollmentBadge, PaymentStatusBadge } from "../components/StudentBadges";
import { IdCard } from "../components/IdCard";
import { resolveThemeForStudent } from "../lib/cardTheme";
import { exportPng, exportSinglePdf } from "../lib/cardExport";
import { StudentProfile } from "./StudentProfile";
import { getWhatsAppReportUrl } from "../lib/whatsapp";
import type { Student, StudentTeacher } from "../lib/types";
import { nextStudentCode, now, startOfDay, monthKey } from "../lib/db";
import { GRADES, STAGE_TONE, gradeLabel } from "../lib/constants";
import {
  balanceDue, totalPaidFor, studentNetFee, currencySymbol, formatMoney,
  studentPaymentStatus,
} from "../lib/analytics";
import { parseStudentsExcel } from "../lib/excel-import";
import { exportUnpaidCenterSubPdf } from "../lib/pdf-arabic";
import { cn } from "../utils/cn";

function blankStudent(): Student {
  return {
    id: "", name: "", grade: GRADES[0].id, groupIds: [], teachers: [],
    studentPhone: "", parentName: "", parentPhone: "", discount: 0,
    isExempt: false, qrCode: "", registrationDate: startOfDay(now()), lastUpdated: now(),
    enrollmentType: "group", paymentType: "advance",
  };
}
function toDateInput(ts: number) { return new Date(ts).toISOString().slice(0, 10); }

export function Students() {
  const { db, t, lang, upsert, remove, can, canAdd, canDelete, canAddStudent, subscriptionPlan } = useApp();
  const sym = currencySymbol(db);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [qrStudent, setQrStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<Student>(blankStudent());
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);

  // filters
  const [fStage, setFStage] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fTeacher, setFTeacher] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fEnroll, setFEnroll] = useState("");
  const [fPayType, setFPayType] = useState("");
  const [profile, setProfile] = useState<Student | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [importing, setImporting] = useState(false);
  const [newCard, setNewCard] = useState<Student | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);

  const teachers = db.teachers.filter(t => !t.isArchived);
  const gradeOptions = GRADES.map((g) => ({ value: g.id, label: lang === "ar" ? g.ar : g.en }));

  const modalGroupOptions = useMemo(() => {
    return db.groups
      .filter((g) => {
        if (g.isArchived) return false;
        // 1. Filter by grade if specified in the form
        if (form.grade && g.grade && g.grade !== form.grade) return false;
        // 2. Filter by teachers if selected in the form
        const selectedTeacherIds = form.teachers.map((t) => t.teacherId).filter(Boolean);
        if (selectedTeacherIds.length > 0) {
          if (!g.teacherId || !selectedTeacherIds.includes(g.teacherId)) return false;
        }
        return true;
      })
      .map((g) => {
        const tc = db.teachers.find((t) => t.id === g.teacherId);
        const label = tc ? `${g.name} (${tc.name})` : g.name;
        return { value: g.id, label };
      });
  }, [db.groups, db.teachers, form.grade, form.teachers]);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return db.students
      .filter((s) => {
        if (s.isArchived) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !(s.parentPhone ?? "").includes(q)) return false;
        if (fStage) { const g = GRADES.find((x) => x.id === s.grade); if (!g || g.stage !== fStage) return false; }
        if (fGrade && s.grade !== fGrade) return false;
        if (fTeacher && !s.teachers.some((tr) => tr.teacherId === fTeacher)) return false;
        if (fStatus === "exempt" && !s.isExempt) return false;
        if (fStatus === "outstanding" && (s.isExempt || balanceDue(db, s) <= 0)) return false;
        if (fStatus === "fullPaid" && (s.isExempt || balanceDue(db, s) > 0)) return false;
        if (fStatus === "unpaidCenterSub") {
          const curMonth = monthKey(now());
          const paid = db.payments.some(
            (p) => p.studentId === s.id && p.month === curMonth && (p.forCenter === true || p.type === "CENTER_SUBSCRIPTION")
          );
          if (paid) return false;
        }
        if (fStatus === "paidCenterSub") {
          const curMonth = monthKey(now());
          const paid = db.payments.some(
            (p) => p.studentId === s.id && p.month === curMonth && (p.forCenter === true || p.type === "CENTER_SUBSCRIPTION")
          );
          if (!paid) return false;
        }
        if (fEnroll && s.enrollmentType !== fEnroll) return false;
        if (fPayType && s.paymentType !== fPayType) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db, query, fStage, fGrade, fTeacher, fStatus, fEnroll, fPayType]);

  const displayedStudents = useMemo(() => {
    return filtered.slice(0, page * pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, fStage, fGrade, fTeacher, fStatus, fEnroll, fPayType]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        setPage((p) => p + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // settlement / round-up (تصفية وحصر) — who hasn't paid in the current cycle
  const unpaidSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const s of db.students) {
      if (s.isArchived) continue;
      if (s.isExempt) continue;
      const st = studentPaymentStatus(db, s);
      if (st.status !== "paid") {
        count++;
        total += balanceDue(db, s);
      }
    }
    return { count, total };
  }, [db]);

  if (profile) {
    const live = db.students.find((s) => s.id === profile.id) ?? profile;
    return <StudentProfile student={live} onBack={() => setProfile(null)} />;
  }

  const openCreate = () => {
    if (!canAddStudent()) {
      const limits: Record<string, number> = { free: 30, pro: 500, enterprise: 99999 };
      pushToast(`وصلت إلى الحد الأقصى (${limits[subscriptionPlan] || 30} طالب) في خطة ${subscriptionPlan === "free" ? "المجاني" : subscriptionPlan === "pro" ? "الاحترافي" : "المؤسسي"}. قم بالترقية لإضافة المزيد.`, "error");
      window.dispatchEvent(new CustomEvent("navigate", { detail: "upgrade" }));
      return;
    }
    const b = blankStudent();
    b.id = nextStudentCode(db.students);
    b.qrCode = `CPD:${b.id}`;
    if (teachers[0]) b.teachers = [{ teacherId: teachers[0].id, fee: 300 }];
    setForm(b);
    setCreating(true);
  };
  const openEdit = (s: Student) => { setForm({ ...s, teachers: s.teachers.map((x) => ({ ...x })) }); setEditing(s); };

  const save = () => {
    if (!form.name.trim() || !form.teachers.length) return;
    const wasCreating = creating;
    upsert("students", { ...form, qrCode: form.qrCode || `CPD:${form.id}`, teachers: form.teachers.filter((x) => x.teacherId) });
    pushToast(t("toast.saved"));
    setEditing(null);
    setCreating(false);
    // When a NEW student is registered, show their ID card immediately.
    if (wasCreating) {
      setTimeout(() => { setCardFlipped(false); setNewCard({ ...form }); }, 150);
    }
  };
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setForm((f) => ({ ...f, [k]: v }));
  const updateTeacher = (idx: number, patch: Partial<StudentTeacher>) =>
    setForm((f) => ({ ...f, teachers: f.teachers.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
  const teacherName = (id: string) => teachers.find((x) => x.id === id)?.name ?? "—";

  // Excel import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const result = await parseStudentsExcel(file, db.students);
    setImporting(false);
    if (result.success && result.data.length > 0) {
      result.data.forEach((s) => upsert("students", s));
      pushToast(t("students.importSuccess", { n: result.count }));
    } else {
      pushToast(t("students.importError", { error: result.errors[0] || "Unknown" }), "error");
    }
    e.target.value = "";
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("students.title")} subtitle={t("students.subtitle")}
        actions={<div className="flex items-center gap-2">
          {can("students.manage") && canAdd() && (
            <>
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 text-xs font-medium text-ink transition hover:bg-line">
                <Upload className="h-3.5 w-3.5" />
                {importing ? t("students.importing") : t("students.importExcel")}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
              </label>
              <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("students.new")}</Button>
            </>
          )}
        </div>} />

      {/* free plan limit banner */}
      {subscriptionPlan === "free" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-2.5 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <GraduationCap className="h-4 w-4 shrink-0" />
          {lang === "ar"
            ? `الحد المسموح في النسخة المجانية: 30 طالب فقط (${db.students.length}/30). قم بالترقية لإضافة المزيد.`
            : `Free plan limit: 30 students only (${db.students.length}/30). Upgrade to add more.`}
        </div>
      )}

      {/* settlement / round-up of unpaid students (تصفية وحصر) */}
      {unpaidSummary.count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-xs dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-rose-700 dark:text-rose-300">
              {lang === "ar"
                ? `${unpaidSummary.count} طالب لم يسدد بعد`
                : `${unpaidSummary.count} student(s) haven't paid yet`}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-rose-600/90 dark:text-rose-300/80">
              <Wallet className="h-3.5 w-3.5" />
              {lang === "ar" ? "إجمالي المستحقات" : "Total due"}: {formatMoney(unpaidSummary.total, sym)}
            </p>
          </div>
          <Button
            size="sm"
            variant={fStatus === "outstanding" ? "primary" : "secondary"}
            onClick={() => { setFStatus(fStatus === "outstanding" ? "" : "outstanding"); }}
          >
            <ListChecks className="h-4 w-4" />
            {fStatus === "outstanding"
              ? (lang === "ar" ? "عرض الكل" : "Show all")
              : (lang === "ar" ? "حصر غير المسددين" : "Settle unpaid")}
          </Button>
        </div>
      )}

      {/* toolbar */}
      <Card className="space-y-3 p-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
          <Input placeholder={t("action.search")} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label={t("students.filter.stage")} value={fStage} onChange={setFStage}
            options={[{ value: "", label: t("students.filter.all") },
              { value: "pre", label: lang === "ar" ? "تمهيدي" : "Pre-Primary" },
              { value: "primary", label: lang === "ar" ? "ابتدائي" : "Primary" },
              { value: "prep", label: lang === "ar" ? "إعدادي" : "Preparatory" },
              { value: "secondary", label: lang === "ar" ? "ثانوي" : "Secondary" }]} />
          <FilterSelect label={t("students.filter.grade")} value={fGrade} onChange={setFGrade}
            options={[{ value: "", label: t("students.filter.all") }, ...gradeOptions]} />
          <FilterSelect label={t("students.filter.teacher")} value={fTeacher} onChange={setFTeacher}
            options={[{ value: "", label: t("students.filter.all") }, ...teachers.map((tc) => ({ value: tc.id, label: tc.name }))]} />
          <FilterSelect label={t("students.filter.status")} value={fStatus} onChange={setFStatus}
            options={[{ value: "", label: t("students.filter.all") },
              { value: "exempt", label: t("students.filter.exemptOnly") },
              { value: "outstanding", label: t("students.filter.outstanding") },
              { value: "fullPaid", label: t("students.filter.fullPaid") },
              { value: "unpaidCenterSub", label: lang === "ar" ? "غير مسددي اشتراك السنتر" : "Unpaid Center Sub" },
              { value: "paidCenterSub", label: lang === "ar" ? "مسددي اشتراك السنتر" : "Paid Center Sub" }]} />
          <FilterSelect label={lang === "ar" ? "نوع الحضور" : "Enrollment"} value={fEnroll} onChange={setFEnroll}
            options={[{ value: "", label: t("students.filter.all") },
              { value: "private", label: lang === "ar" ? "خاص" : "Private" },
              { value: "group", label: lang === "ar" ? "مجموعة" : "Group" }]} />
          <FilterSelect label={lang === "ar" ? "طريقة الدفع" : "Payment"} value={fPayType} onChange={setFPayType}
            options={[{ value: "", label: t("students.filter.all") },
              { value: "advance", label: lang === "ar" ? "مقدم" : "Advance" },
              { value: "deferred", label: lang === "ar" ? "مؤخر" : "Deferred" }]} />
          <div className="ms-auto flex items-center gap-2">
            {fStatus === "unpaidCenterSub" && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1"
                onClick={() => exportUnpaidCenterSubPdf(db, lang)}
              >
                <Download className="h-3.5 w-3.5" />
                {lang === "ar" ? "تحميل تقرير اشتراك السنتر PDF" : "Download PDF"}
              </Button>
            )}
            <Badge tone="brand">{t("students.results", { n: filtered.length })}</Badge>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="p-6"><EmptyState icon={<GraduationCap className="h-6 w-6" />} title={t("students.empty")} action={can("students.manage") ? <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />{t("students.new")}</Button> : undefined} /></div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedStudents.map((s) => {
              const st = studentPaymentStatus(db, s);
              const grade = GRADES.find((g) => g.id === s.grade);
              const initial = s.name.split(" ").map((p) => p[0]).slice(0, 2).join("") || "—";
              const due = s.isExempt ? 0 : balanceDue(db, s);
              const statusColor =
                s.isExempt || st.status === "paid" ? "border-emerald-500/30" :
                st.status === "overdue" ? "border-rose-500/30" : "border-amber-500/30";
              return (
                <div key={s.id} className={cn("card-hover flex flex-col justify-between overflow-hidden rounded-xl border-t-4 bg-surface p-4 shadow-sm border", statusColor)}>
                  <div className="space-y-3">
                    <button onClick={() => setProfile(s)} className="flex items-start gap-3 text-start w-full">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-sm font-black text-white shadow-sm">{initial}</div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink hover:text-brand-600 transition-colors">
                          <span className="truncate">{s.name}</span>
                          <EnrollmentBadge student={s} lang={lang} onlyPrivate />
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 rounded">{s.id}</span>
                          {grade && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", STAGE_TONE[grade.stage])}>{gradeLabel(s.grade, lang)}</span>}
                        </div>
                      </div>
                    </button>

                    {/* status row */}
                    <div className="flex items-center justify-between border-t border-line/40 pt-2.5">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{lang === "ar" ? "الحالة" : "Status"}</span>
                      <PaymentStatusBadge status={st} lang={lang} exempt={s.isExempt} />
                    </div>

                    {/* info: fee + pay type */}
                    <div className="flex items-center justify-between rounded-xl bg-elevated/40 px-3 py-2 border border-line/30">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{lang === "ar" ? "الرسوم" : "Fee"}</span>
                      <div className="flex items-center gap-2">
                        <PaymentTypeBadge student={s} lang={lang} />
                        <span className="text-xs font-black text-ink">{formatMoney(studentNetFee(s), sym)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-2 pt-3 border-t border-line/50">
                    {/* due / actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted truncate max-w-[120px]" title={s.teachers.map(t => teacherName(t.teacherId)).join(", ")}>
                        {teacherName(s.teachers[0]?.teacherId ?? "")}{s.teachers.length > 1 && ` +${s.teachers.length - 1}`}
                      </span>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setProfile(s)}><ExternalLink className="h-3.5 w-3.5 text-muted hover:text-ink" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQrStudent(s)}><QrCode className="h-3.5 w-3.5 text-muted hover:text-ink" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            const { url } = getWhatsAppReportUrl(db, s);
                            window.open(url, "_blank");
                            pushToast(lang === "ar" ? "تم فتح واتساب" : "WhatsApp loaded");
                          }}
                          title={lang === "ar" ? "تقرير بالواتساب" : "Send WhatsApp Report"}
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600 hover:text-emerald-700" />
                        </Button>
                        {can("students.manage") && canDelete() && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirmStudent(s)} title={lang === "ar" ? "حذف الطالب" : "Delete Student"}><Trash2 className="h-3.5 w-3.5 text-rose-500 hover:text-rose-600" /></Button>
                        )}
                      </div>
                    </div>

                    {!s.isExempt && due > 0 && (
                      <div className="rounded-lg bg-rose-50 px-2.5 py-1 text-center text-[10px] font-extrabold text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20">
                        {lang === "ar" ? "مستحق" : "Due"}: {formatMoney(due, sym)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "compact" ? (
          <div className="divide-y divide-line/60">
            {displayedStudents.map((s) => {
              const st = studentPaymentStatus(db, s);
              const due = s.isExempt ? 0 : balanceDue(db, s);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-elevated/40 transition-colors">
                  <button onClick={() => setProfile(s)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-[10px] font-black text-white shadow-inner">{s.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink hover:text-brand-600 transition-colors">
                        <span className="truncate">{s.name}</span>
                        <EnrollmentBadge student={s} lang={lang} onlyPrivate />
                      </p>
                      <p className="font-semibold text-[10px] text-faint mt-0.5">
                        <span className="font-mono text-brand-600 font-bold bg-brand-50 dark:bg-brand-500/10 px-1 rounded">{s.id}</span> · {teacherName(s.teachers[0]?.teacherId ?? "")}
                      </p>
                    </div>
                  </button>
                  <PaymentTypeBadge student={s} lang={lang} className="hidden sm:inline-flex" />
                  <PaymentStatusBadge status={st} lang={lang} exempt={s.isExempt} />
                  <span className="hidden w-20 text-end text-xs font-black text-ink sm:inline">{formatMoney(studentNetFee(s), sym)}</span>
                  {!s.isExempt && due > 0 && (
                    <span className="hidden w-24 text-end text-[11px] font-black text-rose-600 dark:text-rose-400 sm:inline bg-rose-50 px-2 py-0.5 rounded border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20">{formatMoney(due, sym)}</span>
                  )}
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProfile(s)} title={t("action.view")}><ExternalLink className="h-4 w-4 text-muted hover:text-ink" /></Button>
                    {can("students.manage") && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title={t("action.edit")}><Pencil className="h-4 w-4 text-muted hover:text-ink" /></Button>
                        {canDelete() && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmStudent(s)} title={lang === "ar" ? "حذف" : "Delete"}><Trash2 className="h-4 w-4 text-rose-500 hover:text-rose-600" /></Button>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-elevated/40 text-[11px] uppercase tracking-wide text-faint font-bold">
                  <th className="px-4 py-3 text-start font-bold">{t("students.name")}</th>
                  <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "المعلم/المجموعة" : "Teacher/Group"}</th>
                  <th className="px-4 py-3 text-center font-bold">{lang === "ar" ? "نوع الدفع" : "Pay type"}</th>
                  <th className="px-4 py-3 text-center font-bold">{t("students.totalFee")}</th>
                  <th className="px-4 py-3 text-center font-bold">{lang === "ar" ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end font-bold">{lang === "ar" ? "المستحق" : "Balance"}</th>
                  <th className="px-4 py-3 text-end font-bold">{t("action.details")}</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((s) => {
                  const st = studentPaymentStatus(db, s);
                  const grade = GRADES.find((g) => g.id === s.grade);
                  const due = s.isExempt ? 0 : balanceDue(db, s);
                  const initial = s.name.split(" ").map((p) => p[0]).slice(0, 2).join("") || "—";
                  return (
                    <tr key={s.id} className="group border-b border-line/40 align-middle transition last:border-0 hover:bg-elevated/20">
                      {/* name + code + grade */}
                      <td className="px-4 py-3.5">
                        <button onClick={() => setProfile(s)} className="flex items-center gap-3 text-start transition">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-xs font-black text-white shadow-sm">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate font-bold text-ink group-hover:text-brand-600 transition-colors">{s.name}</p>
                              <EnrollmentBadge student={s} lang={lang} onlyPrivate />
                              {s.isExempt && <Badge tone="info">{t("students.exempt")}</Badge>}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 rounded">{s.id}</span>
                              {grade && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", STAGE_TONE[grade.stage])}>{gradeLabel(s.grade, lang)}</span>}
                            </div>
                          </div>
                        </button>
                      </td>
                      {/* teacher / group */}
                      <td className="px-4 py-3.5 font-semibold text-xs text-muted">
                        {s.teachers.length > 1
                          ? <Badge tone="brand">{t("students.multiTeacher", { n: s.teachers.length })}</Badge>
                          : <span className="font-semibold">{teacherName(s.teachers[0]?.teacherId ?? "")}</span>}
                      </td>
                      {/* pay type */}
                      <td className="px-4 py-3.5 text-center">
                        <PaymentTypeBadge student={s} lang={lang} />
                      </td>
                      {/* monthly fee */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="rounded-md bg-elevated/70 px-2.5 py-1 text-xs font-black text-ink border border-line/30">{formatMoney(studentNetFee(s), sym)}</span>
                      </td>
                      {/* status */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          <PaymentStatusBadge status={st} lang={lang} exempt={s.isExempt} />
                        </div>
                      </td>
                      {/* balance due */}
                      <td className="px-4 py-3.5 text-end">
                        {s.isExempt ? (
                          <span className="text-xs text-faint">—</span>
                        ) : (
                          <span className={cn("text-xs font-black px-2 py-0.5 rounded border", due <= 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20")}>
                            {due <= 0 ? (lang === "ar" ? "مسدد" : "Paid") : formatMoney(due, sym)}
                          </span>
                        )}
                      </td>
                      {/* actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProfile(s)} title={t("action.view")}><ExternalLink className="h-4 w-4 text-muted hover:text-ink" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrStudent(s)} title={t("students.qr")}><QrCode className="h-4 w-4 text-muted hover:text-ink" /></Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const { url } = getWhatsAppReportUrl(db, s);
                              window.open(url, "_blank");
                              pushToast(lang === "ar" ? "تم فتح واتساب" : "WhatsApp loaded");
                            }}
                            title={lang === "ar" ? "تقرير بالواتساب" : "Send WhatsApp Report"}
                          >
                            <MessageSquare className="h-4 w-4 text-emerald-600 hover:text-emerald-700" />
                          </Button>
                          {can("students.manage") && (<>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4 text-muted hover:text-ink" /></Button>
                            {canDelete() && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmStudent(s)} title={lang === "ar" ? "حذف" : "Delete"}><Trash2 className="h-4 w-4 text-rose-500 hover:text-rose-600" /></Button>}
                          </>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* create / edit modal */}
      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? t("students.edit") : t("students.new")} size="lg"
        footer={<><Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("action.cancel")}</Button>
          <Button onClick={save} disabled={!form.teachers.length}>{t("action.save")}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("students.code")}><Input value={form.id} disabled className="font-mono" /></Field>
            <Field label={t("students.name")} required><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ahmed Ali" /></Field>
            <Field label={t("students.grade")}>
              <Combobox value={form.grade} onChange={(v) => set("grade", v)} options={gradeOptions}
                placeholder={t("students.grade")} allowCustom
                searchLabel={t("combo.search")} addLabel={t("combo.add")} emptyLabel={t("combo.none")} />
            </Field>
            <Field label={t("students.registered")}><Input type="date" value={toDateInput(form.registrationDate)} onChange={(e) => set("registrationDate", startOfDay(new Date(e.target.value).getTime()))} /></Field>
            <Field label={`${t("students.parentName")}`}><Input value={form.parentName} onChange={(e) => set("parentName", e.target.value)} /></Field>
            <Field label={`${t("students.parentPhone")}`}><Input value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} /></Field>
            <Field label={`${t("students.studentPhone")}`}><Input value={form.studentPhone} onChange={(e) => set("studentPhone", e.target.value)} /></Field>
            <Field label={`${t("students.discount")} (${sym})`}><Input type="number" min={0} value={form.discount} onChange={(e) => set("discount", +e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={lang === "ar" ? "نوع الحضور" : "Enrollment type"}>
              <div className="flex gap-2">
                <button type="button" onClick={() => set("enrollmentType", "group")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", form.enrollmentType === "group" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "مجموعة" : "Group"}
                </button>
                <button type="button" onClick={() => set("enrollmentType", "private")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", form.enrollmentType === "private" ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "خاص" : "Private"}
                </button>
              </div>
            </Field>
            <Field label={lang === "ar" ? "طريقة الدفع" : "Payment type"}>
              <div className="flex gap-2">
                <button type="button" onClick={() => set("paymentType", "advance")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", form.paymentType === "advance" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "مقدم" : "Advance"}
                </button>
                <button type="button" onClick={() => set("paymentType", "deferred")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", form.paymentType === "deferred" ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "مؤخر" : "Deferred"}
                </button>
              </div>
            </Field>
          </div>

          {/* teachers with per-teacher fees */}
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><UserCog className="h-4 w-4 text-brand-600" />{t("students.teachers")}</span>
              <Button size="sm" variant="subtle" onClick={() => set("teachers", [...form.teachers, { teacherId: teachers[0]?.id ?? "", fee: 300 }])} disabled={!teachers.length}>
                <Plus className="h-3.5 w-3.5" />{t("students.addTeacher")}
              </Button>
            </div>
            {!teachers.length && <p className="py-2 text-center text-[11px] text-amber-600">{t("teachers.empty")}</p>}
            <div className="space-y-2">
              {form.teachers.map((tr, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={tr.teacherId} onChange={(e) => updateTeacher(idx, { teacherId: e.target.value })} className="flex-1">
                    <option value="">{t("students.selectTeacher")}</option>
                    {teachers.map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                  </Select>
                  <div className="relative w-32">
                    <Input type="number" min={0} value={tr.fee} onChange={(e) => updateTeacher(idx, { fee: +e.target.value })} className="ps-8" />
                    <span className="pointer-events-none absolute inset-y-0 start-2.5 my-auto text-[10px] text-faint">{sym}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => set("teachers", form.teachers.filter((_, i) => i !== idx))}><X className="h-4 w-4 text-rose-500" /></Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
              <Toggle checked={form.isExempt} onChange={(v) => set("isExempt", v)} label={t("students.exempt")} />
              <span className="font-semibold text-ink">{t("students.totalFee")}: {formatMoney(form.isExempt ? 0 : studentNetFee(form), sym)}</span>
            </div>
            {!form.teachers.length && <p className="mt-1 text-[11px] text-rose-500">{t("students.noTeachers")}</p>}
          </div>

          {/* groups dropdown */}
          <Field label={`${t("students.groups")}`} hint={t("combo.selectGroups")}>
            <MultiCombobox
              selected={form.groupIds} onChange={(v) => set("groupIds", v)}
              options={modalGroupOptions}
              placeholder={t("combo.selectGroups")}
              searchLabel={t("combo.search")}
              selectedLabel={(n) => t("combo.selected", { n })}
              emptyLabel={t("classes.emptyGroups")}
            />
            {form.groupIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.groupIds.map((gid) => {
                  const g = db.groups.find((x) => x.id === gid);
                  return (
                    <span key={gid} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                      {g?.name ?? gid}
                      <button type="button" onClick={() => set("groupIds", form.groupIds.filter((x) => x !== gid))}><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </Field>
        </div>
      </Modal>

      {/* Student deletion warning and option modal */}
      <Modal 
        open={!!deleteConfirmStudent} 
        onClose={() => setDeleteConfirmStudent(null)} 
        title={lang === "ar" ? "⚠️ تحذير: حذف / أرشفة الطالب" : "⚠️ Warning: Delete / Archive Student"} 
        size="md"
        footer={
          <div className="flex w-full justify-between gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmStudent(null)}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="subtle" 
                onClick={() => {
                  if (deleteConfirmStudent) {
                    upsert("students", { ...deleteConfirmStudent, isArchived: true });
                    pushToast(lang === "ar" ? "تم نقل الطالب إلى الأرشيف بنجاح" : "Student moved to archive successfully");
                    setDeleteConfirmStudent(null);
                  }
                }}
              >
                {lang === "ar" ? "نقل للأرشيف 📦" : "Move to Archive 📦"}
              </Button>
              <Button 
                variant="primary" 
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                onClick={() => {
                  if (deleteConfirmStudent) {
                    remove("students", deleteConfirmStudent.id);
                    pushToast(lang === "ar" ? "تم حذف الطالب نهائياً بنجاح" : "Student permanently deleted");
                    setDeleteConfirmStudent(null);
                  }
                }}
              >
                {lang === "ar" ? "حذف نهائي ❌" : "Delete Permanently ❌"}
              </Button>
            </div>
          </div>
        }
      >
        {deleteConfirmStudent && (
          <div className="space-y-4 py-2 text-start">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="text-sm leading-relaxed">
                <p className="font-bold text-base mb-1">
                  {lang === "ar" ? `هل أنت متأكد من حذف الطالب: ${deleteConfirmStudent.name}؟` : `Are you sure you want to delete ${deleteConfirmStudent.name}?`}
                </p>
                <p>
                  {lang === "ar" 
                    ? "انتبه: الحذف النهائي سيؤدي إلى حذف الطالب وكل سجلاته نهائياً من النظام. بدلاً من ذلك، يمكنك نقله للأرشيف للاحتفاظ ببياناته المالية والغياب مع إخفائه من القوائم النشطة."
                    : "Warning: Permanent deletion will completely remove this student and all of their academic/financial history from the system. Alternatively, you can move them to the Archive to retain their records while hiding them from active lists."}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-elevated/40 p-3 text-xs text-muted">
              <div className="flex justify-between border-b border-line/60 pb-1.5 font-semibold">
                <span>{lang === "ar" ? "اسم الطالب:" : "Student Name:"}</span>
                <span className="text-ink">{deleteConfirmStudent.name}</span>
              </div>
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span>{lang === "ar" ? "كود الطالب:" : "Student ID:"}</span>
                <span className="font-mono font-semibold text-ink">{deleteConfirmStudent.id}</span>
              </div>
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span>{lang === "ar" ? "المرحلة والصف الدراسية:" : "Grade & Stage:"}</span>
                <span className="text-ink">{gradeLabel(deleteConfirmStudent.grade, lang)}</span>
              </div>
              <div className="flex justify-between">
                <span>{lang === "ar" ? "المديونية الحالية متبقية:" : "Current Outstanding Debt:"}</span>
                <span className="font-bold text-rose-600">{formatMoney(balanceDue(db, deleteConfirmStudent), sym)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* QR modal */}
      <Modal open={!!qrStudent} onClose={() => setQrStudent(null)} title={t("students.qr")} size="sm"
        footer={<Button variant="secondary" onClick={() => setQrStudent(null)}>{t("action.close")}</Button>}>
        {qrStudent && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-xl border border-line bg-white p-3"><QRCodeImage value={qrStudent.qrCode} size={180} /></div>
            <div className="text-center">
              <p className="font-mono text-sm font-bold text-ink">{qrStudent.id}</p>
              <p className="text-sm text-muted">{qrStudent.name}</p>
              <p className="mt-1 text-[11px] text-faint">{t("students.paid")}: {formatMoney(totalPaidFor(db, qrStudent.id), sym)}</p>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); downloadQr(qrStudent); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
              <Download className="h-3.5 w-3.5" />{t("action.export")}
            </a>
          </div>
        )}
      </Modal>

      {/* auto-shown ID card when a new student is registered */}
      <Modal open={!!newCard} onClose={() => setNewCard(null)}
        title={lang === "ar" ? "تم إنشاء كارت الطالب ✨" : "Student ID card created"}
        size="sm"
        footer={<div className="flex w-full items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => setNewCard(null)}>{lang === "ar" ? "إغلاق" : "Close"}</Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => runCardExport(exportPng(db, newCard!, resolveThemeForStudent(db, newCard!), "front", lang))}><ImageIcon className="h-4 w-4" />PNG</Button>
            <Button size="sm" onClick={() => runCardExport(exportSinglePdf(db, newCard!, resolveThemeForStudent(db, newCard!), lang))}><FileText className="h-4 w-4" />PDF</Button>
          </div>
        </div>}>
        {newCard && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-full max-w-[340px]">
              <IdCard db={db} student={newCard} theme={resolveThemeForStudent(db, newCard)} flipped={cardFlipped} onFlip={() => setCardFlipped((f) => !f)} />
            </div>
            <p className="text-center text-[11px] text-muted">{lang === "ar" ? "اضغط على الكارت لقلبه · الكارت والباركود مربوطان بنظام الحضور" : "Tap the card to flip · QR & barcode are linked to attendance"}</p>
          </div>
        )}
      </Modal>
    </div>
  );

  function runCardExport(p: Promise<void>) {
    p.catch(() => pushToast(lang === "ar" ? "تعذّر التصدير" : "Export failed", "error"));
  }
}

async function downloadQr(s: Student) {
  const { default: QRCode } = await import("qrcode");
  const url = await QRCode.toDataURL(s.qrCode, { width: 480, margin: 2 });
  const a = document.createElement("a");
  a.href = url;
  a.download = `${s.id}_qr.png`;
  a.click();
}
