import { useMemo, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, Users, X, FileDown, Upload,
  UsersRound, CalendarRange, StickyNote, Phone, Mail, ChevronLeft, Wallet, Send, CalendarClock, AlertTriangle,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader, Button, Card, Input, Textarea, Field, Badge, Modal, EmptyState, FilterSelect, Tabs, pushToast, MultiCombobox
} from "../components/ui";
import type { Teacher } from "../lib/types";
import { now, uid } from "../lib/db";
import { SUBJECTS, subjectLabel, gradeLabel, formatTime12 } from "../lib/constants";
import {
  teacherRevenue, teacherCenterShare, teacherNet, studentsOfTeacher,
  groupsOfTeacher, paidForTeacher, currencySymbol, formatMoney, studentPaymentStatus,
} from "../lib/analytics";
import { PaymentStatusBadge, EnrollmentBadge } from "../components/StudentBadges";
import {
  exportStudents as exportTeacherStudents,
  exportFinancial as exportTeacherFinancial,
} from "../lib/teacherReports";
import { parseTeachersExcel } from "../lib/excel-import";
import { usePersistentView } from "../components/PersistentViewToggle";
import { ViewToggle } from "../components/ViewToggle";
import { cn } from "../utils/cn";
import { nextTeacherCode } from "../lib/db";

function blankTeacher(teachers: Teacher[]): Teacher {
  return {
    id: nextTeacherCode(teachers), name: "", phone: "", email: "", subjects: [],
    payType: "percentage", commissionRate: 10, fixedAmount: 500, lastUpdated: now(),
  };
}

export function Teachers() {
  const { db, t, lang, upsert, remove, can, canDelete } = useApp();
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Teacher | null>(null);
  const [form, setForm] = useState<Teacher>(blankTeacher(db.teachers));
  const [fSubject, setFSubject] = useState("");
  const [fPay, setFPay] = useState("");
  const [importing, setImporting] = useState(false);
  const { view, change: setView } = usePersistentView("teachers", "grid");
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState<Teacher | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return db.teachers
      .filter((x) => {
        if (x.isArchived) return false;
        if (x.isArchived) return false;
        if (q && !x.name.toLowerCase().includes(q) && !x.subjects.join(" ").toLowerCase().includes(q)) return false;
        if (fSubject && !x.subjects.includes(fSubject)) return false;
        if (fPay && x.payType !== fPay) return false;
        return true;
      })
      .sort((a, b) => teacherRevenue(db, b.id) - teacherRevenue(db, a.id));
  }, [db, query, fSubject, fPay]);

  const { canAddTeacher, subscriptionPlan } = useApp();

  const openCreate = () => {
    if (!canAddTeacher()) {
      const limits: Record<string, number> = { free: 2, pro: 30, enterprise: 99999 };
      pushToast(`وصلت إلى الحد الأقصى (${limits[subscriptionPlan] || 2} معلم) في خطة ${subscriptionPlan === "free" ? "المجاني" : subscriptionPlan === "pro" ? "الاحترافي" : "المؤسسي"}. قم بالترقية لإضافة المزيد.`, "error");
      window.dispatchEvent(new CustomEvent("navigate", { detail: "upgrade" }));
      return;
    }
    setForm({ ...blankTeacher(db.teachers), subjects: [SUBJECTS[0]] });
    setCreating(true);
  };
  const openEdit = (x: Teacher) => {
    setForm({ ...x, subjects: [...x.subjects] });
    setEditing(x);
  };
  const save = () => {
    if (!form.name.trim() || !form.subjects.length) return;
    upsert("teachers", form);
    pushToast(t("toast.saved"));
    setCreating(false);
    setEditing(null);
  };
  const set = <K extends keyof Teacher>(k: K, v: Teacher[K]) => setForm((f) => ({ ...f, [k]: v }));

  const subjectOptions = SUBJECTS.map((s) => ({ value: s, label: subjectLabel(s, lang) }));

  if (detail) {
    // always pass the live teacher record so saved notes/edits reflect instantly
    const live = db.teachers.find((t) => t.id === detail.id) ?? detail;
    return <TeacherDetailPage teacher={live} onBack={() => setDetail(null)} />;
  }

  // Excel import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const result = await parseTeachersExcel(file);
    setImporting(false);
    if (result.success && result.data.length > 0) {
      result.data.forEach((tc) => upsert("teachers", tc));
      pushToast(t("teachers.importSuccess", { n: result.count }));
    } else {
      pushToast(result.errors[0] || "Import failed", "error");
    }
    e.target.value = "";
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("teachers.title")} subtitle={t("teachers.subtitle")}
        actions={<div className="flex items-center gap-2">
          {can("teachers.manage") && (
            <>
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 text-xs font-medium text-ink transition hover:bg-line">
                <Upload className="h-3.5 w-3.5" />
                {importing ? "..." : t("teachers.importExcel")}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
              </label>
              <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("teachers.new")}</Button>
            </>
          )}
        </div>} />

      {/* free plan limit banner */}
      {subscriptionPlan === "free" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-2.5 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <Users className="h-4 w-4 shrink-0" />
          {isAr
            ? `الحد المسموح في النسخة المجانية: 2 معلمين فقط (${db.teachers.length}/2). قم بالترقية لإضافة المزيد.`
            : `Free plan limit: 2 teachers only (${db.teachers.length}/2). Upgrade to add more.`}
        </div>
      )}

      {/* toolbar */}
      <Card className="space-y-3 p-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
          <Input placeholder={t("action.search")} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label={t("teachers.filter.subject")} value={fSubject} onChange={setFSubject}
            options={[{ value: "", label: t("students.filter.all") }, ...subjectOptions]} />
          <FilterSelect label={t("teachers.filter.pay")} value={fPay} onChange={setFPay}
            options={[
              { value: "", label: t("students.filter.all") },
              { value: "percentage", label: t("teachers.pay.percentage") },
              { value: "fixed", label: t("teachers.pay.fixed") },
            ]} />
          <div className="ms-auto flex items-center gap-2">
            <Badge tone="neutral">{t("teachers.results", { n: filtered.length })}</Badge>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Users className="h-6 w-6" />} title={t("teachers.empty")} /></Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tc) => {
            const net = teacherNet(db, tc);
            return (
              <Card key={tc.id} className="card-hover group p-4 border border-line bg-surface/50">
                <div className="flex items-center justify-between mb-3 border-b border-line/40 pb-2.5">
                  <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200/30">{tc.id}</span>
                  {can("teachers.manage") && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(tc)} className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmTeacher(tc)} className="h-7 w-7" title={lang === "ar" ? "حذف" : "Delete"}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                    </div>
                  )}
                </div>
                <button onClick={() => setDetail(tc)} className="flex w-full items-start gap-3 text-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${tc.color ?? "#6366f1"}, #4f46e5)` }}>
                    {tc.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-sm text-ink hover:text-brand-600">
                      {tc.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {tc.subjects.slice(0, 2).map((s) => <Badge key={s} tone="violet">{subjectLabel(s, lang)}</Badge>)}
                      {tc.subjects.length > 2 && <Badge tone="neutral">+{tc.subjects.length - 2}</Badge>}
                    </div>
                  </div>
                </button>
                <div className="mt-3.5 grid grid-cols-2 min-[480px]:grid-cols-4 gap-y-3.5 gap-x-2 border-t border-line/60 pt-3 text-center">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate" title={String(studentsOfTeacher(db, tc.id).length)}>
                      {studentsOfTeacher(db, tc.id).length}
                    </p>
                    <p className="truncate text-[10px] text-faint font-semibold">{t("students.title")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate" title={String(groupsOfTeacher(db, tc.id).length)}>
                      {groupsOfTeacher(db, tc.id).length}
                    </p>
                    <p className="truncate text-[10px] text-faint font-semibold">{t("classes.groups")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-amber-600 truncate" title={formatMoney(teacherCenterShare(db, tc), sym)}>
                      {formatMoney(teacherCenterShare(db, tc), sym)}
                    </p>
                    <p className="truncate text-[10px] text-faint font-semibold">{t("teachers.centerShare")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-emerald-600 truncate" title={formatMoney(net, sym)}>
                      {formatMoney(net, sym)}
                    </p>
                    <p className="truncate text-[10px] text-faint font-semibold">{t("teachers.netIncome")}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : view === "compact" ? (
        <Card className="overflow-hidden border border-line shadow-sm rounded-xl">
          <div className="divide-y divide-line/60">
            {filtered.map((tc) => {
              const net = teacherNet(db, tc);
              const share = teacherCenterShare(db, tc);
              return (
                <div key={tc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-elevated/40 transition-all">
                  <span className="font-mono text-xs font-bold text-brand-600 shrink-0 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200/30">{tc.id}</span>
                  <button onClick={() => setDetail(tc)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-inner" style={{ background: `linear-gradient(135deg, ${tc.color ?? "#6366f1"}, #4f46e5)` }}>{tc.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink hover:text-brand-600">
                        {tc.name}
                      </p>
                      <p className="truncate text-[10px] text-faint font-semibold mt-0.5">{tc.subjects.map((s) => subjectLabel(s, lang)).join(" · ")}</p>
                    </div>
                  </button>
                  <span className="hidden text-xs text-muted font-semibold sm:inline">{studentsOfTeacher(db, tc.id).length} {t("students.title")}</span>
                  <span className="hidden text-xs text-muted font-semibold sm:inline">{groupsOfTeacher(db, tc.id).length} {t("classes.groups")}</span>
                  <Badge tone="warning">{formatMoney(share, sym)}</Badge>
                  <Badge tone="success">{formatMoney(net, sym)}</Badge>
                  {can("teachers.manage") && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tc)} title={t("action.edit")}><Pencil className="h-4 w-4 text-muted hover:text-ink" /></Button>
                      {canDelete() && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmTeacher(tc)} title={lang === "ar" ? "حذف" : "Delete"}><Trash2 className="h-4 w-4 text-rose-500 hover:text-rose-600" /></Button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-line/80 shadow-sm rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-elevated/40 text-[11px] font-bold uppercase text-faint">
                  <th className="px-4 py-3.5 text-start font-bold">{lang === "ar" ? "الكود" : "Code"}</th>
                  <th className="px-4 py-3.5 text-start font-bold">{t("teachers.name")}</th>
                  <th className="px-4 py-3.5 text-start font-bold">{t("teachers.subjects")}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{t("students.title")}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{t("classes.groups")}</th>
                  <th className="px-4 py-3.5 text-end font-bold">{t("teachers.centerShare")}</th>
                  <th className="px-4 py-3.5 text-end font-bold">{t("teachers.netIncome")}</th>
                  {can("teachers.manage") && <th className="px-4 py-3.5 text-end font-bold">{lang === "ar" ? "الإجراءات" : "Actions"}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tc) => {
                  const net = teacherNet(db, tc);
                  const share = teacherCenterShare(db, tc);
                  return (
                    <tr key={tc.id} className="border-b border-line/40 last:border-0 hover:bg-elevated/20 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-brand-600">{tc.id}</td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setDetail(tc)} className="flex items-center gap-2.5 text-start">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-inner" style={{ background: `linear-gradient(135deg, ${tc.color ?? "#6366f1"}, #4f46e5)` }}>{tc.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                          <span className="font-bold text-ink hover:text-brand-600">
                            {tc.name}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">{tc.subjects.slice(0, 2).map((s) => <Badge key={s} tone="violet">{subjectLabel(s, lang)}</Badge>)}{tc.subjects.length > 2 && <Badge tone="neutral">+{tc.subjects.length - 2}</Badge>}</div>
                      </td>
                      <td className="px-4 py-3.5 text-center text-ink font-semibold">{studentsOfTeacher(db, tc.id).length}</td>
                      <td className="px-4 py-3.5 text-center text-ink font-semibold">{groupsOfTeacher(db, tc.id).length}</td>
                      <td className="px-4 py-3.5 text-end font-extrabold text-amber-600">{formatMoney(share, sym)}</td>
                      <td className="px-4 py-3.5 text-end font-extrabold text-emerald-600">{formatMoney(net, sym)}</td>
                      {can("teachers.manage") && (
                        <td className="px-4 py-3.5 text-end">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tc)} title={t("action.edit")}><Pencil className="h-4 w-4 text-muted hover:text-ink" /></Button>
                            {canDelete() && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmTeacher(tc)} title={lang === "ar" ? "حذف" : "Delete"}><Trash2 className="h-4 w-4 text-rose-500 hover:text-rose-600" /></Button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* create / edit */}
      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? t("teachers.edit") : t("teachers.new")} size="lg"
        footer={<><Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("action.cancel")}</Button>
          <Button onClick={save} disabled={!form.subjects.length}>{t("action.save")}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("teachers.name")} required><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label={t("students.phone")}><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label={t("teachers.email")}><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>

          {/* searchable localized subject picker */}
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                {t("teachers.subjects")}
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-faint">{form.subjects.length} {t("teachers.subjects")}</span>
            </div>
            {form.subjects.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.subjects.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    {subjectLabel(s, lang)}
                    <button type="button" onClick={() => set("subjects", form.subjects.filter((x) => x !== s))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <MultiCombobox
              selected={form.subjects}
              onChange={(v: string[]) => set("subjects", v)}
              options={subjectOptions}
              placeholder={t("teachers.addSubject")}
              searchLabel={t("combo.search")}
              selectedLabel={() => t("teachers.addSubject")}
              emptyLabel={t("combo.none")}
              allowCustom
              addLabel={t("teachers.addSubject")}
            />
          </div>

          {/* payment model */}
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-xs font-semibold text-ink">{t("teachers.payType")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set("payType", "percentage")}
                className={cn("rounded-lg border p-2.5 text-start transition", form.payType === "percentage" ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15" : "border-line hover:bg-elevated")}>
                <p className="text-xs font-semibold text-ink">{t("teachers.pay.percentage")}</p>
                <p className="text-[10px] text-muted">{t("teachers.centerShare")} %</p>
              </button>
              <button type="button" onClick={() => set("payType", "fixed")}
                className={cn("rounded-lg border p-2.5 text-start transition", form.payType === "fixed" ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15" : "border-line hover:bg-elevated")}>
                <p className="text-xs font-semibold text-ink">{t("teachers.pay.fixed")}</p>
                <p className="text-[10px] text-muted">{sym}</p>
              </button>
            </div>
            {form.payType === "percentage" ? (
              <Field label={t("teachers.centerShare") + " (%)"} className="mt-3"><Input type="number" value={form.commissionRate} onChange={(e) => set("commissionRate", +e.target.value)} /></Field>
            ) : (
              <Field label={t("teachers.pay.fixed") + ` (${sym})`} className="mt-3"><Input type="number" value={form.fixedAmount} onChange={(e) => set("fixedAmount", +e.target.value)} /></Field>
            )}
          </div>
        </div>
      </Modal>

      {/* Teacher deletion / archive warning modal */}
      <Modal
        open={!!deleteConfirmTeacher}
        onClose={() => setDeleteConfirmTeacher(null)}
        title={lang === "ar" ? "⚠️ تحذير: حذف / أرشفة المعلم" : "⚠️ Warning: Delete / Archive Teacher"}
        size="md"
        footer={
          <div className="flex w-full justify-between gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmTeacher(null)}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="subtle"
                onClick={() => {
                  if (deleteConfirmTeacher) {
                    upsert("teachers", { ...deleteConfirmTeacher, isArchived: true, lastUpdated: Date.now() });
                    pushToast(lang === "ar" ? "تم نقل المعلم إلى الأرشيف بنجاح" : "Teacher moved to archive successfully");
                    setDeleteConfirmTeacher(null);
                  }
                }}
              >
                {lang === "ar" ? "نقل للأرشيف 📦" : "Move to Archive 📦"}
              </Button>
              <Button
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                onClick={() => {
                  if (deleteConfirmTeacher) {
                    remove("teachers", deleteConfirmTeacher.id);
                    pushToast(lang === "ar" ? "تم حذف المعلم نهائياً بنجاح" : "Teacher permanently deleted");
                    setDeleteConfirmTeacher(null);
                  }
                }}
              >
                {lang === "ar" ? "حذف نهائي ❌" : "Delete Permanently ❌"}
              </Button>
            </div>
          </div>
        }
      >
        {deleteConfirmTeacher && (() => {
          const hasPayments = db.payments.some(p => p.teacherId === deleteConfirmTeacher.id);
          const hasStudents = db.students.some(s => s.teachers.some(tr => tr.teacherId === deleteConfirmTeacher.id));
          const hasGroups = db.groups.some(g => g.teacherId === deleteConfirmTeacher.id);
          const needsArchive = hasPayments || hasStudents || hasGroups;

          return (
            <div className="space-y-4 py-2 text-start">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                <div className="text-sm leading-relaxed">
                  <p className="font-bold text-base mb-1">
                    {lang === "ar" ? `هل أنت متأكد من حذف المعلم: ${deleteConfirmTeacher.name}؟` : `Are you sure you want to delete ${deleteConfirmTeacher.name}?`}
                  </p>
                  <p>
                    {needsArchive 
                      ? (lang === "ar" 
                        ? "تحذير: لا يمكن حذف هذا المعلم نهائياً لأن لديه سجلات مرتبطة به (فواتير، طلاب، أو مجموعات). نوصي بشدة بنقله إلى الأرشيف لإخفائه من القوائم النشطة مع الحفاظ على البيانات المالية وسجلات الحضور والغياب للطلاب." 
                        : "Warning: This teacher has associated records (payments, students, or groups). We highly recommend moving them to the Archive instead to hide them from active lists while preserving students' historical financial and attendance records.")
                      : (lang === "ar"
                        ? "انتبه: الحذف النهائي سيقوم بإزالة هذا المعلم نهائياً من قاعدة البيانات. بدلاً من ذلك، يمكنك نقله للأرشيف لإخفائه مؤقتاً."
                        : "Warning: Permanent deletion will completely remove this teacher from the database. Alternatively, you can move them to the Archive to hide them temporarily.")}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg bg-elevated/40 p-3 text-xs text-muted">
                <div className="flex justify-between border-b border-line/60 pb-1.5 font-semibold">
                  <span>{lang === "ar" ? "اسم المعلم:" : "Teacher Name:"}</span>
                  <span className="text-ink">{deleteConfirmTeacher.name}</span>
                </div>
                <div className="flex justify-between border-b border-line/60 pb-1.5">
                  <span>{lang === "ar" ? "كود المعلم:" : "Teacher ID:"}</span>
                  <span className="font-mono font-semibold text-ink">{deleteConfirmTeacher.id}</span>
                </div>
                <div className="flex justify-between border-b border-line/60 pb-1.5">
                  <span>{lang === "ar" ? "الطلاب التابعين له:" : "Linked Students:"}</span>
                  <span className="font-semibold text-brand-600">{studentsOfTeacher(db, deleteConfirmTeacher.id).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === "ar" ? "المجموعات المرتبطة به:" : "Linked Groups:"}</span>
                  <span className="font-semibold text-violet-600">{groupsOfTeacher(db, deleteConfirmTeacher.id).length}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

/* --------------------------- Full teacher page --------------------------- */
function TeacherDetailPage({ teacher, onBack }: { teacher: Teacher; onBack: () => void }) {
  const { db, t, lang, upsert, can } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Teacher>({ ...teacher });

  const openEdit = () => {
    setEditForm({ ...teacher, subjects: [...(teacher.subjects ?? [])] });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editForm.name.trim() || !editForm.subjects.length) return;
    upsert("teachers", editForm);
    pushToast(t("toast.saved"));
    setEditOpen(false);
  };

  const setEditField = <K extends keyof Teacher>(k: K, v: Teacher[K]) => setEditForm((f) => ({ ...f, [k]: v }));
  const subjectOptions = SUBJECTS.map((s) => ({ value: s, label: subjectLabel(s, lang) }));

  const sym = currencySymbol(db);
  const rev = teacherRevenue(db, teacher.id);
  const share = teacherCenterShare(db, teacher);
  const net = teacherNet(db, teacher);
  const students = studentsOfTeacher(db, teacher.id);
  const groups = groupsOfTeacher(db, teacher.id);
  const payments = useMemo(
    () => [...db.payments].filter((p) => p.teacherId === teacher.id && p.notes !== "__payout__").sort((a, b) => b.date - a.date).slice(0, 10),
    [db.payments, teacher.id],
  );
  const payouts = useMemo(
    () => [...db.payments].filter((p) => p.notes === "__payout__" && p.teacherId === teacher.id).sort((a, b) => b.date - a.date).slice(0, 20),
    [db.payments, teacher.id],
  );
  const totalPayouts = useMemo(() => payouts.reduce((s, p) => s + p.amount, 0), [payouts]);
  const outstanding = net - totalPayouts;
  const sessions = useMemo(
    () => db.scheduleEvents
      .filter((e) => groups.some((g) => g.id === e.groupId))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    [db.scheduleEvents, groups],
  );
  const DAY_KEY: Record<number, string> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun" };
  const [noteText, setNoteText] = useState("");

  const [viewTab, setViewTab] = useState("overview");
  const [stuSearch, setStuSearch] = useState("");
  const [stuGrade, setStuGrade] = useState("");
  const [stuLimit, setStuLimit] = useState(20);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");

  const filteredStudents = useMemo(() => {
    const q = stuSearch.toLowerCase().trim();
    return students
      .filter((s) => (!stuGrade || s.grade === stuGrade) && (!q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, stuSearch, stuGrade]);
  const teacherGrades = useMemo(
    () => Array.from(new Set(students.map((s) => s.grade).filter(Boolean))),
    [students],
  );

  // timestamped notes log (persists on the teacher record)
  const teacherNotes = useMemo(
    () => [...(teacher.notesList ?? [])].sort((a, b) => b.date - a.date),
    [teacher.notesList],
  );
  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const note = { id: uid("tnote"), text, date: now() };
    upsert("teachers", {
      ...teacher,
      notesList: [...(teacher.notesList ?? []), note],
      lastUpdated: now(),
    });
    setNoteText("");
    pushToast(t("toast.sent"));
  };
  const deleteNote = (id: string) => {
    upsert("teachers", {
      ...teacher,
      notesList: (teacher.notesList ?? []).filter((n) => n.id !== id),
      lastUpdated: now(),
    });
  };

  const recordPayout = () => {
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) return;
    upsert("payments", {
      id: uid("pay"),
      studentId: "",
      amount: amt,
      date: Date.now(),
      type: "OTHER",
      month: new Date().toISOString().slice(0, 7),
      teacherId: teacher.id,
      forCenter: false,
      notes: "__payout__",
      lastUpdated: now(),
    });
    setPayoutAmount("");
    setPayoutOpen(false);
    pushToast(t("toast.saved"));
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" onClick={onBack} className="bg-surface border border-line shadow-sm text-muted hover:text-ink">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <div>
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-0.5 rounded border border-brand-200/20">{teacher.id}</span>
          <h1 className="text-xl font-bold text-ink mt-0.5">{teacher.name}</h1>
        </div>
      </div>

      {/* header hero */}
      <Card className="overflow-hidden border border-line shadow-md">
        <div className="relative flex flex-col md:flex-row md:items-center gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute left-10 bottom-0 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl" />
          
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-brand-300 shadow-inner border border-white/10">
            {teacher.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>

          <div className="relative min-w-0 flex-1">
            <h2 className="text-2xl font-black tracking-tight text-white">{teacher.name}</h2>
            
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
              {teacher.phone && (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Phone className="h-3.5 w-3.5 text-brand-400" />
                  {teacher.phone}
                </span>
              )}
              {teacher.email && (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Mail className="h-3.5 w-3.5 text-brand-400" />
                  {teacher.email}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {teacher.subjects.map((s) => (
                <span key={s} className="rounded-lg bg-white/10 border border-white/5 px-2.5 py-1 text-xs font-bold text-brand-200 backdrop-blur">
                  {subjectLabel(s, lang)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex flex-wrap gap-2 md:self-end">
            {can("teachers.manage") && (
              <Button size="sm" variant="secondary" onClick={openEdit} className="bg-white/10 text-white border-0 hover:bg-white/20 flex items-center gap-1.5 font-bold">
                <Pencil className="h-4 w-4" />{lang === "ar" ? "تعديل البيانات" : "Edit Profile"}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => exportTeacherStudents(db, teacher, lang)} className="bg-white/10 text-white border-0 hover:bg-white/20">
              <FileDown className="h-4 w-4" />{t("teachers.exportStudents")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportTeacherFinancial(db, teacher, lang)} className="bg-white/10 text-white border-0 hover:bg-white/20">
              <FileDown className="h-4 w-4" />{t("teachers.exportFinancial")}
            </Button>
          </div>
        </div>
      </Card>
      
      <Tabs 
        active={viewTab} 
        onChange={setViewTab} 
        tabs={[
          { id: "overview", label: lang === "ar" ? "نظرة عامة" : "Overview", icon: <UsersRound className="h-4 w-4" /> },
          { id: "ledger", label: lang === "ar" ? "محفظة الحسابات" : "Ledger", icon: <Wallet className="h-4 w-4" /> }
        ]} 
      />
      
      {viewTab === "overview" ? (
        <div className="animate-fade-in space-y-6">

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t("students.title"), value: String(students.length), color: "text-brand-600 bg-brand-50/50 border-brand-100" },
          { label: t("classes.groups"), value: String(groups.length), color: "text-indigo-600 bg-indigo-50/50 border-indigo-100" },
          { label: t("teachers.revenue"), value: formatMoney(rev, sym), color: "text-slate-800 bg-slate-50/50 border-slate-100" },
          { label: t("teachers.centerShare"), value: formatMoney(share, sym), color: "text-amber-600 bg-amber-50/50 border-amber-100" },
          { label: t("teachers.netIncome"), value: formatMoney(net, sym), color: "text-emerald-600 bg-emerald-50/50 border-emerald-100" },
          { label: lang === "ar" ? "المستحقات المتبقية" : "Outstanding", value: formatMoney(outstanding, sym), color: outstanding > 0 ? "text-rose-600 bg-rose-50/50 border-rose-100" : "text-muted bg-surface/50 border-line" }
        ].map((k) => (
          <div key={k.label} className={cn("rounded-xl border p-3.5 text-center shadow-sm", k.color)}>
            <p className="text-base font-extrabold tracking-tight truncate">{k.value}</p>
            <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* left column: groups, sessions, student rosters */}
        <div className="space-y-5 lg:col-span-2">
          {/* groups & sessions */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Card className="p-4 border border-line shadow-sm">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink border-b border-line/40 pb-2">
                <UsersRound className="h-4 w-4 text-brand-600" />
                {t("classes.groups")} ({groups.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pe-1">
                {groups.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted font-medium">{t("classes.emptyGroups")}</p>
                ) : (
                  groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 p-2.5 text-xs hover:border-line/100 transition">
                      <span className="min-w-0 flex-1 truncate font-bold text-ink">{g.name}</span>
                      <Badge tone="neutral">{gradeLabel(g.grade, lang)}</Badge>
                      <Badge tone="brand">{db.students.filter((s) => s.groupIds.includes(g.id)).length}</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4 border border-line shadow-sm">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink border-b border-line/40 pb-2">
                <CalendarRange className="h-4 w-4 text-brand-600" />
                {t("teachers.sessions")} ({sessions.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pe-1">
                {sessions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted font-medium">{t("schedule.empty")}</p>
                ) : (
                  sessions.map((e) => {
                    const g = db.groups.find((x) => x.id === e.groupId);
                    const room = db.classrooms.find((c) => c.id === e.classroomId);
                    return (
                      <div key={e.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 p-2.5 text-xs hover:border-line/100 transition">
                        <span className="w-12 shrink-0 font-extrabold text-brand-600">{t(`schedule.days.${DAY_KEY[e.dayOfWeek]}`)}</span>
                        <span className="min-w-0 flex-1 truncate text-muted font-medium">{g?.name ?? "—"}</span>
                        <span className="font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 rounded">{formatTime12(e.startTime, lang)}</span>
                        <span className="hidden text-faint sm:inline font-semibold">{room?.name ?? "—"}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Student Roster */}
          <Card className="overflow-hidden border border-line shadow-md">
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-elevated/40 px-5 py-3.5">
              <span className="text-sm font-bold text-ink">{t("students.title")} ({students.length})</span>
              <div className="ms-auto flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-faint" />
                  <input value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder={t("action.search")} className="h-8 w-36 rounded-lg border border-line bg-surface py-1 ps-8 pe-2 text-xs font-semibold text-ink focus:outline-none focus:border-brand-500 transition" />
                </div>
                <select value={stuGrade} onChange={(e) => setStuGrade(e.target.value)} className="h-8 max-w-[140px] rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-ink focus:outline-none focus:border-brand-500 transition">
                  <option value="">{t("students.filter.all")}</option>
                  {teacherGrades.map((g) => <option key={g} value={g}>{gradeLabel(g, lang)}</option>)}
                </select>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-line/40">
              {filteredStudents.slice(0, stuLimit).map((s) => {
                const fee = s.teachers.find((x) => x.teacherId === teacher.id)?.fee ?? 0;
                const paid = paidForTeacher(db, s.id, teacher.id);
                const pst = studentPaymentStatus(db, s);
                return (
                  <div key={s.id} className="flex items-center gap-2 px-5 py-3 text-xs hover:bg-elevated/25 transition">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink font-bold">
                      <span className="truncate">{s.name}</span>
                      <EnrollmentBadge student={s} lang={lang} onlyPrivate />
                    </span>
                    <span className="hidden text-faint sm:inline font-semibold">{gradeLabel(s.grade, lang)}</span>
                    <span className="text-muted font-bold">{formatMoney(fee, sym)}</span>
                    <Badge tone={paid >= fee && fee > 0 ? "success" : "warning"}>{formatMoney(paid, sym)}</Badge>
                    <PaymentStatusBadge status={pst} lang={lang} exempt={s.isExempt} />
                  </div>
                );
              })}
              {filteredStudents.length === 0 && <p className="py-8 text-center text-xs text-muted font-medium">{t("combo.none")}</p>}
            </div>
            {filteredStudents.length > stuLimit && (
              <button onClick={() => setStuLimit((l) => l + 20)} className="w-full border-t border-line py-2.5 text-xs font-bold text-brand-600 hover:bg-elevated transition">
                {t("action.all")} ({filteredStudents.length - stuLimit}+)
              </button>
            )}
          </Card>

          {/* recent financial payments collected for this teacher */}
          <Card className="overflow-hidden border border-line shadow-md">
            <div className="border-b border-line bg-elevated/40 px-5 py-3 text-sm font-bold text-ink">{t("dash.recentActivity")} ({t("fin.fee")})</div>
            <div className="max-h-64 overflow-y-auto divide-y divide-line/30">
              {payments.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted font-medium">{t("fin.empty")}</p>
              ) : (
                payments.map((p) => {
                  const st = db.students.find((s) => s.id === p.studentId);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-xs hover:bg-elevated/10 transition">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink font-bold">{st?.name ?? "—"}</p>
                        <p className="text-[10px] text-faint font-semibold mt-0.5">{new Date(p.date).toLocaleDateString()}</p>
                      </div>
                      <span className="text-faint font-mono font-bold">{p.month}</span>
                      <span className="font-extrabold text-emerald-600">+{formatMoney(p.amount, sym)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* right column: Wallet, payouts and sticky notes */}
        <div className="space-y-5">
          {/* Wallet and payouts */}
          <Card className="overflow-hidden border border-line shadow-md">
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-5 text-white">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide">{t("teachers.payout")}</h3>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 border border-white/5 p-3 text-center backdrop-blur shadow-sm">
                  <p className="text-xl font-black">{formatMoney(net, sym)}</p>
                  <p className="text-[10px] text-white/80 font-bold mt-1 uppercase tracking-wide">{t("teachers.netIncome")}</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/5 p-3 text-center backdrop-blur shadow-sm">
                  <p className="text-xl font-black">{formatMoney(outstanding, sym)}</p>
                  <p className="text-[10px] text-white/80 font-bold mt-1 uppercase tracking-wide">{t("teachers.remaining")}</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-surface">
              <Button className="w-full font-bold shadow-sm" onClick={() => setPayoutOpen(true)} disabled={outstanding <= 0}>
                <Wallet className="h-4 w-4" />{t("teachers.payNow")}
              </Button>
              
              {payouts.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-line/50 pt-3">
                  <p className="text-xs font-bold text-ink">{t("teachers.payoutHistory")}</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
                    {payouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-line bg-surface/50 px-3 py-2 text-xs">
                        <span className="text-muted font-semibold">{p.date ? new Date(p.date).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US") : "—"}</span>
                        <span className="font-extrabold text-rose-600">-{formatMoney(p.amount, sym)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Teacher Notes */}
          <Card className="flex h-fit flex-col p-4 border border-line shadow-md">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink border-b border-line/40 pb-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              {t("teacher.note")} {teacherNotes.length > 0 && <span className="text-faint">({teacherNotes.length})</span>}
            </h3>
            <Textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t("teachers.addNote")} className="resize-y text-xs font-semibold" />
            <Button className="mt-2.5 self-end font-bold" size="sm" onClick={addNote} disabled={!noteText.trim()}>
              <Send className="h-3.5 w-3.5 rtl:rotate-180" />{t("teachers.addNote")}
            </Button>
            
            {teacherNotes.length > 0 && (
              <div className="mt-4 max-h-64 space-y-2.5 overflow-y-auto pe-1 border-t border-line/40 pt-3">
                {teacherNotes.map((n) => (
                  <div key={n.id} className="group flex items-start gap-2.5 rounded-xl border border-line bg-surface/50 p-3 hover:border-line/100 transition">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs text-ink font-semibold leading-relaxed">{n.text}</p>
                      <p className="mt-1.5 text-[10px] text-faint font-bold">{new Date(n.date).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                    <button onClick={() => deleteNote(n.id)} className="shrink-0 text-faint opacity-0 transition hover:text-rose-500 group-hover:opacity-100" title={t("action.delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      
        </div>
      ) : (
        <div className="animate-fade-in space-y-6">
          <Card className="p-4 border border-line">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{lang === "ar" ? "تفاصيل المحفظة المالية" : "Financial Ledger"}</h3>
                <div className="flex gap-4">
                   <div className="text-end">
                      <p className="text-xs text-muted uppercase tracking-wider">{lang === "ar" ? "الدخل الكلي" : "Total Revenue"}</p>
                      <p className="font-mono font-bold text-brand-600">{formatMoney(rev, sym)}</p>
                   </div>
                   <div className="text-end">
                      <p className="text-xs text-muted uppercase tracking-wider">{lang === "ar" ? "حصة المعلم" : "Teacher Net"}</p>
                      <p className="font-mono font-bold text-emerald-600">{formatMoney(net, sym)}</p>
                   </div>
                   <div className="text-end">
                      <p className="text-xs text-muted uppercase tracking-wider">{lang === "ar" ? "المتبقي" : "Outstanding"}</p>
                      <p className="font-mono font-bold text-rose-600">{formatMoney(outstanding, sym)}</p>
                   </div>
                </div>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-start">
                 <thead>
                   <tr className="border-b border-line text-[11px] uppercase text-faint">
                     <th className="px-4 py-3 font-semibold text-start">{lang === "ar" ? "التاريخ" : "Date"}</th>
                     <th className="px-4 py-3 font-semibold text-start">{lang === "ar" ? "الطالب" : "Student"}</th>
                     <th className="px-4 py-3 font-semibold text-start">{lang === "ar" ? "النوع" : "Type"}</th>
                     <th className="px-4 py-3 font-semibold text-end">{lang === "ar" ? "المبلغ (إجمالي)" : "Amount (Total)"}</th>
                     <th className="px-4 py-3 font-semibold text-end">{lang === "ar" ? "حصة المعلم" : "Teacher Share"}</th>
                     <th className="px-4 py-3 font-semibold text-end">{lang === "ar" ? "حصة السنتر" : "Center Share"}</th>
                   </tr>
                 </thead>
                 <tbody>
                   {payments.map(p => {
                     const st = db.students.find(s => s.id === p.studentId);
                     const cShare = teacher.payType === "fixed" ? p.amount : (p.amount * (teacher.commissionRate || 0)) / 100;
                     const tShare = teacher.payType === "fixed" ? 0 : p.amount - cShare;
                     return (
                       <tr key={p.id} className="border-b border-line/40 hover:bg-elevated/30">
                         <td className="px-4 py-3 text-faint">{new Date(p.date).toLocaleDateString()}</td>
                         <td className="px-4 py-3 font-medium text-ink">{st?.name || "—"}</td>
                         <td className="px-4 py-3 text-muted">{p.type}</td>
                         <td className="px-4 py-3 text-end font-mono">{formatMoney(p.amount, sym)}</td>
                         <td className="px-4 py-3 text-end font-mono text-emerald-600 font-medium">{formatMoney(tShare, sym)}</td>
                         <td className="px-4 py-3 text-end font-mono text-rose-600">{formatMoney(cShare, sym)}</td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </Card>
        </div>
      )}
{/* payout modal */}
      <Modal open={payoutOpen} onClose={() => setPayoutOpen(false)}
        title={t("teachers.payNow")} size="sm"
        footer={<><Button variant="secondary" onClick={() => setPayoutOpen(false)}>{t("action.cancel")}</Button>
          <Button onClick={recordPayout} disabled={!payoutAmount || Number(payoutAmount) <= 0}>{t("action.save")}</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("teachers.payoutDesc")}</p>
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <Wallet className="h-5 w-5 shrink-0" />
            <span>{t("teachers.outstandingLabel")}: <b>{formatMoney(outstanding, sym)}</b></span>
          </div>
          <Input type="number" inputMode="decimal" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
            placeholder="0" autoFocus />
        </div>
      </Modal>

      {/* Edit Teacher Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title={t("teachers.edit")} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>{t("action.cancel")}</Button>
          <Button onClick={saveEdit} disabled={!editForm.subjects.length}>{t("action.save")}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("teachers.name")} required><Input value={editForm.name} onChange={(e) => setEditField("name", e.target.value)} /></Field>
            <Field label={t("students.phone")}><Input value={editForm.phone} onChange={(e) => setEditField("phone", e.target.value)} /></Field>
            <Field label={t("teachers.email")}><Input type="email" value={editForm.email} onChange={(e) => setEditField("email", e.target.value)} /></Field>
          </div>

          {/* subjects selector */}
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                {t("teachers.subjects")}
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-faint">{editForm.subjects.length} {t("teachers.subjects")}</span>
            </div>
            {editForm.subjects.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {editForm.subjects.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    {subjectLabel(s, lang)}
                    <button type="button" onClick={() => setEditField("subjects", editForm.subjects.filter((x) => x !== s))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <MultiCombobox
              selected={editForm.subjects}
              onChange={(v: string[]) => setEditField("subjects", v)}
              options={subjectOptions}
              placeholder={t("teachers.addSubject")}
              searchLabel={t("combo.search")}
              selectedLabel={() => t("teachers.addSubject")}
              emptyLabel={t("combo.none")}
              allowCustom
              addLabel={t("teachers.addSubject")}
            />
          </div>

          {/* payment model */}
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-xs font-semibold text-ink">{t("teachers.payType")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditField("payType", "percentage")}
                className={cn("rounded-lg border p-2.5 text-start transition", editForm.payType === "percentage" ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15" : "border-line hover:bg-elevated")}>
                <p className="text-xs font-semibold text-ink">{t("teachers.pay.percentage")}</p>
                <p className="text-[10px] text-muted">{t("teachers.centerShare")} %</p>
              </button>
              <button type="button" onClick={() => setEditField("payType", "fixed")}
                className={cn("rounded-lg border p-2.5 text-start transition", editForm.payType === "fixed" ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15" : "border-line hover:bg-elevated")}>
                <p className="text-xs font-semibold text-ink">{t("teachers.pay.fixed")}</p>
                <p className="text-[10px] text-muted">{sym}</p>
              </button>
            </div>
            {editForm.payType === "percentage" ? (
              <Field label={t("teachers.centerShare") + " (%)"} className="mt-3"><Input type="number" value={editForm.commissionRate} onChange={(e) => setEditField("commissionRate", +e.target.value)} /></Field>
            ) : (
              <Field label={t("teachers.pay.fixed") + ` (${sym})`} className="mt-3"><Input type="number" value={editForm.fixedAmount} onChange={(e) => setEditField("fixedAmount", +e.target.value)} /></Field>
            )}
          </div>
        </div>
      </Modal>
     </div>
    );
}

