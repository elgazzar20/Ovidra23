import { useMemo, useState } from "react";
import {
  ChevronLeft, ClipboardCheck, Award, Wallet,
  StickyNote, Send, Phone, User, Users2, CalendarClock, FileDown,
  HandCoins, MessageSquare, Pencil, Plus, UserCog, X,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useApp } from "../context/AppContext";
import { Button, Card, Input, Select, Field, Textarea, Badge, EmptyState, Modal, Toggle, Combobox, MultiCombobox, pushToast } from "../components/ui";
import { StatCard } from "../components/widgets";
import { MonthlyAttendance } from "../components/MonthlyAttendance";
import { QRCodeImage } from "../components/QRCode";
import { generateStudentPdf } from "../lib/pdf";
import { getWhatsAppReportUrl } from "../lib/whatsapp";
import type { Student, StudentNote, PaymentType, StudentTeacher } from "../lib/types";
import { now, startOfDay, uid, monthKey } from "../lib/db";
import { GRADES, STAGE_TONE, gradeLabel, subjectLabel } from "../lib/constants";
import { PaymentTypeBadge, EnrollmentBadge, PaymentStatusBadge } from "../components/StudentBadges";
import {
  studentAverage, balanceDue, paidForTeacher,
  studentNetFee, currencySymbol, formatMoney, studentPaymentStatus,
  shiftMonth, studentGroupAttendance, studentMonthAttendance,
  liableMonthsFor, isMonthPaid
} from "../lib/analytics";

const PAY_TYPES: PaymentType[] = ["MONTHLY_FEE", "EXAM_FEE", "BOOKS", "CENTER_SUBSCRIPTION", "OTHER"];
function toDateInput(ts: number) { return new Date(ts).toISOString().slice(0, 10); }

export function StudentProfile({ student, onBack }: { student: Student; onBack: () => void }) {
  const { db, t, lang, upsert, can } = useApp();
  const sym = currencySymbol(db);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Student>({ ...student });

  const gradeOptions = useMemo(() => GRADES.map((g) => ({ value: g.id, label: lang === "ar" ? g.ar : g.en })), [lang]);
  const groupOptions = useMemo(() => db.groups.filter((g) => !g.isArchived).map((g) => ({ value: g.id, label: g.name })), [db.groups]);
  const activeTeachers = useMemo(() => db.teachers.filter((t) => !t.isArchived), [db.teachers]);

  const openEdit = () => {
    setEditForm({ ...student, teachers: (student.teachers ?? []).map((x) => ({ ...x })), groupIds: [...(student.groupIds ?? [])] });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editForm.name.trim() || !editForm.teachers.length) return;
    upsert("students", {
      ...editForm,
      qrCode: editForm.qrCode || `CPD:${editForm.id}`,
      teachers: editForm.teachers.filter((x) => x.teacherId),
      lastUpdated: Date.now()
    });
    pushToast(t("toast.saved"));
    setEditOpen(false);
  };

  const setEditField = <K extends keyof Student>(k: K, v: Student[K]) => setEditForm((f) => ({ ...f, [k]: v }));
  const updateEditTeacher = (idx: number, patch: Partial<StudentTeacher>) =>
    setEditForm((f) => ({ ...f, teachers: f.teachers.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
  // student's own attendance rate for the current month (auto-absent aware)
  const studentAtt = useMemo(
    () => studentMonthAttendance(db, student.id, monthKey(now())),
    [db, student.id],
  );
  const attRate = Math.round(studentAtt.rate);
  const avg = studentAverage(db, student.id);
  const due = balanceDue(db, student);
  const net = studentNetFee(student);
  const grade = GRADES.find((g) => g.id === student.grade);
  const payStatus = studentPaymentStatus(db, student);

  const teachers = (student.teachers ?? []).map((tr) => ({ tr, tc: db.teachers.find((x) => x.id === tr.teacherId) }));
  const grades = useMemo(
    () =>
      db.examGrades
        .filter((g) => g.studentId === student.id)
        .map((g) => ({ g, exam: db.exams.find((e) => e.id === g.examId) }))
        .filter((x) => x.exam)
        .slice(-6)
        .reverse(),
    [db, student.id],
  );
  const notes = useMemo(
    () => db.studentNotes.filter((n) => n.studentId === student.id).sort((a, b) => b.date - a.date),
    [db.studentNotes, student.id],
  );

  const [noteText, setNoteText] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payType, setPayType] = useState<PaymentType>("MONTHLY_FEE");
  const [payAmount, setPayAmount] = useState("");
  const [payTeacherId, setPayTeacherId] = useState(student.teachers[0]?.teacherId ?? "");
  const [payNotes, setPayNotes] = useState("");
  const [attGroupId, setAttGroupId] = useState<string | undefined>(undefined);

  // the due month according to the student's billing model
  const dueMonth =
    student.paymentType === "deferred" ? shiftMonth(monthKey(now()), -1) : monthKey(now());

  const months = useMemo(() => liableMonthsFor(student), [student]);
  const unpaidMonths = useMemo(() => months.filter((m) => !isMonthPaid(db, student, m)), [months, db, student]);
  const oldestUnpaidMonth = unpaidMonths.length > 0 ? unpaidMonths[0] : dueMonth;
  const [payMonth, setPayMonth] = useState<string>(oldestUnpaidMonth);

  // If oldestUnpaidMonth changes, and we hadn't changed it manually, update payMonth
  // Alternatively, just set payMonth to oldestUnpaidMonth when modal opens
  
  // per-group attendance breakdown (each group computed independently)
  const groupAttendance = useMemo(
    () => studentGroupAttendance(db, student.id, monthKey(now())),
    [db, student.id],
  );

  const collectPayment = () => {
    const amount = Math.round(Number(payAmount));
    if (!amount || amount <= 0) return;
    const isCenter = payType === "CENTER_SUBSCRIPTION";
    const isOther = payType === "OTHER";
    if (isOther && !payNotes.trim()) return;
    upsert("payments", {
      id: uid("pay"),
      studentId: student.id,
      amount,
      date: startOfDay(now()),
      type: payType,
      month: payType === "MONTHLY_FEE" ? payMonth : dueMonth,
      teacherId: isCenter ? undefined : (payTeacherId || student.teachers[0]?.teacherId),
      forCenter: isCenter,
      notes: isOther ? payNotes.trim() : undefined,
      lastUpdated: now(),
    } as any);
    pushToast(t("toast.saved"));
    setPayAmount("");
    setPayNotes("");
    setPayOpen(false);
  };

  const sendNote = () => {
    if (!noteText.trim()) return;
    const note: StudentNote = {
      id: uid("note"),
      studentId: student.id,
      teacherId: student.teachers[0]?.teacherId,
      text: noteText.trim(),
      date: startOfDay(now()),
      lastUpdated: now(),
    };
    upsert("studentNotes", note);
    setNoteText("");
    pushToast(t("toast.sent"));
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* header banner */}
      <Card className="overflow-hidden border border-line shadow-md">
        <div className="relative flex flex-wrap items-center gap-4 bg-gradient-to-br from-brand-600 to-indigo-800 p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <Button variant="secondary" size="icon" onClick={onBack} className="relative border-0 bg-white/15 text-white hover:bg-white/25 transition">
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <button onClick={() => setQrOpen(true)} className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 hover:scale-105 transition">
            <QRCodeImage value={student.qrCode} size={44} />
          </button>
          <div className="relative min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{student.name}</h1>
              {grade && <span className={cn(STAGE_TONE[grade.stage], "rounded px-1.5 py-0.5 text-[10px] font-semibold")}>{gradeLabel(student.grade, lang)}</span>}
              <EnrollmentBadge student={student} lang={lang} onlyPrivate />
              <PaymentTypeBadge student={student} lang={lang} />
              <PaymentStatusBadge status={payStatus} lang={lang} exempt={student.isExempt} />
            </div>
            <p className="mt-1 font-mono text-xs text-white/80">{student.id}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/90">
              {student.parentName && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 opacity-80" />{student.parentName}</span>}
              {student.parentPhone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 opacity-80" />{student.parentPhone}</span>}
              {student.studentPhone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 opacity-80" />{student.studentPhone}</span>}
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            {can("finance.manage") && (
              <Button variant="secondary" onClick={() => { setPayMonth(oldestUnpaidMonth); setPayAmount(String(net || "")); setPayOpen(true); }} className="border-0 bg-white text-brand-700 hover:bg-white/90 font-bold">
                <HandCoins className="h-4 w-4" />{lang === "ar" ? "تسديد رسوم" : "Collect Fee"}
              </Button>
            )}
            {can("students.manage") && (
              <Button variant="secondary" onClick={openEdit} className="border-0 bg-white/15 text-white hover:bg-white/25 font-bold transition flex items-center gap-1.5">
                <Pencil className="h-4 w-4" />{lang === "ar" ? "تعديل البيانات" : "Edit Profile"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => generateStudentPdf(db, student, lang)} className="relative border-0 bg-white/15 text-white hover:bg-white/25 transition">
              <FileDown className="h-4 w-4" />{t("parent.exportReport")}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 border-0 text-white shadow-md shadow-emerald-600/10 flex items-center gap-1.5 font-bold transition"
              onClick={() => {
                const { url } = getWhatsAppReportUrl(db, student);
                window.open(url, "_blank");
                pushToast(lang === "ar" ? "تم توليد وفتح تقرير الواتساب" : "WhatsApp report generated & opened");
              }}
            >
              <MessageSquare className="h-4 w-4 text-emerald-100" />
              {lang === "ar" ? "تقرير واتساب" : "WhatsApp Report"}
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} tone="emerald" label={t("students.totalFee")} value={formatMoney(net, sym)} />
        <StatCard icon={ClipboardCheck} tone="brand" label={t("dash.attendanceRate")} value={`${attRate}%`} />
        <StatCard icon={Award} tone="amber" label={t("exams.avg")} value={avg != null ? `${Math.round(avg)}%` : "—"} />
        <StatCard icon={Wallet} tone={due > 0 ? "rose" : "emerald"} label={t("students.balance")} value={formatMoney(due, sym)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-4 lg:col-span-2">
          {/* teachers */}
          <Card className="p-5 border border-line/80 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Users2 className="h-4 w-4 text-brand-600" />{t("students.teachers")}</h3>
            <div className="space-y-2">
              {teachers.map(({ tr, tc }) => (
                <div key={tr.teacherId} className="flex items-center gap-3 rounded-lg border border-line p-2.5 bg-surface/40 hover:border-line/100 transition">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-inner" style={{ background: `linear-gradient(135deg, ${tc?.color ?? "#6366f1"}, #4f46e5)` }}>
                    {tc?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{tc?.name ?? "—"}</p>
                    <p className="text-[11px] text-muted">{(tc?.subjects ?? []).map((s) => subjectLabel(s, lang)).join(" · ")}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-black text-ink">{formatMoney(tr.fee, sym)}</p>
                    <p className="text-[10px] font-medium text-faint">{t("students.paid")}: {formatMoney(paidForTeacher(db, student.id, tr.teacherId), sym)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* groups & attendance */}
          <Card className="p-5 border border-line/80 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <Users2 className="h-4 w-4 text-violet-600" />
              {lang === "ar" ? "المجموعات والحضور (انقر على المجموعة لعرض سجلها)" : "Groups & Attendance (Click to view records)"}
            </h3>
            {groupAttendance.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted font-medium">{t("classes.emptyGroups")}</p>
            ) : (
              <div className="space-y-3">
                {groupAttendance.map((ga) => (
                  <div
                    key={ga.groupId}
                    className={cn(
                      "rounded-xl border p-3.5 cursor-pointer transition-all hover:scale-[1.005]",
                      attGroupId === ga.groupId 
                        ? "border-brand-500 bg-brand-500/[0.03] ring-1 ring-brand-500/50 shadow-sm" 
                        : "border-line hover:border-brand-300 hover:bg-brand-50/10"
                    )}
                    onClick={() => {
                      setAttGroupId(ga.groupId);
                      const el = document.getElementById("monthly-attendance-card");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink hover:text-brand-600 transition-colors">{ga.groupName}</p>
                        <p className="text-[11px] text-muted font-medium">{ga.teacherName} · {ga.subject}</p>
                      </div>
                      <span className={cn("rounded-lg px-2.5 py-1 text-xs font-black", ga.rate >= 75 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : ga.rate >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300")}>
                        {ga.rate}%
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated/75">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${Math.min(100, ga.rate)}%` }} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{lang === "ar" ? "حاضر" : "Present"}: {ga.present}</span>
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{lang === "ar" ? "متأخر" : "Late"}: {ga.late}</span>
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{lang === "ar" ? "غائب" : "Absent"}: {ga.absent}</span>
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{lang === "ar" ? "بعذر" : "Excused"}: {ga.excused}</span>
                      <span className="ms-auto text-faint font-semibold">{lang === "ar" ? "إجمالي الحصص" : "Sessions"}: {ga.expected}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {/* grades */}
          <Card className="overflow-hidden border border-line/80 shadow-sm">
            <div className="border-b border-line px-4 py-3 text-sm font-bold text-ink">{t("parent.grades")}</div>
            {grades.length === 0 ? <p className="py-6 text-center text-xs text-muted font-medium">{t("exams.empty")}</p> : (
              <table className="w-full text-sm">
                <tbody>
                  {grades.map(({ g, exam }) => (
                    <tr key={g.id} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-2 text-ink">{exam!.name}</td>
                      <td className="px-4 py-2 text-end">
                        <Badge tone={g.obtainedGrade / exam!.maxGrade >= 0.5 ? "success" : "danger"}>{g.obtainedGrade}/{exam!.maxGrade}</Badge>
                      </td>
                      <td className="px-4 py-2 text-end">
                        {g.published ? <Badge tone="success">{t("exams.published")}</Badge> : <Badge tone="neutral">{t("exams.notPublished")}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* right column: send note to parent + history */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Send className="h-4 w-4 text-brand-600" />{t("teachers.addNote")}</h3>
            <p className="mb-2 text-[11px] text-muted">{t("parent.notes")}</p>
            <Textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t("teachers.addNote")} />
            <Button className="mt-2 w-full" onClick={sendNote} disabled={!noteText.trim()}>
              <Send className="h-4 w-4" />{t("exams.publish")}
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><StickyNote className="h-4 w-4 text-amber-500" />{t("parent.notes")} ({notes.length})</h3>
            {notes.length === 0 ? (
              <EmptyState title={t("parent.noNotes")} />
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-line p-2.5">
                    <p className="text-xs text-ink">{n.text}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-faint"><CalendarClock className="h-3 w-3" />{new Date(n.date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ===== COMPLETE ARCHIVE ===== */}
      <ArchiveSection student={student} selectedGroupId={attGroupId} onSelectGroup={setAttGroupId} />

      {/* Collect fee modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={lang === "ar" ? "تسديد رسوم" : "Collect Fee"} size="md"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>{t("action.cancel")}</Button>
          <Button onClick={collectPayment} disabled={!payAmount || Number(payAmount) <= 0 || (payType === "OTHER" && !payNotes.trim())}>{t("action.save")}</Button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("fin.type")}>
              <Select value={payType} onChange={(e) => setPayType(e.target.value as PaymentType)}>
                {PAY_TYPES.map((ty) => <option key={ty} value={ty}>{t(`fin.type.${ty}`)}</option>)}
              </Select>
            </Field>
            <Field label={`${t("fin.amountInt")} (${sym})`}>
              <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(net || 0)} autoFocus />
            </Field>
          </div>

          {/* teacher allocation (hidden for center subscription) */}
          {payType !== "CENTER_SUBSCRIPTION" && teachers.length > 0 && (
            <Field label={lang === "ar" ? "سندفعه إلى" : "Allocate to"}>
              <Select value={payTeacherId} onChange={(e) => setPayTeacherId(e.target.value)}>
                {teachers.map(({ tr, tc }) => <option key={tr.teacherId} value={tr.teacherId}>{tc?.name ?? tr.teacherId} — {formatMoney(tr.fee, sym)}</option>)}
              </Select>
            </Field>
          )}
          {payType === "CENTER_SUBSCRIPTION" && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {lang === "ar" ? "سيُسجَّل هذا المبلغ كاشتراك للسنتر (غير مرتبط بمعلم)." : "Recorded as a center subscription (no teacher)."}
            </p>
          )}

          {/* "Other" requires a description */}
          {payType === "OTHER" && (
            <Field label={t("fin.otherRequired")} required>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder={t("fin.otherRequired")} />
            </Field>
          )}

          {/* resolved billing month */}
          {payType === "MONTHLY_FEE" ? (
            <Field label={lang === "ar" ? "الشهر المسدد" : "Month to pay for"}>
              <Select value={payMonth} onChange={(e) => setPayMonth(e.target.value)}>
                {months.map((m) => (
                  <option key={m} value={m}>{m} {unpaidMonths.includes(m) ? (lang === "ar" ? "(غير مسدد)" : "(Unpaid)") : ""}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-elevated/60 px-3 py-2 text-[11px] text-muted">
              <CalendarClock className="h-3.5 w-3.5 text-faint" />
              {lang === "ar" ? "سيُسجَّل لشهر" : "Recorded for month"}: <b className="text-ink">{dueMonth}</b>
              {student.paymentType === "deferred" && <span className="text-amber-600">({lang === "ar" ? "مؤخر" : "deferred"})</span>}
              {student.paymentType !== "deferred" && <span className="text-brand-600">({lang === "ar" ? "مقدم" : "advance"})</span>}
            </div>
          )}
        </div>
      </Modal>

      {/* QR modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title={t("students.qr")} size="sm"
        footer={<Button variant="secondary" onClick={() => setQrOpen(false)}>{t("action.close")}</Button>}>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-xl border border-line bg-white p-3"><QRCodeImage value={student.qrCode} size={180} /></div>
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-ink">{student.id}</p>
            <p className="text-sm text-muted">{student.name}</p>
          </div>
        </div>
      </Modal>

      {/* Edit Student Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title={t("students.edit")} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>{t("action.cancel")}</Button>
          <Button onClick={saveEdit} disabled={!editForm.teachers.length}>{t("action.save")}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("students.code")}><Input value={editForm.id} disabled className="font-mono" /></Field>
            <Field label={t("students.name")} required><Input value={editForm.name} onChange={(e) => setEditField("name", e.target.value)} placeholder="Ahmed Ali" /></Field>
            <Field label={t("students.grade")}>
              <Combobox value={editForm.grade} onChange={(v) => setEditField("grade", v)} options={gradeOptions}
                placeholder={t("students.grade")} allowCustom
                searchLabel={t("combo.search")} addLabel={t("combo.add")} emptyLabel={t("combo.none")} />
            </Field>
            <Field label={t("students.registered")}><Input type="date" value={toDateInput(editForm.registrationDate)} onChange={(e) => setEditField("registrationDate", startOfDay(new Date(e.target.value).getTime()))} /></Field>
            <Field label={`${t("students.parentName")}`}><Input value={editForm.parentName} onChange={(e) => setEditField("parentName", e.target.value)} /></Field>
            <Field label={`${t("students.parentPhone")}`}><Input value={editForm.parentPhone} onChange={(e) => setEditField("parentPhone", e.target.value)} /></Field>
            <Field label={`${t("students.studentPhone")}`}><Input value={editForm.studentPhone} onChange={(e) => setEditField("studentPhone", e.target.value)} /></Field>
            <Field label={`${t("students.discount")} (${sym})`}><Input type="number" min={0} value={editForm.discount} onChange={(e) => setEditField("discount", +e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={lang === "ar" ? "نوع الحضور" : "Enrollment type"}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditField("enrollmentType", "group")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", editForm.enrollmentType === "group" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "مجموعة" : "Group"}
                </button>
                <button type="button" onClick={() => setEditField("enrollmentType", "private")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", editForm.enrollmentType === "private" ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "خاص" : "Private"}
                </button>
              </div>
            </Field>
            <Field label={lang === "ar" ? "طريقة الدفع" : "Payment type"}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditField("paymentType", "advance")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", editForm.paymentType === "advance" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "مقدم" : "Advance"}
                </button>
                <button type="button" onClick={() => setEditField("paymentType", "deferred")}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition", editForm.paymentType === "deferred" ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" : "border-line text-muted hover:bg-elevated")}>
                  {lang === "ar" ? "مؤخر" : "Deferred"}
                </button>
              </div>
            </Field>
          </div>

          {/* teachers with per-teacher fees */}
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><UserCog className="h-4 w-4 text-brand-600" />{t("students.teachers")}</span>
              <Button size="sm" variant="subtle" onClick={() => setEditField("teachers", [...editForm.teachers, { teacherId: activeTeachers[0]?.id ?? "", fee: 300 }])} disabled={!activeTeachers.length}>
                <Plus className="h-3.5 w-3.5" />{t("students.addTeacher")}
              </Button>
            </div>
            {!activeTeachers.length && <p className="py-2 text-center text-[11px] text-amber-600">{t("teachers.empty")}</p>}
            <div className="space-y-2">
              {editForm.teachers.map((tr, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={tr.teacherId} onChange={(e) => updateEditTeacher(idx, { teacherId: e.target.value })} className="flex-1">
                    <option value="">{t("students.selectTeacher")}</option>
                    {activeTeachers.map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                  </Select>
                  <div className="relative w-32">
                    <Input type="number" min={0} value={tr.fee} onChange={(e) => updateEditTeacher(idx, { fee: +e.target.value })} className="ps-8" />
                    <span className="pointer-events-none absolute inset-y-0 start-2.5 my-auto text-[10px] text-faint">{sym}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditField("teachers", editForm.teachers.filter((_, i) => i !== idx))}><X className="h-4 w-4 text-rose-500" /></Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
              <Toggle checked={editForm.isExempt} onChange={(v) => setEditField("isExempt", v)} label={t("students.exempt")} />
              <span className="font-semibold text-ink">{t("students.totalFee")}: {formatMoney(editForm.isExempt ? 0 : studentNetFee(editForm), sym)}</span>
            </div>
            {!editForm.teachers.length && <p className="mt-1 text-[11px] text-rose-500">{t("students.noTeachers")}</p>}
          </div>

          {/* groups dropdown */}
          <Field label={`${t("students.groups")}`} hint={t("combo.selectGroups")}>
            <MultiCombobox
              selected={editForm.groupIds} onChange={(v) => setEditField("groupIds", v)}
              options={groupOptions}
              placeholder={t("combo.selectGroups")}
              searchLabel={t("combo.search")}
              selectedLabel={(n) => t("combo.selected", { n })}
              emptyLabel={t("classes.emptyGroups")}
            />
            {editForm.groupIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {editForm.groupIds.map((gid) => {
                  const g = db.groups.find((x) => x.id === gid);
                  return (
                    <span key={gid} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                      {g?.name ?? gid}
                      <button type="button" onClick={() => setEditField("groupIds", editForm.groupIds.filter((x) => x !== gid))}><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ===================== COMPLETE STUDENT ARCHIVE ===================== */
function ArchiveSection({ 
  student, 
  selectedGroupId, 
  onSelectGroup 
}: { 
  student: Student;
  selectedGroupId?: string;
  onSelectGroup?: (gid: string | undefined) => void;
}) {
  const { db, t, lang } = useApp();
  const isAr = lang === "ar";
  const [tab, setTab] = useState("grades");
  const [payTeacherFilter, setPayTeacherFilter] = useState<string>("all");

  const studentTeachers = useMemo(() => {
    return student.teachers
      .map((st) => db.teachers.find((t) => t.id === st.teacherId))
      .filter(Boolean);
  }, [student.teachers, db.teachers]);

  const allGrades = useMemo(() =>
    db.examGrades
      .filter((g) => g.studentId === student.id)
      .map((g) => ({ g, exam: db.exams.find((e) => e.id === g.examId) }))
      .filter((x) => x.exam)
      .sort((a, b) => b.exam!.date - a.exam!.date),
    [db.examGrades, db.exams, student.id],
  );

  const allAttendance = useMemo(() =>
    db.attendance
      .filter((a) => a.studentId === student.id)
      .sort((a, b) => b.date - a.date),
    [db.attendance, student.id],
  );

  const allPayments = useMemo(() =>
    [...db.payments]
      .filter((p) => p.studentId === student.id)
      .sort((a, b) => b.date - a.date),
    [db.payments, student.id],
  );

  const filteredPayments = useMemo(() => {
    if (payTeacherFilter === "all") return allPayments;
    if (payTeacherFilter === "center") return allPayments.filter((p) => p.forCenter || !p.teacherId);
    return allPayments.filter((p) => p.teacherId === payTeacherFilter);
  }, [allPayments, payTeacherFilter]);

  const allHomework = useMemo(() =>
    db.assignments
      .filter((a) => student.groupIds.includes(a.groupId))
      .sort((a, b) => b.dueDate - a.dueDate),
    [db.assignments, student.groupIds],
  );

  const allNotes = useMemo(() =>
    db.studentNotes
      .filter((n) => n.studentId === student.id)
      .sort((a, b) => b.date - a.date),
    [db.studentNotes, student.id],
  );

  const tabs = [
    { id: "grades", label: t("archive.tab.grades"), count: allGrades.length },
    { id: "attendance", label: t("archive.tab.attendance"), count: allAttendance.length },
    { id: "payments", label: t("archive.tab.payments"), count: allPayments.length },
    { id: "homework", label: t("archive.tab.homework"), count: allHomework.length },
    { id: "notes", label: t("archive.tab.notes"), count: allNotes.length },
  ];

  return (
    <Card className="overflow-hidden border border-line shadow-md">
      <div className="flex items-center gap-2 border-b border-line bg-elevated/40 px-5 py-3.5">
        <FileDown className="h-4 w-4 text-brand-500" />
        <h3 className="text-[15px] font-bold tracking-tight text-ink">{t("archive.title")}</h3>
        <span className="text-[11px] text-faint">· {t("archive.subtitle")}</span>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2 bg-surface/30">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all", tab === tb.id ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:bg-elevated")}>
            {tb.label}
            <span className={cn("rounded-full px-1.5 text-[9px] font-semibold", tab === tb.id ? "bg-white/20 text-white" : "bg-elevated")}>{tb.count}</span>
          </button>
        ))}
      </div>

      {/* content */}
      <div className="max-h-[460px] overflow-y-auto p-4">
        {tab === "grades" && (
          allGrades.length === 0 ? <ArchiveEmpty t={t} /> : (
            <div className="space-y-2">
              {allGrades.map(({ g, exam }) => {
                const pct = exam!.maxGrade > 0 ? (g.obtainedGrade / exam!.maxGrade) * 100 : 0;
                return (
                  <div key={g.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5 bg-surface/50 hover:border-line/100 transition">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{exam!.name}</p>
                      <p className="text-[10px] text-faint mt-0.5">{new Date(exam!.date).toLocaleDateString()}</p>
                    </div>
                    <Badge tone={pct >= 50 ? "success" : "danger"}>{g.obtainedGrade}/{exam!.maxGrade} · {Math.round(pct)}%</Badge>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "attendance" && (
          <MonthlyAttendance studentId={student.id} selectedGroupId={selectedGroupId} onSelectGroup={onSelectGroup} />
        )}

        {tab === "payments" && (
          <div className="space-y-3">
            {/* Separate payment filter for multi-teacher accounts */}
            {studentTeachers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 bg-muted/40 p-1.5 rounded-lg border border-line/80">
                <button
                  onClick={() => setPayTeacherFilter("all")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                    payTeacherFilter === "all" ? "bg-brand-600 text-white shadow-sm font-bold" : "text-muted hover:bg-elevated"
                  )}
                >
                  {isAr ? "كل المدفوعات" : "All Payments"}
                </button>
                {studentTeachers.map((t) => (
                  <button
                    key={t!.id}
                    onClick={() => setPayTeacherFilter(t!.id)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                      payTeacherFilter === t!.id ? "bg-brand-600 text-white shadow-sm font-bold" : "text-muted hover:bg-elevated"
                    )}
                  >
                    {t!.name}
                  </button>
                ))}
                <button
                  onClick={() => setPayTeacherFilter("center")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                    payTeacherFilter === "center" ? "bg-brand-600 text-white shadow-sm font-bold" : "text-muted hover:bg-elevated"
                  )}
                >
                  {isAr ? "اشتراكات السنتر" : "Center Subs"}
                </button>
              </div>
            )}

            {filteredPayments.length === 0 ? <ArchiveEmpty t={t} /> : (
              <div className="space-y-2">
                {filteredPayments.map((p) => {
                  const teacher = db.teachers.find((t) => t.id === p.teacherId);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5 bg-surface/50 hover:border-line/100 transition">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">{t(`fin.type.${p.type}`)}</p>
                        <p className="text-[10px] text-faint mt-0.5">
                          {new Date(p.date).toLocaleDateString(isAr ? "ar-EG" : undefined)} · {p.month}
                          {teacher && <span className="ms-1.5 px-1.5 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 rounded font-bold text-[9px]">{teacher.name}</span>}
                          {p.forCenter && <span className="ms-1.5 px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 rounded font-bold text-[9px]">{isAr ? "اشتراك السنتر" : "Center Sub"}</span>}
                        </p>
                        {p.notes && <p className="mt-1 text-[11px] text-muted italic">"{p.notes}"</p>}
                      </div>
                      <Badge tone="success">{formatMoney(p.amount, currencySymbol(db))}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "homework" && (
          allHomework.length === 0 ? <ArchiveEmpty t={t} /> : (
            <div className="space-y-2">
              {allHomework.map((a) => {
                const overdue = a.dueDate < Date.now();
                return (
                  <div key={a.id} className="rounded-lg border border-line p-2.5 bg-surface/50 hover:border-line/100 transition">
                    <p className="text-sm font-bold text-ink">{a.title}</p>
                    {a.description && <p className="text-[11px] text-muted mt-0.5">{a.description}</p>}
                    <p className={cn("mt-1.5 text-[10px] font-semibold", overdue ? "text-rose-500" : "text-faint")}>{t("exams.due")}: {new Date(a.dueDate).toLocaleDateString()}</p>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "notes" && (
          allNotes.length === 0 ? <ArchiveEmpty t={t} /> : (
            <div className="space-y-2">
              {allNotes.map((n) => (
                <div key={n.id} className="rounded-lg border border-line p-2.5 bg-surface/50 hover:border-line/100 transition">
                  <p className="text-sm font-semibold text-ink leading-relaxed">{n.text}</p>
                  <p className="mt-1.5 text-[10px] text-faint font-medium">{new Date(n.date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Card>
  );
}

function ArchiveEmpty({ t }: { t: (k: string) => string }) {
  return <p className="py-8 text-center text-xs text-muted">{t("exams.empty")}</p>;
}
