import { useMemo, useState, useEffect } from "react";
import {
  Plus, Trash2, Wallet, TrendingUp, TrendingDown, ArrowUpRight, Building2, FileText, Download, History,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader, Button, Card, Input, Select, Textarea, Field, Badge, Modal, Tabs, EmptyState, pushToast,
} from "../components/ui";
import { Combobox } from "../components/ui";
import { StatCard } from "../components/widgets";
import { cn } from "../utils/cn";
import type { Payment, Expense, PaymentType, ExpenseCategory } from "../lib/types";
import { now, startOfDay, monthKey } from "../lib/db";
import {
  monthlyRevenue, monthlyExpenses, monthlyCenterIncome, paymentTarget,
  currencySymbol, formatMoney, shiftMonth, liableMonthsFor, isMonthPaid
} from "../lib/analytics";
import { exportFinancePdf, exportFinanceExcel } from "../lib/reports";

const PAY_TYPES: PaymentType[] = ["MONTHLY_FEE", "EXAM_FEE", "BOOKS", "CENTER_SUBSCRIPTION", "OTHER"];
const EXP_CATS: ExpenseCategory[] = ["Rent", "Salaries", "Electricity", "Internet", "Tools", "Teachers", "Other"];

export function Finance() {
  const { db, t, lang, can } = useApp();
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const [tab, setTab] = useState("payments");
  const totalCollected = useMemo(() => monthlyRevenue(db), [db]);
  const centerIncome = useMemo(() => monthlyCenterIncome(db), [db]);
  const teacherRevenues = totalCollected - centerIncome;
  const expenses = useMemo(() => monthlyExpenses(db), [db]);
  const net = centerIncome - expenses;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t("fin.title")}
        subtitle={t("fin.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportFinancePdf(db, lang)}
              className="flex items-center gap-1.5"
            >
              <FileText className="h-4 w-4 text-rose-500" />
              <span>{isAr ? "تقرير PDF" : "PDF Report"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportFinanceExcel(db)}
              className="flex items-center gap-1.5"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span>{isAr ? "تقرير Excel" : "Excel Report"}</span>
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Building2} tone="emerald" label={isAr ? "دخل السنتر" : "Center Income"} value={formatMoney(centerIncome, sym)} sub={monthKey(now())} />
        <StatCard icon={Wallet} tone="sky" label={isAr ? "مستحقات المعلمين" : "Teacher Rev"} value={formatMoney(teacherRevenues, sym)} sub={monthKey(now())} />
        <StatCard icon={ArrowUpRight} tone="rose" label={t("fin.outcome")} value={formatMoney(expenses, sym)} sub={monthKey(now())} />
        <StatCard icon={TrendingUp} tone={net >= 0 ? "brand" : "rose"} label={t("dash.netProfit")} value={formatMoney(net, sym)} />
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "payments", label: t("fin.payments"), icon: <TrendingUp className="h-4 w-4" /> },
        { id: "expenses", label: t("fin.expenses"), icon: <TrendingDown className="h-4 w-4" /> },
        ...(can("finance.manage") ? [{ id: "audit", label: lang === "ar" ? "سجل التعديلات" : "Audit Logs", icon: <History className="h-4 w-4" /> }] : [])
      ]} />
      {tab === "payments" ? <Payments /> : tab === "expenses" ? <Expenses /> : <AuditLogs />}
    </div>
  );
}

function Payments() {
  const { db, t, lang, upsert, remove, can } = useApp();
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<Payment>({
      id: "", studentId: "", amount: 0, date: startOfDay(now()),
      type: "MONTHLY_FEE", month: monthKey(now()), teacherId: undefined, forCenter: false, notes: "", lastUpdated: now(),
    });
    const [monthMode, setMonthMode] = useState<"this" | "other">("this");
    const [err, setErr] = useState("");

    const studentOptions = useMemo(
      () => db.students.map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` })),
      [db.students],
    );
    const selectedStudent = db.students.find((s) => s.id === form.studentId);
    const isCenter = form.type === "CENTER_SUBSCRIPTION";
    const isOther = form.type === "OTHER";
    const defaultDueMonth =
      selectedStudent && selectedStudent.paymentType === "deferred"
        ? shiftMonth(monthKey(now()), -1)
        : monthKey(now());

    const dueMonth = useMemo(() => {
      if (!selectedStudent) return defaultDueMonth;
      const months = liableMonthsFor(selectedStudent);
      const unpaid = months.filter((m) => !isMonthPaid(db, selectedStudent, m));
      return unpaid.length > 0 ? unpaid[0] : defaultDueMonth;
    }, [selectedStudent, db, defaultDueMonth]);

    const openCreate = () => {
      setForm({ id: "", studentId: "", amount: 0, date: startOfDay(now()), type: "MONTHLY_FEE", month: monthKey(now()), teacherId: undefined, forCenter: false, notes: "", lastUpdated: now() });
      setMonthMode("this"); setErr(""); setOpen(true);
    };
    const pickStudent = (id: string) => {
      const s = db.students.find((x) => x.id === id);
      setForm((f) => ({ ...f, studentId: id, amount: s && !s.isExempt ? s.teachers[0]?.fee ?? f.amount : f.amount, teacherId: s?.teachers[0]?.teacherId }));
    };
    const save = () => {
      setErr("");
      if (!form.studentId || form.amount <= 0) { setErr(t("misc.required")); return; }
      if (isOther && !form.notes?.trim()) { setErr(t("fin.otherRequired")); return; }
      const month = monthMode === "this" ? dueMonth : form.month;
      upsert("payments", { ...form, amount: Math.round(form.amount), month, teacherId: isCenter ? undefined : form.teacherId, forCenter: isCenter });
      pushToast(t("toast.saved"));
      setOpen(false);
    };
    const set = <K extends keyof Payment>(k: K, v: Payment[K]) => setForm((f) => ({ ...f, [k]: v }));

      const list = useMemo(() => [...db.payments].sort((a, b) => b.date - a.date), [db.payments]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const displayedPayments = useMemo(() => list.slice(0, page * pageSize), [list, page]);
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        setPage((p) => p + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-3">
          <h3 className="text-sm font-semibold text-ink">{t("fin.payments")}</h3>
          {can("finance.manage") && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t("fin.newPayment")}</Button>}
        </div>
        {list.length === 0 ? <div className="p-6"><EmptyState title={t("fin.empty")} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                <th className="px-4 py-2.5 text-start font-semibold">{t("students.name")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("fin.paidTo")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("fin.type")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("fin.month")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{isAr ? "المسجل" : "Recorded By"}</th>
                <th className="px-4 py-2.5 text-end font-semibold">{t("fin.amount")}</th>
                <th className="px-4 py-2.5 text-end font-semibold">{isAr ? "الرصيد" : "Balance"}</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {displayedPayments.map((p) => {
                  const s = db.students.find((x) => x.id === p.studentId);
                  return (
                    <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                      <td className="px-4 py-2.5 font-medium text-ink">{s?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {p.forCenter || !p.teacherId
                          ? <Badge tone="info"><Building2 className="h-3 w-3" />{t("fin.toCenter")}</Badge>
                          : <Badge tone="violet">{paymentTarget(db, p)}</Badge>}
                      </td>
                      <td className="px-4 py-2.5"><Badge tone="success">{t(`fin.type.${p.type}`)}</Badge></td>
                      <td className="px-4 py-2.5 text-muted">{p.month}</td>
                      <td className="px-4 py-2.5 text-xs text-muted font-medium">{p.recordedBy || (isAr ? "المالك" : "OWNER")}</td>
                      <td className="px-4 py-2.5 text-end font-bold text-emerald-600">+{formatMoney(p.amount, sym)}</td>
                      <td className="px-4 py-2.5 text-end font-semibold text-xs text-brand-600">
                        {p.safeBalance !== undefined ? formatMoney(p.safeBalance, sym) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-end">{can("finance.manage") && <Button variant="ghost" size="icon" onClick={() => remove("payments", p.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title={t("fin.newPayment")} size="lg"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
            <Button onClick={save}>{t("action.save")}</Button></>}>
          <div className="space-y-3">
            {/* autocomplete student search */}
            <Field label={t("students.name")} required>
              <Combobox value={form.studentId} onChange={pickStudent} options={studentOptions}
                placeholder={t("fin.searchStudent")} allowCustom={false}
                searchLabel={t("fin.searchStudent")} emptyLabel={t("fin.noResults")} />
            </Field>

            {/* teacher allocation (hidden for center subscription) */}
            {selectedStudent && !isCenter && (
              <div className="rounded-xl border border-line p-3">
                <p className="mb-2 text-xs font-semibold text-ink">{t("fin.allocate")}</p>
                {selectedStudent.teachers.length > 1 ? (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {selectedStudent.teachers.map((tr) => {
                      const tc = db.teachers.find((x) => x.id === tr.teacherId);
                      const on = form.teacherId === tr.teacherId;
                      return (
                        <button key={tr.teacherId} onClick={() => set("teacherId", tr.teacherId)}
                          className={cn("flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition",
                            on ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                          <span className="truncate">{tc?.name}</span><span className="font-medium">{formatMoney(tr.fee, sym)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-muted">{db.teachers.find((x) => x.id === selectedStudent.teachers[0]?.teacherId)?.name}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={`${t("fin.amountInt")} (${sym})`}><Input type="number" step={1} min={0} value={form.amount} onChange={(e) => set("amount", Math.round(+e.target.value))} /></Field>
              <Field label={t("fin.type")}>
                <Select value={form.type} onChange={(e) => set("type", e.target.value as PaymentType)}>
                  {PAY_TYPES.map((ty) => <option key={ty} value={ty}>{t(`fin.type.${ty}`)}</option>)}
                </Select>
              </Field>
            </div>

            {/* "Other" requires a description */}
            {isOther && (
              <Field label={t("fin.otherRequired")} required>
                <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder={t("fin.otherRequired")} />
              </Field>
            )}

            {/* month picker */}
            <div className="rounded-xl border border-line p-3">
              <p className="mb-2 text-xs font-semibold text-ink">{t("fin.monthPicker")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-ink">
                  <input type="radio" checked={monthMode === "this"} onChange={() => setMonthMode("this")} className="accent-brand-600" />
                  {t("fin.thisMonth")} ({dueMonth})
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-ink">
                  <input type="radio" checked={monthMode === "other"} onChange={() => setMonthMode("other")} className="accent-brand-600" />
                  {t("fin.otherMonth")}
                </label>
                {selectedStudent?.paymentType === "deferred" && (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    مؤخر — يُسجّل للشهر السابق ({dueMonth})
                  </span>
                )}
                {monthMode === "other" && (
                  <Input type="month" value={form.month} onChange={(e) => set("month", e.target.value)} className="w-40" />
                )}
              </div>
            </div>

            {!isOther && (
              <Field label={t("att.date")}><Input type="date" value={new Date(form.date).toISOString().slice(0, 10)} onChange={(e) => set("date", startOfDay(new Date(e.target.value).getTime()))} /></Field>
            )}
            {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
          </div>
        </Modal>
      </Card>
    );
}

function Expenses() {
  const { db, t, lang, staff, upsert, remove, can } = useApp();
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const [open, setOpen] = useState(false);
    const [form, setForm] = useState<Expense>({
      id: "",
      title: "",
      amount: 0,
      category: "Rent",
      date: startOfDay(now()),
      notes: "",
      lastUpdated: now(),
      staffId: "",
      teacherId: "",
    });

    const openCreate = () => {
      setForm({
        id: "",
        title: "",
        amount: 0,
        category: "Rent",
        date: startOfDay(now()),
        notes: "",
        lastUpdated: now(),
        staffId: "",
        teacherId: "",
      });
      setOpen(true);
    };

    const save = () => {
      if (!form.title.trim() || form.amount <= 0) return;
      if (form.category === "Salaries" && !form.staffId) {
        alert(isAr ? "يرجى اختيار الموظف أولاً" : "Please select an employee first");
        return;
      }
      if (form.category === "Teachers" && !form.teacherId) {
        alert(isAr ? "يرجى اختيار المعلم أولاً" : "Please select a teacher first");
        return;
      }
      upsert("expenses", { ...form, amount: Math.round(form.amount) });
      pushToast(t("toast.saved"));
      setOpen(false);
    };

    const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setForm((f) => ({ ...f, [k]: v }));
      const list = useMemo(() => [...db.expenses].sort((a, b) => b.date - a.date), [db.expenses]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const displayedExpenses = useMemo(() => list.slice(0, page * pageSize), [list, page]);
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        setPage((p) => p + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-3">
          <h3 className="text-sm font-semibold text-ink">{t("fin.expenses")}</h3>
          {can("finance.manage") && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t("fin.newExpense")}</Button>}
        </div>
        {list.length === 0 ? <div className="p-6"><EmptyState title={t("fin.empty")} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                <th className="px-4 py-2.5 text-start font-semibold">{t("fin.title2")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("fin.category")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("att.date")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{isAr ? "المسجل" : "Recorded By"}</th>
                <th className="px-4 py-2.5 text-end font-semibold">{t("fin.amount")}</th>
                <th className="px-4 py-2.5 text-end font-semibold">{isAr ? "الرصيد" : "Balance"}</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {displayedExpenses.map((e) => {
                  const expenseStaff = e.staffId ? staff.find((s) => s.uid === e.staffId) : null;
                  const expenseTeacher = e.teacherId ? db.teachers.find((t) => t.id === e.teacherId) : null;
                  return (
                    <tr key={e.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                      <td className="px-4 py-2.5 font-medium text-ink">
                        <div>{e.title}</div>
                        {e.category === "Salaries" && e.staffId && (
                          <div className="text-[11px] text-muted font-normal mt-0.5 flex items-center gap-1">
                            <span>👤 {isAr ? "الموظف:" : "Employee:"}</span>
                            <span className="font-semibold text-brand-600">{expenseStaff?.displayName || (isAr ? "موظف سابق" : "Former staff")}</span>
                          </div>
                        )}
                        {e.category === "Teachers" && e.teacherId && (
                          <div className="text-[11px] text-muted font-normal mt-0.5 flex items-center gap-1">
                            <span>🎓 {isAr ? "المعلم:" : "Teacher:"}</span>
                            <span className="font-semibold text-violet-600">{expenseTeacher?.name || (isAr ? "معلم سابق" : "Former teacher")}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><Badge tone="warning">{t(`fin.cat.${e.category}`)}</Badge></td>
                      <td className="px-4 py-2.5 text-muted">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-xs text-muted font-medium">{e.recordedBy || (isAr ? "المالك" : "OWNER")}</td>
                      <td className="px-4 py-2.5 text-end font-bold text-rose-600">-{formatMoney(e.amount, sym)}</td>
                      <td className="px-4 py-2.5 text-end font-semibold text-xs text-rose-600">
                        {e.safeBalance !== undefined ? formatMoney(e.safeBalance, sym) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-end">{can("finance.manage") && <Button variant="ghost" size="icon" onClick={() => remove("expenses", e.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Modal open={open} onClose={() => setOpen(false)} title={t("fin.newExpense")}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button onClick={save}>{t("action.save")}</Button></>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("fin.category")} className="sm:col-span-2">
              <Select value={form.category} onChange={(e) => {
                const cat = e.target.value as ExpenseCategory;
                setForm(f => ({
                  ...f,
                  category: cat,
                  title: "",
                  amount: 0,
                  staffId: "",
                  teacherId: ""
                }));
              }}>
                {EXP_CATS.map((c) => <option key={c} value={c}>{t(`fin.cat.${c}`)}</option>)}
              </Select>
            </Field>

            {form.category === "Salaries" && (
              <Field label={isAr ? "اختر الموظف" : "Select Employee"} className="sm:col-span-2">
                <Select
                  value={form.staffId || ""}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const selectedStaff = staff.find(s => s.uid === sid);
                    if (selectedStaff) {
                      setForm(f => ({
                        ...f,
                        staffId: sid,
                        title: isAr ? `راتب الموظف: ${selectedStaff.displayName}` : `Salary for: ${selectedStaff.displayName}`,
                        amount: selectedStaff.salary || 0,
                      }));
                    } else {
                      setForm(f => ({ ...f, staffId: "", title: "", amount: 0 }));
                    }
                  }}
                >
                  <option value="">{isAr ? "-- اختر موظف --" : "-- Select Employee --"}</option>
                  {staff.map(s => (
                    <option key={s.uid} value={s.uid}>
                      {s.displayName} {s.title ? `(${s.title})` : ""} - {s.salary || 0} {sym}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {form.category === "Teachers" && (
              <Field label={isAr ? "اختر المعلم" : "Select Teacher"} className="sm:col-span-2">
                <Select
                  value={form.teacherId || ""}
                  onChange={(e) => {
                    const tid = e.target.value;
                    const selectedTeacher = db.teachers.find(t => t.id === tid);
                    if (selectedTeacher) {
                      setForm(f => ({
                        ...f,
                        teacherId: tid,
                        title: isAr ? `مستحقات المعلم: ${selectedTeacher.name}` : `Payment for teacher: ${selectedTeacher.name}`,
                      }));
                    } else {
                      setForm(f => ({ ...f, teacherId: "", title: "" }));
                    }
                  }}
                >
                  <option value="">{isAr ? "-- اختر معلم --" : "-- Select Teacher --"}</option>
                  {db.teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label={t("fin.title2")} className="sm:col-span-2">
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={form.category === "Salaries" ? (isAr ? "راتب الموظف..." : "Employee salary...") : form.category === "Teachers" ? (isAr ? "مستحقات المعلم..." : "Teacher payment...") : "Rent · January"}
              />
            </Field>

            <Field label={`${t("fin.amountInt")} (${sym})`}><Input type="number" step={1} min={0} value={form.amount} onChange={(e) => set("amount", Math.round(+e.target.value))} /></Field>
            <Field label={t("att.date")}><Input type="date" value={new Date(form.date).toISOString().slice(0, 10)} onChange={(e) => set("date", startOfDay(new Date(e.target.value).getTime()))} /></Field>
            <Field label={t("classes.notes")} className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          </div>
        </Modal>
      </Card>
    );
}

function AuditLogs() {
  const { db, lang } = useApp();
  const sym = currencySymbol(db);
  const logs = [...(db.auditLogs || [])].sort((a, b) => b.timestamp - a.timestamp);

  if (logs.length === 0) {
    return (
      <Card className="p-12 text-center">
        <EmptyState icon={<History className="h-8 w-8 text-muted" />} title={lang === "ar" ? "لا توجد تعديلات" : "No Audit Logs"} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase text-faint">
              <th className="px-4 py-2.5 text-start font-semibold">{lang === "ar" ? "الوقت" : "Time"}</th>
              <th className="px-4 py-2.5 text-start font-semibold">{lang === "ar" ? "المستخدم" : "User"}</th>
              <th className="px-4 py-2.5 text-start font-semibold">{lang === "ar" ? "العملية" : "Action"}</th>
              <th className="px-4 py-2.5 text-start font-semibold">{lang === "ar" ? "الجدول" : "Table"}</th>
              <th className="px-4 py-2.5 text-end font-semibold">{lang === "ar" ? "القيمة القديمة" : "Old Amount"}</th>
              <th className="px-4 py-2.5 text-end font-semibold">{lang === "ar" ? "القيمة الجديدة" : "New Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const d = new Date(log.timestamp);
              return (
                <tr key={log.id} className="border-b border-line/60 hover:bg-elevated/40">
                  <td className="px-4 py-3 whitespace-nowrap text-faint">{d.toLocaleDateString()} {d.toLocaleTimeString()}</td>
                  <td className="px-4 py-3 font-medium text-ink">{log.userName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={log.action === "DELETE" ? "danger" : log.action === "CREATE" ? "success" : "brand"}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-faint">{log.table}</td>
                  <td className="px-4 py-3 text-end font-mono">{log.oldAmount !== undefined ? formatMoney(log.oldAmount, sym) : "—"}</td>
                  <td className="px-4 py-3 text-end font-mono">{log.newAmount !== undefined ? formatMoney(log.newAmount, sym) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
