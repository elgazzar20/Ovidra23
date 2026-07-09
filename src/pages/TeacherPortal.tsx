import { useMemo, useState } from "react";
import {
  Lock, Users, Calendar, Wallet, Percent, ShieldAlert,
  Search, Phone, Send, ChevronLeft, Building, MessageSquare, LogOut, TrendingUp,
  Plus, Trash2, Pencil, FileText, Award
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, Button, Input, Badge, EmptyState, Field, Textarea, Modal, pushToast, PageHeader, Select } from "../components/ui";
import { cn } from "../utils/cn";
import { currencySymbol, formatMoney } from "../lib/analytics";
import { GRADES, gradeLabel, subjectLabel } from "../lib/constants";
import { getWhatsAppReportUrl, getWhatsAppExamGradeUrl } from "../lib/whatsapp";
import type { Teacher, Student, Exam, ExamGrade } from "../lib/types";
import { startOfDay } from "../lib/db";

export function TeacherPortal({
  external,
  onClose,
}: {
  external?: boolean;
  onClose?: () => void;
} = {}) {
  const { db, lang, t, loginAsTeacher, resetPortalSession } = useApp();
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState<Teacher | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const unlock = async () => {
    setLoading(true);
    setError(false);
    try {
      const teacher = await loginAsTeacher(code);
      if (teacher) {
        setUnlocked(teacher);
        pushToast(lang === "ar" ? `مرحباً بك مستر ${teacher.name}` : `Welcome Mr. ${teacher.name}`);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (unlocked) {
    return <TeacherView teacher={unlocked} onSignOut={() => { setUnlocked(null); resetPortalSession(); }} />;
  }

  const sampleTeachers = db.teachers.slice(0, 3);

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={lang === "ar" ? "بوابة المدرس الذكية" : "Smart Teacher Portal"}
        subtitle={lang === "ar" ? "وصول آمن للمدرسين لمتابعة الأداء والمدفوعات والمجموعات" : "Secure portal for teachers to track performance, payments, and schedules"}
        actions={
          external && onClose ? (
            <Button variant="secondary" onClick={onClose}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("action.back")}
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden shadow-2xl">
          <div className="relative bg-gradient-to-br from-indigo-700 to-violet-800 p-8 text-center text-white">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20">
              <Lock className="h-8 w-8 text-indigo-100" />
            </div>
            <h3 className="relative text-xl font-bold">{lang === "ar" ? "تسجيل دخول المعلمين" : "Teacher Portal Login"}</h3>
            <p className="relative mt-1 text-xs text-indigo-200/95">
              {lang === "ar" ? "يرجى إدخال كود المدرس الخاص بك للوصول إلى لوحة التحكم" : "Please enter your teacher code to access your dashboard"}
            </p>
          </div>
          
          <div className="space-y-4 p-6">
            <Field label={lang === "ar" ? "كود المدرس" : "Teacher Code"}>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
                <Input
                  placeholder={lang === "ar" ? "أدخل كود المكون من 6 خانات" : "Enter 6-character code"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                  className="font-mono ps-9"
                />
              </div>
            </Field>

            {error && (
              <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                {lang === "ar" ? "عذراً، هذا الكود غير مسجل في السنتر" : "Sorry, this code is not registered at the center"}
              </p>
            )}

            <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20" onClick={unlock} disabled={loading}>
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lock className="h-4 w-4" />}
              {loading ? (lang === "ar" ? "جاري التحقق..." : "Verifying...") : (lang === "ar" ? "دخول بوابة المدرس" : "Enter Teacher Portal")}
            </Button>

            {sampleTeachers.length > 0 && (
              <div className="pt-2 border-t border-line/60">
                <p className="mb-2 text-[11px] text-faint font-medium">
                  {lang === "ar" ? "أكواد معلمين للتجربة السريعة:" : "Sample teacher codes:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sampleTeachers.map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setCode(tc.id)}
                      className="rounded-lg border border-line bg-elevated/40 px-2.5 py-1.5 font-mono text-[10px] text-muted transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10"
                    >
                      {tc.name} ({tc.id})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------- Teacher View ------------------------------- */
function TeacherView({ teacher, onSignOut }: { teacher: Teacher; onSignOut: () => void }) {
  const { db, lang, t } = useApp();
  const sym = currencySymbol(db);
  const [tab, setTab] = useState("students");
  const [query, setQuery] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 1. Students registered under this teacher only
  const teacherStudents = useMemo(() => {
    return db.students.filter((s) =>
      s.teachers.some((tr) => tr.teacherId.toLowerCase() === teacher.id.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [db.students, teacher.id]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return teacherStudents;
    return teacherStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [teacherStudents, query]);

  // 2. Groups managed by this teacher
  const teacherGroups = useMemo(() => {
    return db.groups.filter((g) => g.teacherId?.toLowerCase() === teacher.id.toLowerCase());
  }, [db.groups, teacher.id]);

  const teacherGrades = useMemo(() => {
    const gradesFromGroups = teacherGroups.map(g => g.grade).filter(Boolean);
    const gradesFromStudents = teacherStudents.map(s => s.grade).filter(Boolean);
    const uniqueGradeIds = Array.from(new Set([...gradesFromGroups, ...gradesFromStudents]));
    return GRADES.filter(g => uniqueGradeIds.includes(g.id));
  }, [teacherGroups, teacherStudents]);

  // 3. Schedule events in halls/classrooms for these groups
  const groupIds = useMemo(() => teacherGroups.map((g) => g.id), [teacherGroups]);
  const scheduleEvents = useMemo(() => {
    return db.scheduleEvents.filter((e) => groupIds.includes(e.groupId));
  }, [db.scheduleEvents, groupIds]);

  // 4. Payments made by students allocated to this teacher
  const payments = useMemo(() => {
    return db.payments
      .filter((p) => p.teacherId?.toLowerCase() === teacher.id.toLowerCase())
      .sort((a, b) => b.date - a.date);
  }, [db.payments, teacher.id]);

  // 5. Financial Metrics Math
  const totalIncome = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const centerShare = useMemo(() => {
    if (teacher.payType === "percentage") {
      return totalIncome * (teacher.commissionRate / 100);
    } else {
      // Fixed flat fee paid to the center
      return teacher.fixedAmount;
    }
  }, [totalIncome, teacher]);

  const netProfit = useMemo(() => {
    return Math.max(0, totalIncome - centerShare);
  }, [totalIncome, centerShare]);

  // Days mapping helper
  const dayName = (dayNum: number) => {
    const daysAr: Record<number, string> = {
      1: "الإثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت", 7: "الأحد"
    };
    const daysEn: Record<number, string> = {
      1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday"
    };
    return lang === "ar" ? daysAr[dayNum] : daysEn[dayNum];
  };

  const handleSendWhatsApp = (student: Student) => {
    const { url } = getWhatsAppReportUrl(db, student, customNote);
    window.open(url, "_blank");
    setCustomNote("");
    setSelectedStudent(null);
    pushToast(lang === "ar" ? "تم تجهيز التقرير وفتح واتساب" : "Report generated and WhatsApp opened successfully!");
  };

  return (
    <div className="animate-fade-in space-y-5 pb-12">
      {/* Premium Header Bar */}
      <Card className="mesh-brand overflow-hidden text-white border-0 shadow-lg relative">
        <div className="orb float-soft -right-10 -top-10 h-36 w-36 bg-white/12" />
        <div className="orb float-soft -bottom-16 left-1/3 h-40 w-40 bg-accent-400/20" style={{ animationDelay: "1s" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider backdrop-blur-sm">
                {lang === "ar" ? "بوابة المدرس الذكية" : "Teacher Portal"}
              </span>
              <span className="font-mono text-xs text-white/70">· {teacher.id}</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">مستر {teacher.name}</h1>
            <p className="mt-1 text-sm text-white/80">
              {teacher.subjects.map((s) => subjectLabel(s, lang)).join(" · ")}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={onSignOut}
            className="border-0 bg-white/15 text-white hover:bg-rose-600 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {lang === "ar" ? "خروج من البوابة" : "Log Out"}
          </Button>
        </div>
      </Card>

      {/* Bento Grid Analytics Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm hover:shadow transition">
          <div>
            <p className="text-xs font-semibold text-muted flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {lang === "ar" ? "إجمالي دخل الطلاب" : "Total Revenue"}
            </p>
            <p className="mt-2 text-xl font-black text-ink">{formatMoney(totalIncome, sym)}</p>
          </div>
          <p className="mt-2 text-[10px] text-faint">
            {lang === "ar" ? "من مدفوعات طلاب المجموعات" : "From student allocations"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm hover:shadow transition">
          <div>
            <p className="text-xs font-semibold text-muted flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-violet-500" />
              {lang === "ar" ? "نسبة السنتر" : "Center's Share"}
            </p>
            <p className="mt-2 text-xl font-black text-violet-600">{formatMoney(centerShare, sym)}</p>
          </div>
          <p className="mt-2 text-[10px] text-violet-500/80">
            {teacher.payType === "percentage" 
              ? `${lang === "ar" ? "حصة السنتر" : "Center's Share"}: ${teacher.commissionRate}%`
              : `${lang === "ar" ? "رسم ثابت" : "Flat Fee"}: ${formatMoney(teacher.fixedAmount, sym)}`}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm hover:shadow transition ring-2 ring-emerald-500/10 bg-emerald-500/[0.01]">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-emerald-500" />
              {lang === "ar" ? "صافي الربح للمعلم" : "Net Profit"}
            </p>
            <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(netProfit, sym)}</p>
          </div>
          <p className="mt-2 text-[10px] text-emerald-600 font-bold">
            {lang === "ar" ? "مستحق الصرف والتحصيل" : "Ready to withdraw"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm hover:shadow transition">
          <div>
            <p className="text-xs font-semibold text-muted flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-500" />
              {lang === "ar" ? "مؤشرات المجموعات" : "Schedules & Roster"}
            </p>
            <p className="mt-2 text-xl font-black text-indigo-600">{teacherStudents.length} <span className="text-xs font-normal text-muted">{lang === "ar" ? "طالب" : "students"}</span></p>
          </div>
          <p className="mt-2 text-[10px] text-faint">
            {lang === "ar" ? `موزعين على ${teacherGroups.length} مجموعات` : `In ${teacherGroups.length} groups`}
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-line gap-2">
        <button
          onClick={() => setTab("students")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors",
            tab === "students"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          👤 {lang === "ar" ? "طلابي المسجلين" : "My Students"} ({teacherStudents.length})
        </button>
        <button
          onClick={() => setTab("schedule")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors",
            tab === "schedule"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          📅 {lang === "ar" ? "المجموعات ومواعيد القاعات" : "Schedules & Halls"} ({teacherGroups.length})
        </button>
        <button
          onClick={() => setTab("payments")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors",
            tab === "payments"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          💵 {lang === "ar" ? "المدفوعات أولاً بأول" : "Live Payments Log"} ({payments.length})
        </button>
        <button
          onClick={() => setTab("exams")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors",
            tab === "exams"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          📝 {lang === "ar" ? "الامتحانات والدرجات" : "Exams & Grades"}
        </button>
      </div>

      {/* Active Tab Panel */}
      <Card className="p-0 overflow-hidden">
        {tab === "students" && (
          <div className="space-y-4 p-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
              <Input
                placeholder={lang === "ar" ? "بحث في قائمة طلابي..." : "Search my students..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ps-9 h-10"
              />
            </div>

            {filteredStudents.length === 0 ? (
              <div className="py-12"><EmptyState title={lang === "ar" ? "لم يتم العثور على طلاب مطابقين" : "No matching students found"} /></div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-elevated/40 text-[11px] uppercase tracking-wider text-faint">
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "اسم الطالب" : "Student Name"}</th>
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "كود الطالب" : "Student Code"}</th>
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "المرحلة الدراسية" : "Grade"}</th>
                      <th className="px-4 py-3 text-center font-bold">{lang === "ar" ? "المجموعات المشترك بها" : "Groups"}</th>
                      <th className="px-4 py-3 text-center font-bold">{lang === "ar" ? "رقم ولي الأمر" : "Parent Phone"}</th>
                      <th className="px-4 py-3 text-end font-bold">{lang === "ar" ? "تقرير واتساب" : "WhatsApp Report"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filteredStudents.map((s) => {
                      const grade = GRADES.find((g) => g.id === s.grade);
                      const initial = s.name.split(" ").map((p) => p[0]).slice(0, 2).join("") || "—";
                      
                      // Get groups student belongs to of this teacher
                      const studentGroups = db.groups
                        .filter((g) => s.groupIds.includes(g.id) && g.teacherId?.toLowerCase() === teacher.id.toLowerCase())
                        .map((g) => g.name);

                      return (
                        <tr key={s.id} className="hover:bg-elevated/40 transition">
                          <td className="px-4 py-3.5 font-semibold text-ink">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                                {initial}
                              </div>
                              <span className="truncate">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-muted">{s.id}</td>
                          <td className="px-4 py-3.5">
                            {grade ? (
                              <span className="text-xs font-medium text-ink bg-elevated px-2 py-1 rounded-md">
                                {gradeLabel(s.grade, lang)}
                              </span>
                            ) : <span className="text-xs text-muted">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {studentGroups.length > 0 ? (
                              <span className="text-xs font-medium text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                                {studentGroups.join(" , ")}
                              </span>
                            ) : <span className="text-xs text-faint">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono text-xs text-muted">
                            {s.parentPhone || s.studentPhone || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-end">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                              onClick={() => setSelectedStudent(s)}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {lang === "ar" ? "تقرير بضغطة زر" : "1-Click Report"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "schedule" && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              {lang === "ar" ? "قائمة المجموعات المخصصة للمعلم ومواقع القاعات" : "Assigned Groups & Classroom Schedule"}
            </h3>

            {teacherGroups.length === 0 ? (
              <div className="py-12"><EmptyState title={lang === "ar" ? "لا توجد مجموعات مسجلة باسمك بعد" : "No groups registered under your name yet"} /></div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {teacherGroups.map((g) => {
                  // Find all schedule events of this group
                  const events = scheduleEvents.filter((ev) => ev.groupId === g.id);
                  return (
                    <div key={g.id} className="rounded-xl border border-line p-4 space-y-3 hover:border-indigo-400 transition bg-surface/60">
                      <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-ink truncate">{g.name}</p>
                          <p className="text-[11px] text-muted">{subjectLabel(g.subject, lang)}</p>
                        </div>
                        <Badge tone="brand">
                          {g.grade ? gradeLabel(g.grade, lang) : "—"}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted">🗓️ {lang === "ar" ? "مواعيد الحصص الأسبوعية:" : "Weekly meeting schedules:"}</p>
                        {events.length === 0 ? (
                          <p className="text-[11px] text-faint italic">{lang === "ar" ? "لم يتم تحديد مواعيد أو قاعات بعد" : "No schedule slots set yet"}</p>
                        ) : (
                          <div className="space-y-1">
                            {events.map((ev) => {
                              const classroomName = db.classrooms.find((c) => c.id === ev.classroomId)?.name ?? ev.classroomId;
                              return (
                                <div key={ev.id} className="flex items-center justify-between bg-elevated/40 p-2 rounded-lg text-xs font-medium">
                                  <span className="text-ink">{dayName(ev.dayOfWeek)}</span>
                                  <span className="text-indigo-600 dark:text-indigo-300 font-mono">{ev.startTime} - {ev.endTime}</span>
                                  <span className="text-muted flex items-center gap-1">
                                    <Building className="h-3 w-3 text-faint" />
                                    {classroomName}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              {lang === "ar" ? "سجل مدفوعات الطلاب (تحديث فوري)" : "Student Payment Receipts (Live Feed)"}
            </h3>

            {payments.length === 0 ? (
              <div className="py-12"><EmptyState title={lang === "ar" ? "لا توجد أي مدفوعات مسجلة لطلابك بعد" : "No payment records registered for your students yet"} /></div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-elevated/40 text-[11px] uppercase tracking-wider text-faint">
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "اسم الطالب" : "Student"}</th>
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "النوع" : "Payment Type"}</th>
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "عن شهر" : "Cycle Month"}</th>
                      <th className="px-4 py-3 text-start font-bold">{lang === "ar" ? "التاريخ" : "Received Date"}</th>
                      <th className="px-4 py-3 text-end font-bold">{lang === "ar" ? "المبلغ المدفوع" : "Amount Paid"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {payments.slice(0, 50).map((p) => {
                      const studentName = db.students.find((s) => s.id === p.studentId)?.name ?? "—";
                      return (
                        <tr key={p.id} className="hover:bg-elevated/40 transition">
                          <td className="px-4 py-3 font-medium text-ink">{studentName}</td>
                          <td className="px-4 py-3">
                            <Badge tone="success">{lang === "ar" ? "رسوم شهرية" : "Monthly fee"}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">{p.month}</td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {new Date(p.date).toLocaleDateString(lang === "ar" ? "ar-EG" : undefined)}
                          </td>
                          <td className="px-4 py-3 text-end font-bold text-emerald-600">
                            +{formatMoney(p.amount, sym)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "exams" && (
          <TeacherExamsTab
            teacher={teacher}
            teacherGroups={teacherGroups}
            teacherGrades={teacherGrades}
          />
        )}
      </Card>

      {/* 1-Click WhatsApp Quick Composer Modal */}
      <Modal
        open={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={lang === "ar" ? "إرسال تقرير فوري عبر واتساب 📲" : "Instant WhatsApp Report 📲"}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedStudent(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => selectedStudent && handleSendWhatsApp(selectedStudent)}
            >
              <Send className="h-4 w-4" />
              {lang === "ar" ? "فتح واتساب وإرسال" : "Open WhatsApp & Send"}
            </Button>
          </>
        }
      >
        {selectedStudent && (
          <div className="space-y-4">
            <div className="rounded-xl bg-elevated/60 p-4 border border-line">
              <p className="text-xs text-muted">{lang === "ar" ? "المستلم التلقائي (رقم ولي الأمر):" : "Automated Recipient (Parent Phone):"}</p>
              <p className="text-sm font-bold text-ink mt-1 font-mono flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-emerald-500" />
                {selectedStudent.parentPhone || selectedStudent.studentPhone || (lang === "ar" ? "لا يوجد هاتف مسجل" : "No phone registered")}
              </p>
            </div>

            <Field label={lang === "ar" ? "إضافة ملاحظة مخصصة للتقرير (اختياري)" : "Add Custom Note for Report (Optional)"}>
              <Textarea
                rows={3}
                placeholder={lang === "ar" ? "مثال: أداء ممتاز اليوم ومستمر في التقدم والتركيز في الحصة..." : "e.g. Excellent performance in class today, very focused..."}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="mt-1"
              />
            </Field>

            <p className="text-[11px] text-muted leading-relaxed">
              💡 {lang === "ar" ? "سيتم توليد رسالة واتساب رسمية منسقة بضغطة زر تحتوي على الحضور، متوسط الدرجات، الرسوم والدرجات الأخيرة وتوجيهكم لتطبيق واتساب مباشرة لإتمام الإرسال." : "A fully formulated professional WhatsApp message with attendance stats, exam average, and fee balances will be automatically formatted and loaded into WhatsApp."}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================= TEACHER EXAMS TAB */
function TeacherExamsTab({
  teacher,
  teacherGroups,
  teacherGrades,
}: {
  teacher: Teacher;
  teacherGroups: any[];
  teacherGrades: any[];
}) {
  const { db, lang, t, upsert, remove } = useApp();
  const ar = lang === "ar";
  
  const [activeExamId, setActiveExamId] = useState("");
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  
  const [examForm, setExamForm] = useState<Exam>({
    id: "",
    groupId: "",
    name: "",
    maxGrade: 50,
    date: Date.now(),
    lastUpdated: Date.now(),
  });

  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  // Teacher Exams
  const teacherExams = useMemo(() => {
    return db.exams.filter((e) => teacherGroups.some((g) => g.id === e.groupId))
      .sort((a, b) => b.date - a.date);
  }, [db.exams, teacherGroups]);

  // Filter groups in modal based on grade and subject
  const modalFilteredGroups = useMemo(() => {
    return teacherGroups.filter((g) => {
      const matchGrade = !selectedGradeId || g.grade === selectedGradeId;
      const matchSubject = !selectedSubject || g.subject === selectedSubject;
      return matchGrade && matchSubject;
    });
  }, [teacherGroups, selectedGradeId, selectedSubject]);

  const handleTeacherGradeChange = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    const matched = teacherGroups.filter(g => 
      (!gradeId || g.grade === gradeId) && (!selectedSubject || g.subject === selectedSubject)
    );
    if (matched.length > 0) {
      setExamForm((f: Exam) => ({ ...f, groupId: matched[0].id }));
    } else {
      setExamForm((f: Exam) => ({ ...f, groupId: "" }));
    }
  };

  const handleTeacherSubjectChange = (subject: string) => {
    setSelectedSubject(subject);
    const matched = teacherGroups.filter(g => 
      (!selectedGradeId || g.grade === selectedGradeId) && (!subject || g.subject === subject)
    );
    if (matched.length > 0) {
      setExamForm((f: Exam) => ({ ...f, groupId: matched[0].id }));
    } else {
      setExamForm((f: Exam) => ({ ...f, groupId: "" }));
    }
  };

  const openCreateExam = () => {
    const defaultSubject = teacher.subjects[0] || "";
    const defaultGradeId = teacherGrades[0]?.id || "";
    const matched = teacherGroups.filter(g => 
      (!defaultGradeId || g.grade === defaultGradeId) && (!defaultSubject || g.subject === defaultSubject)
    );
    
    setExamForm({
      id: "",
      groupId: matched[0]?.id || "",
      name: "",
      maxGrade: 100,
      date: Date.now(),
      lastUpdated: Date.now(),
    });
    setSelectedGradeId(defaultGradeId);
    setSelectedSubject(defaultSubject);
    setEditingExam(null);
    setExamModalOpen(true);
  };

  const openEditExam = (e: Exam) => {
    setFormValues(e);
  };

  const setFormValues = (e: Exam) => {
    setExamForm({ ...e });
    const g = db.groups.find((x) => x.id === e.groupId);
    setSelectedGradeId(g?.grade ?? "");
    setSelectedSubject(g?.subject ?? "");
    setEditingExam(e);
    setExamModalOpen(true);
  };

  const saveExam = () => {
    if (!examForm.name.trim() || !examForm.groupId) {
      pushToast(ar ? "يرجى ملء جميع الحقول المطلوبة واختيار المجموعة" : "Please fill in all fields and select a group");
      return;
    }
    const targetExam = {
      ...examForm,
      id: examForm.id || `exam_${Date.now()}`,
      lastUpdated: Date.now()
    };
    upsert("exams", targetExam);
    pushToast(ar ? "تم حفظ الامتحان بنجاح" : "Exam saved successfully!");
    setExamModalOpen(false);
    setActiveExamId(targetExam.id);
  };

  const activeExam = db.exams.find(e => e.id === activeExamId);

  // Students in active exam's group
  const examStudents = useMemo(() => {
    if (!activeExam) return [];
    return db.students.filter(s => s.groupIds.includes(activeExam.groupId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db.students, activeExam]);

  const gradeOf = (sid: string): ExamGrade | undefined =>
    db.examGrades.find((g) => g.examId === activeExamId && g.studentId === sid);

  const setStudentGrade = (sid: string, value: number) => {
    if (!activeExamId) return;
    const existing = gradeOf(sid);
    upsert("examGrades", {
      id: existing?.id ?? `${activeExamId}_${sid}`,
      examId: activeExamId, studentId: sid, obtainedGrade: value,
      notes: existing?.notes, published: existing?.published, publishedAt: existing?.publishedAt,
      lastUpdated: Date.now(),
    });
  };

  const publishGrade = (sid?: string) => {
    if (!activeExamId) return;
    const targets = examStudents.filter((s) => !sid || s.id === sid);
    let count = 0;
    for (const s of targets) {
      const g = gradeOf(s.id);
      if (!g) continue;
      upsert("examGrades", { ...g, published: true, publishedAt: Date.now(), lastUpdated: Date.now() });
      count++;
    }
    pushToast(ar ? "تم نشر الدرجات بنجاح لوحة أولياء الأمور والطلاب" : "Grades successfully published to portal!");
  };

  const handleShareGradeWhatsApp = (student: Student, obtainedGrade: number) => {
    if (!activeExam) return;
    const { url } = getWhatsAppExamGradeUrl(db, student, activeExam.name, activeExam.maxGrade, obtainedGrade);
    window.open(url, "_blank");
    pushToast(ar ? "تم فتح واتساب لمشاركة الدرجة" : "WhatsApp opened successfully!");
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" />
            {ar ? "إدارة امتحانات المعلم والدرجات" : "Teacher Exams & Grades Management"}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {ar ? "أضف امتحانات، رصد درجات الطلاب، انشرها لأولياء الأمور أو شاركها مباشرة عبر واتساب" : "Add exams, enter grades, publish them to parent portal or share on WhatsApp"}
          </p>
        </div>
        <Button onClick={openCreateExam} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
          <Plus className="h-4 w-4" />
          {ar ? "إضافة امتحان جديد" : "New Exam"}
        </Button>
      </div>

      {/* Grid of Exams */}
      {teacherExams.length === 0 ? (
        <div className="py-12"><EmptyState title={ar ? "لم تقم بإنشاء أي امتحانات بعد" : "No exams created yet"} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teacherExams.map((e) => {
            const group = db.groups.find((g) => g.id === e.groupId);
            const totalStudents = db.students.filter(s => s.groupIds.includes(e.groupId)).length;
            const gradedCount = db.examGrades.filter(eg => eg.examId === e.id).length;
            const isSelected = activeExamId === e.id;

            return (
              <Card 
                key={e.id} 
                className={cn(
                  "card-hover p-4 border transition-all cursor-pointer",
                  isSelected ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-500/[0.01]" : "border-line"
                )}
                onClick={() => setActiveExamId(e.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0" onClick={() => setActiveExamId(e.id)}>
                    <p className="font-bold text-ink truncate text-sm">{e.name}</p>
                    <p className="text-[11px] text-muted mt-0.5">{group?.name ?? "—"} · {group ? subjectLabel(group.subject, lang) : "—"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={(evt) => { evt.stopPropagation(); openEditExam(e); }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      onClick={(evt) => { evt.stopPropagation(); remove("exams", e.id); if(activeExamId === e.id) setActiveExamId(""); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3 text-xs">
                  <div>
                    <span className="font-semibold text-ink">{gradedCount}</span>
                    <span className="text-muted"> / {totalStudents} {ar ? "مرصود" : "Graded"}</span>
                  </div>
                  <Badge tone="brand">
                    {ar ? `الدرجة: من ${e.maxGrade}` : `Max: ${e.maxGrade}`}
                  </Badge>
                  <span className="text-[10px] text-faint">
                    {new Date(e.date).toLocaleDateString(ar ? "ar-EG" : undefined)}
                  </span>
                </div>

                <div className="mt-2.5">
                  <Button 
                    size="sm" 
                    variant={isSelected ? "primary" : "secondary"} 
                    className={cn("w-full text-xs font-semibold h-8", isSelected ? "bg-indigo-600 text-white hover:bg-indigo-700" : "")}
                  >
                    <Award className="h-3.5 w-3.5" />
                    {ar ? "رصد وإرسال الدرجات" : "Grade & Send"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Selected Exam Student Grading Sheet */}
      {activeExam && (
        <div className="border-t border-line/80 pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-elevated/40 p-4 rounded-xl border border-line/60">
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {ar ? "كشف درجات الاختبار النشط:" : "Active Exam Grading Sheet:"}
              </p>
              <h4 className="font-extrabold text-ink text-base mt-0.5">{activeExam.name}</h4>
              <p className="text-xs text-muted">
                {ar ? `المجموعة: ${db.groups.find(g => g.id === activeExam.groupId)?.name ?? "—"} · النهاية العظمى: ${activeExam.maxGrade}` : `Group: ${db.groups.find(g => g.id === activeExam.groupId)?.name ?? "—"} · Max score: ${activeExam.maxGrade}`}
              </p>
            </div>
            
            {examStudents.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  onClick={() => publishGrade()}
                >
                  <Send className="h-4 w-4" />
                  {ar ? "نشر الكل بالبوابة" : "Publish All to Portal"}
                </Button>
              </div>
            )}
          </div>

          {examStudents.length === 0 ? (
            <div className="py-6"><EmptyState title={ar ? "لا يوجد طلاب مسجلين في مجموعة هذا الامتحان" : "No students in this group"} /></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-elevated/50 text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-3 text-start font-bold">{ar ? "اسم الطالب" : "Student Name"}</th>
                    <th className="px-4 py-3 text-start font-bold">{ar ? "الكود" : "Code"}</th>
                    <th className="px-4 py-3 text-center font-bold" style={{ width: "160px" }}>{ar ? `درجة الطالب (من ${activeExam.maxGrade})` : `Grade (max ${activeExam.maxGrade})`}</th>
                    <th className="px-4 py-3 text-center font-bold">{ar ? "النسبة المئوية" : "Percentage"}</th>
                    <th className="px-4 py-3 text-end font-bold">{ar ? "إرسال ونشر الدرجة" : "Send & Publish"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {examStudents.map((s) => {
                    const eg = gradeOf(s.id);
                    const obtained = eg?.obtainedGrade ?? 0;
                    const pct = activeExam.maxGrade > 0 ? Math.round((obtained / activeExam.maxGrade) * 100) : 0;
                    const isPublished = eg?.published;

                    return (
                      <tr key={s.id} className="hover:bg-elevated/20 transition">
                        <td className="px-4 py-3 font-semibold text-ink">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{s.id}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Input 
                              type="number" 
                              value={eg ? eg.obtainedGrade : ""}
                              onChange={(evt) => setStudentGrade(s.id, Math.min(activeExam.maxGrade, Math.max(0, +evt.target.value)))}
                              placeholder="0"
                              className="w-20 text-center h-8 font-bold"
                            />
                            <span className="text-xs text-faint">/ {activeExam.maxGrade}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge tone={pct >= 50 ? "success" : "danger"} className="font-mono">
                            {pct}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-2">
                            {/* Publish single grade to Parent/Student portal */}
                            <Button
                              size="sm"
                              variant={isPublished ? "secondary" : "subtle"}
                              onClick={() => {
                                if (!eg) {
                                  pushToast(ar ? "يرجى إدخال درجة أولاً" : "Please input a grade first");
                                  return;
                                }
                                upsert("examGrades", { ...eg, published: true, publishedAt: Date.now(), lastUpdated: Date.now() });
                                pushToast(ar ? "تم نشر الدرجة" : "Grade published");
                              }}
                              className={cn("h-8 text-xs", isPublished ? "text-faint bg-elevated" : "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-300")}
                            >
                              {isPublished ? (ar ? "تم النشر ✓" : "Published ✓") : (ar ? "نشر بالبوابة" : "Publish")}
                            </Button>

                            {/* Share single grade via WhatsApp */}
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold flex items-center gap-1.5"
                              onClick={() => handleShareGradeWhatsApp(s, obtained)}
                              disabled={!eg}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {ar ? "واتساب" : "WhatsApp"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Exam Create/Edit Modal */}
      <Modal
        open={examModalOpen}
        onClose={() => setExamModalOpen(false)}
        title={editingExam ? (ar ? "تعديل بيانات الامتحان" : "Edit Exam") : (ar ? "إضافة امتحان جديد" : "Add New Exam")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExamModalOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={saveExam}>
              {t("action.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={ar ? "اسم الامتحان" : "Exam Name"}>
            <Input 
              value={examForm.name} 
              onChange={(e) => setExamForm((f: Exam) => ({ ...f, name: e.target.value }))} 
              placeholder={ar ? "مثال: اختبار الجبر والتحليل الحصري" : "e.g. Algebra Quiz 1"} 
            />
          </Field>

          {/* Subject Selector: only visible if teacher has more than 1 subject */}
          {teacher.subjects.length > 1 ? (
            <Field label={ar ? "مادة الامتحان" : "Subject"}>
              <Select value={selectedSubject} onChange={(e) => handleTeacherSubjectChange(e.target.value)}>
                {teacher.subjects.map((sub) => (
                  <option key={sub} value={sub}>{subjectLabel(sub, lang)}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="bg-elevated/40 p-3 rounded-lg border border-line/60 text-xs text-muted">
              <strong>{ar ? "المادة الدراسية:" : "Subject:"} </strong>
              <span>{subjectLabel(teacher.subjects[0] || "", lang)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Grade Selector: only shows grades taught by this teacher */}
            <Field label={ar ? "الصف الدراسي (للصف الكام)" : "Grade"}>
              <Select value={selectedGradeId} onChange={(e) => handleTeacherGradeChange(e.target.value)}>
                <option value="">{ar ? "اختر الصف..." : "Select Grade..."}</option>
                {teacherGrades.map((g) => (
                  <option key={g.id} value={g.id}>{ar ? g.ar : g.en}</option>
                ))}
              </Select>
            </Field>

            {/* Group Selector: filtered based on grade & subject */}
            <Field label={ar ? "المجموعة المستهدفة" : "Target Group"}>
              <Select value={examForm.groupId} onChange={(e) => setExamForm((f: Exam) => ({ ...f, groupId: e.target.value }))}>
                <option value="">{ar ? "اختر المجموعة..." : "Select Group..."}</option>
                {modalFilteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "درجات الامتحان (من كام)" : "Max Grade"}>
              <Input 
                type="number" 
                value={examForm.maxGrade} 
                onChange={(e) => setExamForm((f: Exam) => ({ ...f, maxGrade: +e.target.value }))} 
              />
            </Field>

            <Field label={t("att.date")}>
              <Input 
                type="date" 
                value={new Date(examForm.date).toISOString().slice(0, 10)} 
                onChange={(e) => setExamForm((f: Exam) => ({ ...f, date: startOfDay(new Date(e.target.value).getTime()) }))} 
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

