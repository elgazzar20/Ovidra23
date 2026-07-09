import { useMemo, useState } from "react";
import {
  FileText, FileSpreadsheet, Users, Wallet, Send, GraduationCap, UserRound,
  BarChart3, CheckCircle2, Building2, CalendarRange, Download, Mail, MessageSquare,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { PageHeader, Button, Card, Field, Badge, pushToast, Select } from "../components/ui";
import { Combobox } from "../components/ui";
import {
  exportCenterPdf, exportCenterExcel, exportStudentsExcel, exportFinanceExcel,
  exportTeacherPdf, exportTeacherExcel, exportStudentExcel
} from "../lib/reports";
import { generateStudentPdf } from "../lib/pdf";
import { getWhatsAppReportUrl } from "../lib/whatsapp";
import { exportStudents as exportTeacherStudents, exportFinancial as exportTeacherFinancial, exportSchedule as exportTeacherSchedule } from "../lib/teacherReports";
import { subjectLabel } from "../lib/constants";
import { totalRevenue, totalExpenses, formatMoney, teacherRevenue, currencySymbol, shiftMonth, balanceDue } from "../lib/analytics";
import { monthKey, now } from "../lib/db";
import type { DatabaseShape } from "../lib/types";
import { cn } from "../utils/cn";
import { exportLateStudentsPdf, exportAbsenceReportPdf, exportUnpaidCenterSubPdf } from "../lib/pdf-arabic";

function filterDbByPeriod(db: DatabaseShape, period: string): DatabaseShape {
  if (period === "0") return db; // All time
  
  let allowedMonths: string[] = [];
  if (period.includes("-")) {
    allowedMonths = [period];
  } else {
    const monthsOffset = Number(period);
    const mNow = monthKey(now());
    for (let i = 0; i < monthsOffset; i++) {
      allowedMonths.push(shiftMonth(mNow, -i));
    }
  }
  
  return {
    ...db,
    payments: db.payments.filter(p => allowedMonths.includes(p.month)),
    expenses: db.expenses.filter(e => allowedMonths.includes(monthKey(e.date))),
    exams: db.exams ? db.exams.filter(e => allowedMonths.includes(monthKey(e.date))) : [],
    attendance: db.attendance ? db.attendance.filter(a => allowedMonths.includes(monthKey(a.date))) : [],
    assignments: db.assignments ? db.assignments.filter(a => allowedMonths.includes(monthKey(a.dueDate))) : [],
  };
}

export function Reports() {
  const { db, t, lang } = useApp();
  const sym = currencySymbol(db);
  const [teacherId, setTeacherId] = useState(db.teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(db.students[0]?.id ?? "");
  const [sent, setSent] = useState<string[]>([]);
  
  // Independent report period selections for each report section
  const [centerPeriod, setCenterPeriod] = useState<string>("1");
  const [teacherPeriod, setTeacherPeriod] = useState<string>("1");
  const [studentPeriod, setStudentPeriod] = useState<string>("1");
  
  const [absenceThreshold, setAbsenceThreshold] = useState<string>("2");
  
  const centerDb = useMemo(() => filterDbByPeriod(db, centerPeriod), [db, centerPeriod]);
  const teacherDb = useMemo(() => filterDbByPeriod(db, teacherPeriod), [db, teacherPeriod]);
  const studentDb = useMemo(() => filterDbByPeriod(db, studentPeriod), [db, studentPeriod]);

  // Generate list of the last 24 specific months to select from
  const specificMonths = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const mNow = monthKey(now());
    for (let i = 0; i < 24; i++) {
      const mKey = shiftMonth(mNow, -i);
      const [y, mStr] = mKey.split("-");
      const mNum = Number(mStr);
      let mName = "";
      if (lang === "ar") {
        const arabicMonths = [
          "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
          "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
        ];
        mName = `${arabicMonths[mNum - 1]} ${y}`;
      } else {
        const englishMonths = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        mName = `${englishMonths[mNum - 1]} ${y}`;
      }
      list.push({ value: mKey, label: mName });
    }
    return list;
  }, [lang]);

  const studentOptions = useMemo(
    () => db.students.map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` })),
    [db.students],
  );
  const teacherOptions = useMemo(
    () => db.teachers.map((tc) => ({ value: tc.id, label: tc.name })),
    [db.teachers],
  );
  const teacher = db.teachers.find((x) => x.id === teacherId);
  const student = db.students.find((s) => s.id === studentId);

  const income = totalRevenue(centerDb);
  const expenses = totalExpenses(centerDb);
  const net = income - expenses;

  // Student report sent to parent/WhatsApp using the student period DB
  const sendStudentToParent = () => {
    if (!student) return;
    generateStudentPdf(studentDb, student, lang);
    setSent((p) => [...new Set([...p, `student-${student.id}`])]);
    pushToast(t("toast.reportParent"));
  };

  const sendStudentWhatsApp = () => {
    if (!student) return;
    const { url } = getWhatsAppReportUrl(studentDb, student);
    window.open(url, "_blank");
    setSent((p) => [...new Set([...p, `student-${student.id}`])]);
    pushToast(lang === "ar" ? "تم تجهيز تقرير الواتساب وسيتم فتحه الآن" : "WhatsApp report generated, opening...");
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
      />

      {/* premium hero with quick stats */}
      <Card className="mesh-brand relative overflow-hidden border-0 text-white shadow-[var(--shadow-brand)]">
        <div className="orb float-soft -right-8 -top-10 h-40 w-40 bg-white/12" />
        <div className="orb float-soft -bottom-16 left-1/3 h-44 w-44 bg-accent-400/20" style={{ animationDelay: "1s" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-5 p-6">
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/70"><Building2 className="h-3.5 w-3.5" />{db.profile.name}</p>
            <h2 className="mt-1 text-2xl font-bold">{t("reports.title")}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70"><CalendarRange className="h-3.5 w-3.5" />{new Date().toLocaleDateString()}</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/15 backdrop-blur">
              <p className="text-lg font-bold">{db.students.length}</p>
              <p className="text-[10px] text-white/70">{t("dash.totalStudents")}</p>
            </div>
            <div className="rounded-xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/15 backdrop-blur">
              <p className="text-lg font-bold">{db.teachers.length}</p>
              <p className="text-[10px] text-white/70">{t("teachers.title")}</p>
            </div>
            <div className="rounded-xl bg-white/12 px-4 py-3 text-center ring-1 ring-white/15 backdrop-blur">
              <p className="text-lg font-bold">{formatMoney(net, sym)}</p>
              <p className="text-[10px] text-white/70">{t("dash.netProfit")}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* policy note */}
      <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <Mail className="h-4 w-4 shrink-0" />
        <span>{t("reports.policy")}</span>
      </div>

      {/* report cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* full center — download/view only */}
        <ReportCard
          icon={<BarChart3 className="h-6 w-6" />} gradient="from-brand-500 to-brand-700"
          title={t("reports.title")} subtitle={db.profile.name}
          actions={[
            { label: t("reports.fullPdf"), icon: <FileText className="h-4 w-4" />, onClick: () => exportCenterPdf(centerDb, lang) },
            { label: t("reports.fullExcel"), icon: <FileSpreadsheet className="h-4 w-4" />, onClick: () => exportCenterExcel(centerDb, lang) },
            { label: t("reports.studentsExcel"), icon: <Users className="h-4 w-4" />, onClick: () => exportStudentsExcel(centerDb, lang) },
            { label: t("reports.financeExcel"), icon: <Wallet className="h-4 w-4" />, onClick: () => exportFinanceExcel(centerDb) },
          ]}
        >
          <Field label={lang === "ar" ? "فترة تقارير المركز" : "Center Reports Period"}>
            <Select value={centerPeriod} onChange={(e) => setCenterPeriod(e.target.value)} className="w-full bg-elevated/40">
              <optgroup label={lang === "ar" ? "فترات نسبية" : "Relative Periods"}>
                <option value="1">{lang === "ar" ? "الشهر الحالي" : "Current Month"}</option>
                <option value="2">{lang === "ar" ? "آخر شهرين" : "Last 2 Months"}</option>
                <option value="3">{lang === "ar" ? "آخر ٣ أشهر" : "Last 3 Months"}</option>
                <option value="6">{lang === "ar" ? "آخر ٦ أشهر" : "Last 6 Months"}</option>
                <option value="12">{lang === "ar" ? "آخر سنة" : "Last Year"}</option>
                <option value="24">{lang === "ar" ? "آخر سنتين" : "Last 2 Years"}</option>
                <option value="0">{lang === "ar" ? "كل الأوقات" : "All Time"}</option>
              </optgroup>
              <optgroup label={lang === "ar" ? "أشهر محددة" : "Specific Months"}>
                {specificMonths.map((sm) => (
                  <option key={sm.value} value={sm.value}>{sm.label}</option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <div className="h-2" />
        </ReportCard>

        {/* teacher — download/view only */}
        <ReportCard
          icon={<UserRound className="h-6 w-6" />} gradient="from-violet-500 to-violet-700"
          title={t("reports.teacher")} subtitle={teacher ? teacher.subjects.map((s) => subjectLabel(s, lang)).join(" · ") : "—"}
          actions={teacher ? [
            { label: lang === "ar" ? "تحميل تقرير PDF شامل" : "Download Full PDF Report", icon: <FileText className="h-4 w-4" />, onClick: () => exportTeacherPdf(teacherDb, teacher, lang) },
            { label: lang === "ar" ? "تحميل كشف Excel شامل" : "Download Full Excel Report", icon: <FileSpreadsheet className="h-4 w-4" />, onClick: () => exportTeacherExcel(teacherDb, teacher, lang) },
            { label: t("students.title"), icon: <FileText className="h-4 w-4" />, onClick: () => exportTeacherStudents(teacherDb, teacher, lang) },
            { label: t("fin.title"), icon: <Wallet className="h-4 w-4" />, onClick: () => exportTeacherFinancial(teacherDb, teacher, lang) },
            { label: t("schedule.title"), icon: <FileText className="h-4 w-4" />, onClick: () => exportTeacherSchedule(teacherDb, teacher, lang) },
          ] : []}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-2">
            <Field label={t("teachers.title")}>
              <Combobox value={teacherId} onChange={setTeacherId} options={teacherOptions}
                placeholder={t("teachers.title")} allowCustom={false}
                searchLabel={t("action.search")} emptyLabel={t("teachers.empty")} />
            </Field>
            <Field label={lang === "ar" ? "فترة تقرير المعلم" : "Teacher Report Period"}>
              <Select value={teacherPeriod} onChange={(e) => setTeacherPeriod(e.target.value)} className="w-full bg-elevated/40">
                <optgroup label={lang === "ar" ? "فترات نسبية" : "Relative Periods"}>
                  <option value="1">{lang === "ar" ? "الشهر الحالي" : "Current Month"}</option>
                  <option value="2">{lang === "ar" ? "آخر شهرين" : "Last 2 Months"}</option>
                  <option value="3">{lang === "ar" ? "آخر ٣ أشهر" : "Last 3 Months"}</option>
                  <option value="6">{lang === "ar" ? "آخر ٦ أشهر" : "Last 6 Months"}</option>
                  <option value="12">{lang === "ar" ? "آخر سنة" : "Last Year"}</option>
                  <option value="24">{lang === "ar" ? "آخر سنتين" : "Last 2 Years"}</option>
                  <option value="0">{lang === "ar" ? "كل الأوقات" : "All Time"}</option>
                </optgroup>
                <optgroup label={lang === "ar" ? "أشهر محددة" : "Specific Months"}>
                  {specificMonths.map((sm) => (
                    <option key={sm.value} value={sm.value}>{sm.label}</option>
                  ))}
                </optgroup>
              </Select>
            </Field>
          </div>
          {teacher && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-elevated/60 px-3 py-2 text-xs">
              <span className="text-muted">{t("teachers.revenue")}</span>
              <span className="font-bold text-emerald-600">{formatMoney(teacherRevenue(teacherDb, teacher.id), sym)}</span>
            </div>
          )}
        </ReportCard>

        {/* Unpaid / Late Payments Report Card */}
        <ReportCard
          icon={<Wallet className="h-6 w-6" />} gradient="from-rose-500 to-rose-700"
          title={lang === "ar" ? "تقرير المديونيات والمتأخرين عن السداد" : "Outstanding Balances & Unpaid Report"}
          subtitle={lang === "ar" ? "استخراج تقرير بالطلاب المتبقي عليهم دفع مبالغ" : "Generate a PDF report of all students with outstanding dues"}
          actions={[
            {
              label: lang === "ar" ? "تحميل تقرير المديونيات PDF" : "Download Unpaid PDF",
              icon: <Download className="h-4 w-4" />,
              onClick: () => exportLateStudentsPdf(db, lang)
            },
            {
              label: lang === "ar" ? "تحميل تقرير اشتراك السنتر PDF" : "Download Center Sub PDF",
              icon: <Download className="h-4 w-4" />,
              onClick: () => exportUnpaidCenterSubPdf(db, lang)
            }
          ]}
        >
          <div className="mt-1 mb-3 text-xs text-muted border border-dashed border-rose-200 bg-rose-50/20 p-2.5 rounded-lg dark:border-rose-500/20 dark:bg-rose-500/5 space-y-1">
            <p>
              {lang === "ar" 
                ? `عدد الحالات النشطة المتأخرة عن السداد حالياً: ${db.students.filter(s => !s.isArchived && balanceDue(db, s) > 0).length} طالب.`
                : `Current active student cases with outstanding balances: ${db.students.filter(s => !s.isArchived && balanceDue(db, s) > 0).length} students.`
              }
            </p>
            <p>
              {lang === "ar"
                ? `غير مسددي اشتراك السنتر (الشهر الحالي): ${db.students.filter(s => !s.isArchived && !db.payments.some(p => p.studentId === s.id && p.month === monthKey(now()) && (p.forCenter || p.type === "CENTER_SUBSCRIPTION"))).length} طالب.`
                : `Unpaid center subscription (current month): ${db.students.filter(s => !s.isArchived && !db.payments.some(p => p.studentId === s.id && p.month === monthKey(now()) && (p.forCenter || p.type === "CENTER_SUBSCRIPTION"))).length} students.`
              }
            </p>
          </div>
        </ReportCard>

        {/* Prolonged Absence / Non-Attendance Report Card */}
        <ReportCard
          icon={<CalendarRange className="h-6 w-6" />} gradient="from-amber-500 to-amber-700"
          title={lang === "ar" ? "تقرير الغياب والانقطاع المتكرر" : "Absence & Non-Attendance Report"}
          subtitle={lang === "ar" ? "حصر الطلاب بحسب الغياب المتتالي أو مدة الانقطاع" : "Filter students by consecutive absences or duration of absence"}
          actions={[
            {
              label: lang === "ar" ? "استخراج تقرير الغياب PDF" : "Download Absence PDF",
              icon: <Download className="h-4 w-4" />,
              onClick: () => exportAbsenceReportPdf(db, absenceThreshold, lang)
            }
          ]}
        >
          <Field label={lang === "ar" ? "تحديد حد الغياب / الانقطاع" : "Select Absence/Inactivity Threshold"}>
            <Select value={absenceThreshold} onChange={(e) => setAbsenceThreshold(e.target.value)} className="w-full bg-elevated/40">
              <option value="1">{lang === "ar" ? "حصة واحدة" : "1 Session Absence"}</option>
              <option value="2">{lang === "ar" ? "حصتين متتاليتين" : "2 Consecutive Absences"}</option>
              <option value="3">{lang === "ar" ? "ثلاث حصص متتالية" : "3 Consecutive Absences"}</option>
              <option value="4">{lang === "ar" ? "أربع حصص متتالية" : "4 Consecutive Absences"}</option>
              <option value="5">{lang === "ar" ? "خمس حصص متتالية" : "5 Consecutive Absences"}</option>
              <option value="6">{lang === "ar" ? "ست حصص متتالية" : "6 Consecutive Absences"}</option>
              <option value="month">{lang === "ar" ? "شهر كامل" : "Full Month"}</option>
              <option value="long_time">{lang === "ar" ? "منذ مدة" : "Since a while"}</option>
            </Select>
          </Field>
        </ReportCard>
      </div>

      {/* student report — the ONLY one that can be sent (to the parent) */}
      <ReportCard
        icon={<GraduationCap className="h-6 w-6" />} gradient="from-emerald-500 to-emerald-700"
        title={t("reports.student")} subtitle={t("reports.studentHint")}
        full
        actions={student ? [
          { label: lang === "ar" ? "تحميل كشف PDF شامل" : "Download Full PDF Report", icon: <Download className="h-4 w-4" />, onClick: () => generateStudentPdf(studentDb, student, lang) },
          { label: lang === "ar" ? "تحميل كشف Excel شامل" : "Download Full Excel Report", icon: <FileSpreadsheet className="h-4 w-4" />, onClick: () => exportStudentExcel(studentDb, student, lang) },
        ] : []}
        sendLabel={t("reports.sendParent")}
        sent={!!student && sent.includes(`student-${student.id}`)}
        canSend={!!student}
        onSend={sendStudentToParent}
        onSendWhatsApp={sendStudentWhatsApp}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
          <Field label={t("students.title")}>
            <Combobox value={studentId} onChange={setStudentId} options={studentOptions}
              placeholder={t("fin.searchStudent")} allowCustom={false}
              searchLabel={t("fin.searchStudent")} emptyLabel={t("fin.noResults")} />
          </Field>
          <Field label={lang === "ar" ? "فترة تقرير الطالب" : "Student Report Period"}>
            <Select value={studentPeriod} onChange={(e) => setStudentPeriod(e.target.value)} className="w-full bg-elevated/40">
              <optgroup label={lang === "ar" ? "فترات نسبية" : "Relative Periods"}>
                <option value="1">{lang === "ar" ? "الشهر الحالي" : "Current Month"}</option>
                <option value="2">{lang === "ar" ? "آخر شهرين" : "Last 2 Months"}</option>
                <option value="3">{lang === "ar" ? "آخر ٣ أشهر" : "Last 3 Months"}</option>
                <option value="6">{lang === "ar" ? "آخر ٦ أشهر" : "Last 6 Months"}</option>
                <option value="12">{lang === "ar" ? "آخر سنة" : "Last Year"}</option>
                <option value="24">{lang === "ar" ? "آخر سنتين" : "Last 2 Years"}</option>
                <option value="0">{lang === "ar" ? "كل الأوقات" : "All Time"}</option>
              </optgroup>
              <optgroup label={lang === "ar" ? "أشهر محددة" : "Specific Months"}>
                {specificMonths.map((sm) => (
                  <option key={sm.value} value={sm.value}>{sm.label}</option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>
      </ReportCard>

      {sent.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />{t("toast.reportParent")}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Reusable report card --------------------------- */
function ReportCard({
  icon, gradient, title, subtitle, actions, children, full, sendLabel, sent, canSend, onSend, onSendWhatsApp,
}: {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  subtitle?: string;
  actions: { label: string; icon: React.ReactNode; onClick: () => void }[];
  children?: React.ReactNode;
  full?: boolean;
  sendLabel?: string;
  sent?: boolean;
  canSend?: boolean;
  onSend?: () => void;
  onSendWhatsApp?: () => void;
}) {
  const { lang } = useApp();
  return (
    <Card className={cn("card-hover overflow-hidden", full && "lg:col-span-2")}>
      <div className="flex items-center gap-3 border-b border-line bg-elevated/40 p-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", gradient)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {sent && <Badge tone="success"><CheckCircle2 className="h-3 w-3" />{t0("view.pinned").replace("Pinned", "Sent")}</Badge>}
      </div>
      <div className="p-4">
        {children}
        <div className={cn("grid gap-2", full ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {actions.map((a, i) => (
            <Button key={i} size="sm" variant="secondary" onClick={a.onClick}>
              {a.icon}{a.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {sendLabel && (
            <Button size="sm" variant="subtle" className="w-full" onClick={onSend} disabled={!canSend}>
              {sent ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {sendLabel}
            </Button>
          )}
          {onSendWhatsApp && (
            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5" onClick={onSendWhatsApp} disabled={!canSend}>
              <MessageSquare className="h-4 w-4 text-emerald-100" />
              {lang === "ar" ? "إرسال تقرير بالواتساب 📲" : "WhatsApp Report 📲"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// tiny helper to access translations inside the non-hook ReportCard
import { useApp as useApp0 } from "../context/AppContext";
function t0(key: string) {
  return useApp0().t(key);
}
