import { useMemo, useState } from "react";
import {
  Lock, FileText, ClipboardCheck, Award, Wallet, BookOpen, StickyNote,
  Bell, GraduationCap, CalendarClock, ChevronLeft, Send,
  Pin, Layers, DollarSign
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader, Button, Card, Input, Textarea, Badge, pushToast,
} from "../components/ui";
import { cn } from "../utils/cn";
import { Donut } from "../components/charts";
import { MonthlyAttendance } from "../components/MonthlyAttendance";
import { generateStudentPdf } from "../lib/pdf";
import type { Student } from "../lib/types";
import { startOfDay, now } from "../lib/db";
import { gradeLabel, subjectLabel } from "../lib/constants";
import {
  studentAverage, totalPaidFor, balanceDue,
  currencySymbol, formatMoney,
} from "../lib/analytics";

export function ParentPortal({
  external,
  onClose,
  isStudent,
}: {
  external?: boolean;
  onClose?: () => void;
  isStudent?: boolean;
} = {}) {
  const { db, t, lang, loginAsStudent, resetPortalSession, centerId, DEMO_CENTER } = useApp();
  const ar = lang === "ar";
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState<Student | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const unlock = async () => {
    setLoading(true);
    setError(false);
    try {
      const found = await loginAsStudent(code);
      if (found) {
        setUnlocked(found);
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
    return <StudentView student={unlocked} isStudent={isStudent} onBack={() => { setUnlocked(null); resetPortalSession(); }} />;
  }

  const sample = db.students.slice(0, 3);

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title={isStudent ? (ar ? "بوابة الطالب" : "Student Portal") : t("parent.title")}
        subtitle={isStudent ? (ar ? "عرض تفاعلي لدرجاتك وحضورك ومستواك الدراسي" : "An interactive view of your grades, attendance, and progress") : t("parent.subtitle")}
        actions={
          external && onClose ? (
            <Button variant="secondary" onClick={onClose} className="font-bold">
              <ChevronLeft className={cn("h-4 w-4", ar ? "rotate-180" : "")} />
              {t("action.back")}
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden border border-line shadow-xl">
          {/* Cover Banner */}
          <div className="relative bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800 p-7 text-center text-white">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl animate-pulse" />
            <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/10 shadow-inner">
              <Lock className="h-7 w-7" />
            </div>
            <h3 className="relative text-lg font-black">{isStudent ? (ar ? "الوصول لسجل الطالب" : "Access Student Record") : t("parent.gateTitle")}</h3>
            <p className="relative mt-1 text-xs text-white/80 leading-relaxed">{isStudent ? (ar ? "أدخل رمز الطالب أو هاتف ولي الأمر أو امسح رمز QR الخاص بك" : "Enter student code, parent phone, or scan your QR code") : t("parent.gateDesc")}</p>
          </div>

          <div className="space-y-4 p-6">
            <div className="relative animate-fade-in">
              <GraduationCap className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4.5 w-4.5 text-faint" />
              <Input
                placeholder={t("parent.code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && unlock()}
                className="font-mono ps-9.5 text-xs h-10 border-line shadow-sm hover:border-brand-300 focus:border-brand-500"
              />
            </div>

            {error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/15 p-2.5 rounded-lg text-center animate-shake">
                ⚠️ {t("parent.notFound")}
              </p>
            )}

            <Button className="w-full font-bold h-10 shadow-brand transition-all hover:scale-[1.01]" onClick={unlock} disabled={loading}>
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lock className="h-4 w-4" />}
              {loading ? (ar ? "جاري التحقق..." : "Verifying...") : t("parent.unlock")}
            </Button>

            {sample.length > 0 && centerId === DEMO_CENTER && (
              <div className="pt-2 border-t border-line/60">
                <p className="mb-2 text-[10px] font-bold text-faint uppercase tracking-wider">
                  {ar ? "🔑 أكواد تجريبية سريعة:" : "🔑 Sample credentials:"}
                </p>
                <div className="flex flex-col gap-1.5">
                  {sample.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-[10px] border border-brand-100/40 bg-brand-50/20 dark:bg-brand-500/5 px-2.5 py-1.5 rounded-lg">
                      <span className="font-extrabold text-ink truncate max-w-[150px]">{s.name}</span>
                      <div className="flex gap-1.5 font-mono">
                        <button
                          onClick={() => { setCode(s.id); }}
                          className="px-2 py-1 rounded bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200 cursor-pointer font-bold"
                          title="Use Code"
                        >
                          {s.id}
                        </button>
                      </div>
                    </div>
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

/* ------------------------------ Student view ----------------------------- */
function StudentView({ student, isStudent, onBack }: { student: Student; isStudent?: boolean; onBack: () => void }) {
  const { db, t, lang, upsert } = useApp();
  const ar = lang === "ar";
  const sym = currencySymbol(db);
  const studentAtts = db.attendance.filter(a => a.studentId === student.id);
  const sExpected = studentAtts.length;
  const sPresent = studentAtts.filter(a => a.status === "PRESENT" || a.status === "LATE").length;
  const attRate = sExpected > 0 ? Math.round((sPresent / sExpected) * 100) : 100;
  const avg = studentAverage(db, student.id);
  const paid = totalPaidFor(db, student.id);
  const due = balanceDue(db, student);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | undefined>(undefined);

  // Grouped details
  const studentGroups = useMemo(() => {
    return student.groupIds
      .map((id) => db.groups.find((g) => g.id === id))
      .filter(Boolean);
  }, [db.groups, student.groupIds]);

  const grades = useMemo(() => {
    const examsOfGroups = db.exams.filter((e) => student.groupIds.includes(e.groupId));
    return examsOfGroups.map((exam) => {
      const g = db.examGrades.find((grade) => grade.examId === exam.id && grade.studentId === student.id);
      return { exam, g };
    }).sort((a, b) => b.exam.date - a.exam.date);
  }, [db.exams, db.examGrades, student.groupIds, student.id]);

  const homework = db.assignments.filter((a) => student.groupIds.includes(a.groupId));
  
  const notes = db.studentNotes
    .filter((n) => n.studentId === student.id)
    .sort((a, b) => b.date - a.date);

  const teachers = (student.teachers ?? [])
    .map((tr) => db.teachers.find((x) => x.id === tr.teacherId))
    .filter(Boolean);

  // notifications feed: upcoming exams + published grades + homework
  const notifications = useMemo(() => {
    const today = startOfDay(now());
    type Item = { id: string; kind: "exam" | "grade" | "hw"; title: string; detail: string; ts: number };
    const items: Item[] = [];
    for (const e of db.exams) {
      if (student.groupIds.includes(e.groupId) && e.date >= today) {
        items.push({ id: `ex_${e.id}`, kind: "exam", title: e.name, detail: ar ? `امتحان قادم · ${new Date(e.date).toLocaleDateString()}` : `Exam coming soon · ${new Date(e.date).toLocaleDateString()}`, ts: e.date });
      }
    }
    for (const g of db.examGrades) {
      if (g.studentId !== student.id || !g.published) continue;
      const exam = db.exams.find((x) => x.id === g.examId);
      if (exam) items.push({ id: `gr_${g.id}`, kind: "grade", title: exam.name, detail: ar ? `تمت إضافة الدرجة: ${g.obtainedGrade}/${exam.maxGrade}` : `Grade posted: ${g.obtainedGrade}/${exam.maxGrade}`, ts: g.publishedAt ?? g.lastUpdated });
    }
    for (const a of db.assignments) {
      if (student.groupIds.includes(a.groupId)) {
        items.push({ id: `hw_${a.id}`, kind: "hw", title: a.title, detail: ar ? `واجب جديد مطلوب · ${new Date(a.dueDate).toLocaleDateString()}` : `Homework assigned · ${new Date(a.dueDate).toLocaleDateString()}`, ts: a.dueDate });
      }
    }
    return items.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [db.exams, db.examGrades, db.assignments, student.id, student.groupIds, ar]);

  const notifMeta: Record<string, { icon: typeof Bell; tone: "info" | "success" | "violet" }> = {
    exam: { icon: CalendarClock, tone: "info" },
    grade: { icon: Award, tone: "success" },
    hw: { icon: BookOpen, tone: "violet" },
  };

  // Parent/Student note to center
  const [parentNote, setParentNote] = useState("");
  const sendParentNote = () => {
    if (!parentNote.trim()) return;
    upsert("studentNotes", {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentId: student.id,
      teacherId: isStudent ? "student_note" : "parent_note",
      text: parentNote.trim(),
      date: startOfDay(now()),
      lastUpdated: now(),
    });
    setParentNote("");
    pushToast(isStudent ? (ar ? "تم إرسال ملاحظتك للسنتر بنجاح" : "Your note was sent to the center successfully") : t("parent.noteSent"));
  };

  // List of tabs
  const tabs = [
    { id: "dashboard", label: ar ? "المواد والمجموعات" : "Groups & Subjects", icon: Layers },
    { id: "attendance", label: ar ? "سجل الحضور" : "Attendance Log", icon: ClipboardCheck },
    { id: "exams", label: ar ? "الامتحانات والدرجات" : "Exams & Grades", icon: Award },
    { id: "homework", label: ar ? "الواجبات والمهام" : "Homework", icon: BookOpen },
    { id: "notes", label: ar ? "ملاحظات المعلمين" : "Teacher Notes", icon: StickyNote },
    { id: "finance", label: ar ? "الرسوم والمالية" : "Wallet & Fees", icon: Wallet },
  ];

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* ------------------ Header Banner ------------------ */}
      <Card className="overflow-hidden border border-brand-100 dark:border-brand-500/10 shadow-md">
        <div className="relative flex flex-wrap items-center gap-4 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800 p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <Button variant="secondary" size="icon" onClick={onBack} className="relative border-0 bg-white/15 text-white hover:bg-white/25">
            <ChevronLeft className={cn("h-5 w-5", ar ? "rotate-180" : "")} />
          </Button>
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold backdrop-blur border border-white/10 font-mono">
            {getInitials(student.name)}
          </div>
          <div className="relative min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-tight">{student.name}</h1>
            <p className="mt-1 text-xs text-brand-100 font-mono">
              {ar ? "كود الطالب:" : "Code:"} {student.id} · {gradeLabel(student.grade, lang)}
            </p>
            {teachers.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {teachers.map((tc) => tc && (
                  <span key={tc.id} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-tight backdrop-blur border border-white/5">
                    <GraduationCap className="h-3.5 w-3.5 text-brand-200" />
                    {tc.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" onClick={() => generateStudentPdf(db, student, lang)} className="relative border-0 bg-white/15 text-white hover:bg-white/25 font-bold">
            <FileText className="h-4 w-4" />
            {t("parent.exportReport")}
          </Button>
        </div>
      </Card>

      {/* ------------------ Navigation Tabs ------------------ */}
      <div className="bg-surface p-1.5 rounded-2xl border border-brand-100/60 dark:border-brand-500/10 overflow-hidden shadow-sm">
        <div className="flex overflow-x-auto gap-1.5 scrollbar-none py-0.5 px-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "attendance") setSelectedGroupFilter(undefined);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-300 rounded-xl cursor-pointer select-none",
                  isActive
                    ? "bg-brand-600 text-white shadow-brand font-black scale-[1.01]"
                    : "text-muted hover:text-brand-600 hover:bg-brand-50/60 dark:hover:bg-brand-950/20"
                )}
              >
                <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-white" : "text-muted")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------ Tab Contents ------------------ */}

      {/* Tab 1: Dashboard Overview */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Quick Stats Summary Grid (Horizontal, 3-Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Attendance Card */}
            <Card className="flex items-center justify-between p-4.5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-500/10 hover:border-indigo-500/20 transition-all duration-300">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{ar ? "معدل الحضور العام" : "Overall Attendance"}</p>
                <p className="text-2xl font-black text-ink">{attRate}%</p>
              </div>
              <div className="h-14 w-14 shrink-0 flex items-center justify-center">
                <Donut value={attRate} size={56} stroke={6} color="#6366f1" label="" />
              </div>
            </Card>

            {/* Exam Average Card */}
            <Card className="flex items-center justify-between p-4.5 bg-gradient-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-500/10 hover:border-amber-500/20 transition-all duration-300">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{ar ? "متوسط درجات الامتحانات" : "Exam Average"}</p>
                <p className="text-2xl font-black text-ink">{avg != null ? `${Math.round(avg)}%` : "—"}</p>
              </div>
              <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shrink-0">
                <Award className="h-7 w-7" />
              </div>
            </Card>

            {/* Remaining Fees Card */}
            <Card className="flex items-center justify-between p-4.5 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 border border-emerald-500/10 hover:border-emerald-500/20 transition-all duration-300">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{ar ? "الرسوم المتبقية للدفع" : "Remaining Balance"}</p>
                <p className={cn("text-2xl font-black", due > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {formatMoney(due, sym)}
                </p>
              </div>
              <div className={cn("h-14 w-14 flex items-center justify-center rounded-2xl shrink-0", due > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500")}>
                <Wallet className="h-7 w-7" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Notifications Feed & Send Note */}
            <div className="lg:col-span-5 space-y-6">
              {/* Notifications Feed */}
              <Card className="p-5 flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                      <Bell className="h-4.5 w-4.5" />
                      {notifications.length > 0 && (
                        <span className="absolute -end-0.5 -top-0.5 flex h-3 w-3">
                          <span className="live-dot absolute inline-flex h-3 w-3 rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                        </span>
                      )}
                    </span>
                    <div>
                      <h3 className="text-[14px] font-bold text-ink">{ar ? "آخر الإشعارات والتحديثات" : "Latest Notifications"}</h3>
                      <p className="text-[10px] text-muted">{ar ? "الامتحانات والواجبات المضافة حديثاً" : "Recently added exams, grades, or homework"}</p>
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted font-medium">{t("parent.noNotifications")}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {notifications.map((n) => {
                        const meta = notifMeta[n.kind];
                        const Icon = meta.icon;
                        return (
                          <div key={n.id} className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface p-3 shadow-sm hover:border-line transition-all">
                            <Badge tone={meta.tone} className="p-1.5 rounded-lg"><Icon className="h-3.5 w-3.5" /></Badge>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-ink">{n.title}</p>
                              <p className="text-[11px] text-muted mt-0.5">{n.detail}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>

              {/* Quick Note Box */}
              <Card className="p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-brand-600" />
                  {ar ? "إرسال رسالة سريعة للسنتر" : "Send Quick Note to Center"}
                </h3>
                <p className="text-[11px] text-faint mb-3 leading-relaxed">
                  {ar 
                    ? "هل لديك ملاحظة أو استفسار؟ اكتبه هنا مباشرة وسيتلقى مسؤولو السنتر إشعاراً فورياً."
                    : "Have any quick feedback? Send it here and administrators will be notified immediately."}
                </p>
                <div className="space-y-3">
                  <Textarea
                    rows={3}
                    value={parentNote}
                    onChange={(e) => setParentNote(e.target.value)}
                    placeholder={t("parent.sendNotePlaceholder")}
                    className="text-xs resize-none"
                  />
                  <Button size="sm" className="w-full" onClick={sendParentNote} disabled={!parentNote.trim()}>
                    <Send className="h-3.5 w-3.5" />
                    {t("parent.sendNote")}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Right Column: Detailed Enrolled Subjects */}
            <div className="lg:col-span-7 space-y-4">
              <div className="border-b border-line pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {ar ? "المواد والمجموعات المشترك بها بالتفصيل" : "Enrolled Subjects & Groups Details"}
                  </h3>
                  <p className="text-xs text-muted">
                    {ar ? "متابعة الحضور، الامتحانات والواجبات لكل مادة" : "Track attendance, exams, and homework separately"}
                  </p>
                </div>
              </div>

              {studentGroups.length === 0 ? (
                <Card className="p-8 text-center text-xs text-muted font-medium">
                  {ar ? "الطالب غير مسجل في أي مجموعة بعد" : "Student is not registered in any groups yet"}
                </Card>
              ) : (
                <div className="space-y-4">
                  {studentGroups.map((g) => {
                    if (!g) return null;
                    const tc = db.teachers.find((x) => x.id === g.teacherId);
                    
                    // Group Specific Attendance
                    const gRecords = db.attendance.filter((r) => r.studentId === student.id && r.groupId === g.id);
                    const gExpected = gRecords.length;
                    const gPresent = gRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
                    const gAbsent = gRecords.filter((r) => r.status === "ABSENT").length;
                    const gExcused = gRecords.filter((r) => r.status === "EXCUSED").length;
                    const gRate = gExpected > 0 ? Math.round((gPresent / gExpected) * 100) : 100;

                    // Group Specific Exams
                    const gExams = db.exams.filter((e) => e.groupId === g.id).sort((a, b) => b.date - a.date);
                    const gGrades = gExams.map((exam) => {
                      const eg = db.examGrades.find((eg) => eg.studentId === student.id && eg.examId === exam.id);
                      return { eg, exam };
                    }).slice(0, 3); // Show recent 3 exams

                    // Group Specific Homeworks
                    const gHws = db.assignments
                      .filter((a) => a.groupId === g.id)
                      .sort((a, b) => b.dueDate - a.dueDate)
                      .slice(0, 2); // Show recent 2 homeworks

                    const isCourse = g.subject.startsWith("Course:") || g.subject.startsWith("كورس:");
                    

                    return (
                      <Card key={g.id} className="overflow-hidden border border-line/70 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 flex flex-col bg-surface">
                        {/* Top soft gradient header */}
                        <div className="bg-gradient-to-br from-brand-500/[0.04] via-indigo-500/[0.02] to-surface dark:from-brand-950/10 dark:via-indigo-950/5 dark:to-surface p-6 border-b border-line/40">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h4 className="text-lg font-extrabold text-ink tracking-tight">{subjectLabel(g.subject, lang)}</h4>
                                {isCourse && (
                                  <Badge tone="violet" className="text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider rounded-md">
                                    {ar ? "كورس مخصص" : "Course"}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/[0.08] dark:bg-brand-500/[0.15] px-3 py-1 rounded-full border border-brand-500/10">
                                  {g.name}
                                </span>
                                
                                {tc && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted bg-muted/30 dark:bg-muted/10 px-3 py-1 rounded-full border border-line/40 font-medium">
                                    <div className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center font-black text-[9px] shrink-0">
                                      {tc.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{ar ? `الأستاذ: ${tc.name}` : `Teacher: ${tc.name}`}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs shadow-sm font-mono border",
                                gRate >= 85 ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" :
                                gRate >= 60 ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" :
                                "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                              )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full inline-block animate-pulse",
                                  gRate >= 85 ? "bg-emerald-500" : gRate >= 60 ? "bg-amber-500" : "bg-rose-500"
                                )} />
                                {gRate}% {ar ? "حضور" : "Att"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                          {/* 1. Attendance Metrics and Progress */}
                          <div className="space-y-3.5">
                            <div className="flex justify-between items-center text-[12px] font-bold text-ink">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-brand-500/80 inline-block shadow-sm" />
                                {ar ? "حصص المادة المسجلة:" : "Registered sessions:"}
                              </span>
                              <span className="font-extrabold text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/20 px-3 py-1 rounded-full font-mono text-xs border border-brand-500/10">
                                {ar ? `${gPresent} من ${gExpected} حصص` : `${gPresent} / ${gExpected} sessions`}
                              </span>
                            </div>

                            {/* Elegant Segmented Progress Bar */}
                            <div className="flex h-3 overflow-hidden rounded-full bg-muted/40 dark:bg-muted/10 border border-line/20 p-0.5 gap-1">
                              {gExpected > 0 ? (
                                <>
                                  {gPresent > 0 && (
                                    <div 
                                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500 shadow-[0_1px_4px_rgba(16,185,129,0.2)]" 
                                      style={{ width: `${(gPresent / gExpected) * 100}%` }} 
                                      title={`Present: ${gPresent}`} 
                                    />
                                  )}
                                  {gAbsent > 0 && (
                                    <div 
                                      className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-500 shadow-[0_1px_4px_rgba(244,63,94,0.2)]" 
                                      style={{ width: `${(gAbsent / gExpected) * 100}%` }} 
                                      title={`Absent: ${gAbsent}`} 
                                    />
                                  )}
                                  {gExcused > 0 && (
                                    <div 
                                      className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-500 shadow-[0_1px_4px_rgba(14,165,233,0.2)]" 
                                      style={{ width: `${(gExcused / gExpected) * 100}%` }} 
                                      title={`Excused: ${gExcused}`} 
                                    />
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full bg-muted/40 rounded-full" />
                              )}
                            </div>

                            {/* Beautiful Bento Metric Cards */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div className="bg-emerald-500/[0.03] dark:bg-emerald-500/[0.08] border border-emerald-500/10 hover:border-emerald-500/20 transition-all rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold mb-1">
                                  {ar ? "حاضر" : "Present"}
                                </span>
                                <span className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">
                                  {gPresent}
                                </span>
                              </div>

                              <div className="bg-rose-500/[0.03] dark:bg-rose-500/[0.08] border border-rose-500/10 hover:border-rose-500/20 transition-all rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-extrabold mb-1">
                                  {ar ? "غياب" : "Absent"}
                                </span>
                                <span className="text-base font-black text-rose-700 dark:text-rose-300 font-mono">
                                  {gAbsent}
                                </span>
                              </div>

                              <div className="bg-sky-500/[0.03] dark:bg-sky-500/[0.08] border border-sky-500/10 hover:border-sky-500/20 transition-all rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-extrabold mb-1">
                                  {ar ? "مقبول" : "Excused"}
                                </span>
                                <span className="text-base font-black text-sky-700 dark:text-sky-300 font-mono">
                                  {gExcused}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 2. Exams Specifics */}
                          <div className="space-y-3.5 border-t border-line/40 pt-4.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-black text-ink">
                                <Award className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                                <span>{ar ? "أحدث نتائج الامتحانات" : "Recent Exam Grades"}</span>
                              </div>
                            </div>
                            
                            {gGrades.length === 0 ? (
                              <p className="text-[11px] text-faint py-3 px-4 bg-muted/20 dark:bg-muted/5 border border-dashed border-line/60 italic text-center rounded-2xl">
                                {ar ? "لا توجد امتحانات مسجلة لهذه المجموعة" : "No registered exams for this group yet"}
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 gap-2.5">
                                {gGrades.map(({ eg, exam }) => {
                                  if (!exam) return null;
                                  const isPublished = eg && eg.published;
                                  const isUpcoming = exam.date > Date.now();
                                  const pct = exam.maxGrade > 0 && eg ? (eg.obtainedGrade / exam.maxGrade) * 100 : 0;
                                  const isPassed = !isPublished || pct >= 50;
                                  return (
                                    <div 
                                      key={exam.id} 
                                      className={cn(
                                        "flex items-center justify-between text-xs p-3.5 rounded-2xl border transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]",
                                        !isPublished 
                                          ? (isUpcoming ? "bg-blue-500/[0.01] border-line/60 border-s-4 border-s-blue-500 dark:border-s-blue-600 dark:bg-blue-500/[0.02]" : "bg-amber-500/[0.01] border-line/60 border-s-4 border-s-amber-500 dark:border-s-amber-600 dark:bg-amber-500/[0.02]")
                                          : isPassed 
                                            ? "bg-emerald-500/[0.01] border-line/60 border-s-4 border-s-emerald-500 dark:border-s-emerald-600 dark:bg-emerald-500/[0.02]" 
                                            : "bg-rose-500/[0.01] border-line/60 border-s-4 border-s-rose-500 dark:border-s-rose-600 dark:bg-rose-500/[0.02]"
                                      )}
                                    >
                                      <div className="min-w-0 flex-1 me-3">
                                        <p className="truncate text-ink font-bold" title={exam.name}>{exam.name}</p>
                                        <p className="text-[10px] text-muted font-semibold mt-0.5">
                                          {isPublished 
                                            ? (ar ? `النسبة المئوية: ${Math.round(pct)}%` : `Percentage: ${Math.round(pct)}%`)
                                            : isUpcoming 
                                              ? (ar ? `امتحان قادم: ${new Date(exam.date).toLocaleDateString()}` : `Upcoming: ${new Date(exam.date).toLocaleDateString()}`)
                                              : (ar ? `تم أداء الامتحان في ${new Date(exam.date).toLocaleDateString()}` : `Taken on ${new Date(exam.date).toLocaleDateString()}`)}
                                        </p>
                                      </div>
                                      <div className="shrink-0 flex items-center gap-1.5">
                                        <div className={cn(
                                          "text-xs font-extrabold px-3 py-1 rounded-full border shadow-sm font-mono",
                                          !isPublished
                                            ? isUpcoming
                                              ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                                              : "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                                            : isPassed
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                              : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                                        )}>
                                          {isPublished 
                                            ? `${eg.obtainedGrade} / ${exam.maxGrade}` 
                                            : isUpcoming 
                                              ? (ar ? "مجدول" : "Upcoming") 
                                              : (ar ? "لم تُرصد" : "Pending")}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 3. Homeworks Specifics */}
                          <div className="space-y-3.5 border-t border-line/40 pt-4.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-black text-ink">
                                <BookOpen className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                                <span>{ar ? "الواجبات والمهام المطلوبة" : "Assigned Homework"}</span>
                              </div>
                            </div>

                            {gHws.length === 0 ? (
                              <p className="text-[11px] text-faint py-3 px-4 bg-muted/20 dark:bg-muted/5 border border-dashed border-line/60 italic text-center rounded-2xl">
                                {ar ? "لا توجد واجبات مطلوبة حالياً" : "No active homework assignments"}
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 gap-2.5">
                                {gHws.map((a) => {
                                  const isOverdue = a.dueDate < startOfDay(now());
                                  return (
                                    <div 
                                      key={a.id} 
                                      className={cn(
                                        "flex items-center justify-between text-xs p-3.5 rounded-2xl border transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] bg-brand-500/[0.01] border-line/60 border-s-4",
                                        isOverdue 
                                          ? "border-s-neutral-400 dark:border-s-neutral-500" 
                                          : "border-s-brand-500 dark:border-s-brand-600"
                                      )}
                                    >
                                      <div className="min-w-0 flex-1 me-3">
                                        <p className="truncate text-ink font-bold leading-tight" title={a.title}>{a.title}</p>
                                        <p className="text-[10px] text-muted font-bold mt-1.5 flex items-center gap-1">
                                          <CalendarClock className="h-3.5 w-3.5 text-muted shrink-0" />
                                          <span>{ar ? "تاريخ التسليم:" : "Due:"} <span className="font-mono">{new Date(a.dueDate).toLocaleDateString()}</span></span>
                                        </p>
                                      </div>
                                      
                                      <div className="shrink-0">
                                        {isOverdue ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/80 text-muted font-bold text-[10px] uppercase tracking-wider border border-line/50">
                                            {ar ? "منتهٍ" : "Overdue"}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 font-black text-[10px] uppercase tracking-wider border border-brand-500/15">
                                            <span className="flex h-1.5 w-1.5 relative shrink-0">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                                            </span>
                                            {ar ? "نشط" : "Active"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Detailed Attendance Calendar */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-100 dark:border-brand-500/10 bg-gradient-to-r from-brand-500/5 to-indigo-500/5 dark:from-brand-500/10 dark:to-indigo-500/10 p-4.5 shadow-sm">
            <h3 className="text-sm font-bold text-ink mb-1">
              {ar ? "سجل الحضور والغياب التفصيلي" : "Detailed Attendance Calendar"}
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              {ar
                ? "يمكنك تصفح حضور الطالب في كافة المجموعات أو اختيار مادة معينة لعرض جدولها بالكامل على مدار الشهر."
                : "Browse the student's calendar across all groups or filter by a specific subject."}
            </p>
          </div>
          <MonthlyAttendance
            studentId={student.id}
            selectedGroupId={selectedGroupFilter}
            onSelectGroup={setSelectedGroupFilter}
          />
        </div>
      )}

      {/* Tab 3: Detailed Exam Grades */}
      {activeTab === "exams" && (
        <Card className="p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <h3 className="text-sm font-bold text-ink">{ar ? "كشف درجات الطالب الكامل" : "Detailed Exam Grades Transcript"}</h3>
            <p className="text-xs text-muted mt-0.5">{ar ? "سجل جميع الدرجات والامتحانات الموثقة" : "Academic report card for all graded examinations"}</p>
          </div>

          {grades.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted font-medium">{t("exams.empty")}</p>
          ) : (
            <>
              {/* Responsive Cards on Mobile */}
              <div className="space-y-3 sm:hidden">
                {grades.map(({ g, exam }) => {
                  if (!exam) return null;
                  const group = db.groups.find((grp) => grp.id === exam.groupId);
                  const isPublished = g && g.published;
                  const isUpcoming = exam.date > Date.now();
                  const pct = exam.maxGrade > 0 && g ? (g.obtainedGrade / exam.maxGrade) * 100 : 0;
                  
                  let rating = ar ? "مقبول" : "Pass";
                  let tone: "success" | "warning" | "danger" | "brand" | "info" | "neutral" = "brand";
                  if (isPublished) {
                    if (pct >= 90) { rating = ar ? "ممتاز" : "Excellent"; tone = "success"; }
                    else if (pct >= 75) { rating = ar ? "جيد جداً" : "Very Good"; tone = "brand"; }
                    else if (pct >= 50) { rating = ar ? "مقبول" : "Pass"; tone = "warning"; }
                    else { rating = ar ? "ضعيف" : "Fail"; tone = "danger"; }
                  } else {
                    rating = isUpcoming ? (ar ? "امتحان قادم" : "Upcoming") : (ar ? "لم تُرصد الدرجة" : "Not Graded");
                    tone = isUpcoming ? "info" : "neutral";
                  }

                  return (
                    <div key={exam.id} className="border border-amber-200/50 bg-amber-50/10 dark:bg-amber-500/5 p-4 rounded-xl space-y-3 shadow-sm hover:border-amber-300 transition-all duration-200">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-ink text-xs leading-tight">{exam.name}</p>
                          <p className="text-[10px] text-faint mt-1">{new Date(exam.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-end shrink-0">
                          <span className="text-xs font-black text-ink block">
                            {isPublished 
                              ? (ar ? `${g.obtainedGrade} من ${exam.maxGrade}` : `${g.obtainedGrade} / ${exam.maxGrade}`)
                              : (isUpcoming ? (ar ? "مجدول" : "Scheduled") : (ar ? "قيد التصحيح" : "Under Grading"))}
                          </span>
                          <Badge tone={tone} className="text-[9px] py-0.5 px-2 font-bold mt-1.5">{rating}</Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted border-t border-line/40 pt-2.5">
                        <span>{ar ? "المادة/المجموعة:" : "Subject/Group:"}</span>
                        <span className="font-bold text-ink text-start truncate max-w-[200px]">
                          {group ? subjectLabel(group.subject, lang) : "—"} ({group?.name})
                        </span>
                      </div>
                      {isPublished && g?.notes && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 italic bg-amber-500/5 border border-amber-100/25 p-2 rounded-lg leading-relaxed select-text">
                          💬 {g.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Standard Table on Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase text-faint">
                      <th className="px-4 py-2.5 text-start font-bold">{ar ? "الامتحان والتاريخ" : "Exam & Date"}</th>
                      <th className="px-4 py-2.5 text-start font-bold">{ar ? "المجموعة/المادة" : "Group/Subject"}</th>
                      <th className="px-4 py-2.5 text-center font-bold">{ar ? "الدرجة المستحقة" : "Score"}</th>
                      <th className="px-4 py-2.5 text-center font-bold">{ar ? "النسبة والتقدير" : "Percentage"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map(({ g, exam }) => {
                      if (!exam) return null;
                      const group = db.groups.find((grp) => grp.id === exam.groupId);
                      const isPublished = g && g.published;
                      const isUpcoming = exam.date > Date.now();
                      const pct = exam.maxGrade > 0 && g ? (g.obtainedGrade / exam.maxGrade) * 100 : 0;
                      
                      let rating = ar ? "مقبول" : "Pass";
                      let tone: "success" | "warning" | "danger" | "brand" | "info" | "neutral" = "brand";
                      if (isPublished) {
                        if (pct >= 90) { rating = ar ? "ممتاز" : "Excellent"; tone = "success"; }
                        else if (pct >= 75) { rating = ar ? "جيد جداً" : "Very Good"; tone = "brand"; }
                        else if (pct >= 50) { rating = ar ? "مقبول" : "Pass"; tone = "warning"; }
                        else { rating = ar ? "ضعيف" : "Fail"; tone = "danger"; }
                      } else {
                        rating = isUpcoming ? (ar ? "امتحان قادم" : "Upcoming") : (ar ? "لم تُرصد الدرجة" : "Not Graded");
                        tone = isUpcoming ? "info" : "neutral";
                      }

                      return (
                        <tr key={exam.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-ink text-xs">{exam.name}</p>
                            <p className="text-[10px] text-faint mt-0.5">{new Date(exam.date).toLocaleDateString()}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {group ? subjectLabel(group.subject, lang) : "—"}
                            <span className="block text-[10px] text-faint">{group?.name}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-ink">
                            {isPublished 
                              ? (ar ? `${g.obtainedGrade} من ${exam.maxGrade}` : `${g.obtainedGrade} / ${exam.maxGrade}`)
                              : (isUpcoming ? (ar ? "امتحان قادم" : "Upcoming Exam") : (ar ? "لم ترصد بعد" : "Grade pending"))}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              {isPublished ? (
                                <>
                                  <span className="text-xs font-black text-ink">{Math.round(pct)}%</span>
                                  <Badge tone={tone} className="text-[9px] py-0 px-1.5 font-bold">{rating}</Badge>
                                </>
                              ) : (
                                <Badge tone={tone} className="text-[9px] py-0 px-1.5 font-bold">{rating}</Badge>
                              )}
                            </div>
                            {isPublished && g?.notes && (
                              <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 italic max-w-xs truncate mx-auto" title={g.notes}>
                                💬 {g.notes}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Tab 4: Detailed Homework List */}
      {activeTab === "homework" && (
        <Card className="p-5 space-y-4">
          <div className="border-b border-line pb-3">
            <h3 className="text-sm font-bold text-ink">{ar ? "جدول الواجبات والمهام المطلوبة" : "Assignments & Homework Directory"}</h3>
            <p className="text-xs text-muted mt-0.5">{ar ? "تتبع كافة واجبات الطالب ومواعيد تسليمها" : "Directory of homework and their deadlines"}</p>
          </div>

          {homework.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted font-medium">{t("exams.empty")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {homework.map((a) => {
                const group = db.groups.find((g) => g.id === a.groupId);
                const isOverdue = a.dueDate < startOfDay(now());
                const daysDiff = Math.ceil((a.dueDate - startOfDay(now())) / 86400000);

                return (
                  <Card key={a.id} className="p-4.5 border border-line/60 bg-surface hover:border-brand-300 hover:shadow-md transition-all duration-200 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-brand-600">
                          {group ? subjectLabel(group.subject, lang) : "—"}
                        </p>
                        <h4 className="text-sm font-bold text-ink truncate mt-0.5">{a.title}</h4>
                      </div>
                      <Badge tone={isOverdue ? "neutral" : "violet"} className="text-[9px] font-extrabold shrink-0">
                        {isOverdue ? (ar ? "منتهٍ" : "Overdue") : (ar ? "نشط" : "Active")}
                      </Badge>
                    </div>

                    {a.description && (
                      <p className="text-xs text-muted leading-relaxed line-clamp-2">
                        {a.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-line/40 pt-2 text-[10px] text-faint">
                      <span>{ar ? "تاريخ الاستحقاق:" : "Due Date:"} {new Date(a.dueDate).toLocaleDateString()}</span>
                      {!isOverdue && daysDiff >= 0 && (
                        <span className="font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">
                          {daysDiff === 0 ? (ar ? "اليوم" : "Today") : daysDiff === 1 ? (ar ? "غداً" : "Tomorrow") : ar ? `متبقي ${daysDiff} أيام` : `${daysDiff} days left`}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Tab 5: Premium Sticky Notes */}
      {activeTab === "notes" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            
            {/* Create / Send Note Section */}
            <Card className="p-5 lg:col-span-4 self-start">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-brand-600" />
                {ar ? "إرسال رسالة للسنتر" : "Send Note to Center"}
              </h3>
              <p className="text-[11px] text-faint mb-3 leading-relaxed">
                {ar 
                  ? "يمكنك كتابة استفسار أو ملاحظة وسيقوم مسؤولو السنتر والمعلمون بمراجعتها والرد عليك."
                  : "Type any inquiry, feedback, or notes for the center admin or teachers to review."}
              </p>
              <div className="space-y-3">
                <Textarea
                  rows={4}
                  value={parentNote}
                  onChange={(e) => setParentNote(e.target.value)}
                  placeholder={t("parent.sendNotePlaceholder")}
                  className="text-xs resize-none"
                />
                <Button size="sm" className="w-full" onClick={sendParentNote} disabled={!parentNote.trim()}>
                  <Send className="h-3.5 w-3.5" />
                  {t("parent.sendNote")}
                </Button>
              </div>
            </Card>

            {/* Sticky Notes Display */}
            <div className="lg:col-span-8 space-y-3">
              <h3 className="text-sm font-bold text-ink border-b border-line pb-2 flex items-center gap-1.5">
                <StickyNote className="h-4 w-4 text-sky-500" />
                {ar ? "الملاحظات اللاصقة والتقارير اليومية" : "Interactive Sticky Notes Log"}
              </h3>

              {notes.length === 0 ? (
                <Card className="p-10 text-center text-xs text-faint font-medium bg-surface">
                  {t("parent.noNotes")}
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {notes.map((n, idx) => {
                    // Physical Sticky Note Stylings (Rotate & Colors)
                    const bgColors = [
                      "bg-[#fef9c3] dark:bg-[#eab308]/10 border-[#fef08a] dark:border-[#eab308]/20 text-yellow-900 dark:text-yellow-100 shadow-yellow-100/40",
                      "bg-[#e0f2fe] dark:bg-[#0284c7]/10 border-[#bae6fd] dark:border-[#0284c7]/20 text-sky-900 dark:text-sky-100 shadow-sky-100/40",
                      "bg-[#f3e8ff] dark:bg-[#a855f7]/10 border-[#e9d5ff] dark:border-[#a855f7]/20 text-purple-900 dark:text-purple-100 shadow-purple-100/40",
                      "bg-[#ffe4e6] dark:bg-[#f43f5e]/10 border-[#fecdd3] dark:border-[#f43f5e]/20 text-rose-900 dark:text-rose-100 shadow-rose-100/40",
                      "bg-[#dcfce7] dark:bg-[#22c55e]/10 border-[#bbf7d0] dark:border-[#22c55e]/20 text-emerald-900 dark:text-emerald-100 shadow-emerald-100/40",
                    ];
                    const rotationClasses = ["rotate-0", "rotate-1", "-rotate-1", "rotate-[1.5deg]", "-rotate-[1.5deg]"];
                    const noteBg = bgColors[idx % bgColors.length];
                    const noteRotation = rotationClasses[idx % rotationClasses.length];

                    const isParent = n.teacherId === "parent_note";
                    const isStudentNote = n.teacherId === "student_note";
                    const isUserOriginated = isParent || isStudentNote;
                    let senderName = ar ? "إدارة السنتر" : "Center Admin";
                    if (!isUserOriginated && n.teacherId) {
                      const teacher = db.teachers.find((t) => t.id === n.teacherId);
                      if (teacher) senderName = teacher.name;
                    }

                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "relative rounded-xl p-5 border shadow-md transition-all hover:scale-[1.03] hover:rotate-0 hover:shadow-lg",
                          noteBg,
                          noteRotation
                        )}
                      >
                        {/* 📌 Pin Icon */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2">
                          <Pin className="h-4.5 w-4.5 text-rose-500 transform -rotate-45" fill="currentColor" />
                        </div>

                        {/* Author Label */}
                        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2 mb-2 text-[10px] font-bold opacity-80 mt-1">
                          <span>
                            {isUserOriginated 
                              ? (isStudentNote ? (ar ? "📝 الطالب" : "📝 Student") : (ar ? "📝 ولي الأمر" : "📝 Parent")) 
                              : `👤 ${senderName}`}
                          </span>
                          <span>{new Date(n.date).toLocaleDateString()}</span>
                        </div>

                        {/* Note Text */}
                        <p className="text-xs leading-relaxed font-medium whitespace-pre-line select-text" style={{ fontFamily: "inherit" }}>
                          {n.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Tab 6: Financial Log & Wallet */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            
            {/* Wallet Overview Card */}
            <Card className="p-5 lg:col-span-5 self-start space-y-4">
              <div className="border-b border-line pb-2 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-ink">{ar ? "المحفظة والرسوم الدراسية" : "Student Wallet Balance"}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{ar ? "إجمالي المدفوعات" : "Total Paid"}</p>
                  <p className="text-lg font-black text-emerald-600 mt-1">{formatMoney(paid, sym)}</p>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{ar ? "الرصيد المتبقي" : "Outstanding Balance"}</p>
                  <p className="text-lg font-black text-rose-600 mt-1">{formatMoney(due, sym)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-4.5 space-y-3.5 text-xs shadow-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{ar ? "حالة الحساب الدراسي:" : "Account Status:"}</span>
                  <Badge tone={due > 0 ? "danger" : "success"} className="text-[9px] font-bold px-2 py-0.5">
                    {due > 0 ? (ar ? "مستحق الدفع" : "Payment Due") : (ar ? "مدفوع بالكامل" : "Fully Settled")}
                  </Badge>
                </div>
                {student.isExempt && (
                  <div className="flex justify-between border-t border-line/40 pt-2 text-[11px] text-faint">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{ar ? "وضع المصروفات:" : "Fee Exemption Status:"}</span>
                    <Badge tone="warning" className="text-[9px] font-bold px-2 py-0.5">
                      {ar ? "معفى من المصروفات" : "Exempt from fees"}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between border-t border-line/40 pt-2 text-[11px] text-faint">
                  <span>{ar ? "نوع الاشتراك:" : "Registration Type:"}</span>
                  <span className="font-bold text-ink">
                    {student.enrollmentType === "private" ? (ar ? "خاص" : "Private") : (ar ? "مجموعة" : "Group")}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-faint">
                  <span>{ar ? "طريقة التحصيل:" : "Payment Term:"}</span>
                  <span className="font-bold text-ink">
                    {student.paymentType === "advance" ? (ar ? "مقدم" : "Advance") : (ar ? "مؤخر" : "Deferred")}
                  </span>
                </div>
              </div>
            </Card>

            {/* Receipts / Transactions Timeline */}
            <Card className="p-5 lg:col-span-7">
              <div className="border-b border-line pb-2 mb-4 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-ink">{ar ? "سجل إيصالات الدفع والمعاملات" : "Transaction & Receipt History"}</h3>
              </div>

              {db.payments.filter((p) => p.studentId === student.id).length === 0 ? (
                <p className="py-10 text-center text-xs text-muted font-medium">{ar ? "لا توجد أي مدفوعات مسجلة بعد" : "No payment transactions logged yet"}</p>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pe-1">
                  {db.payments
                    .filter((p) => p.studentId === student.id)
                    .sort((a, b) => b.date - a.date)
                    .map((p) => {
                      let typeLabel: string = p.type;
                      if (p.type === "MONTHLY_FEE") typeLabel = ar ? "مصروفات شهرية" : "Monthly Fee";
                      else if (p.type === "EXAM_FEE") typeLabel = ar ? "رسوم امتحانات" : "Exam Fee";
                      else if (p.type === "BOOKS") typeLabel = ar ? "رسوم مذكرات وكتب" : "Books/Prints";
                      else if (p.type === "CENTER_SUBSCRIPTION") typeLabel = ar ? "اشتراك السنتر العام" : "Center Subscription";
                      else if (p.type === "OTHER") typeLabel = ar ? "رسوم أخرى" : "Other Fees";

                      const tc = db.teachers.find((t) => t.id === p.teacherId);

                      return (
                        <div key={p.id} className="flex items-center justify-between border border-line/60 bg-surface p-3.5 rounded-xl hover:border-emerald-200 dark:hover:border-emerald-500/20 hover:shadow-sm transition-all text-xs">
                          <div className="space-y-1 min-w-0 flex-1 me-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-ink">{typeLabel}</span>
                              <span className="text-[10px] font-mono text-faint">#{p.id.slice(-6).toUpperCase()}</span>
                            </div>
                            <div className="text-[10px] text-muted flex items-center gap-1.5 flex-wrap">
                              <span>{new Date(p.date).toLocaleDateString()}</span>
                              {p.month && <span>· {p.month}</span>}
                              {tc && <span className="bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold rounded px-2 py-0.5 text-[10px]">{ar ? `المعلم: ${tc.name}` : `Teacher: ${tc.name}`}</span>}
                            </div>
                            {p.notes && (
                              <p className="text-[10px] text-faint italic max-w-sm truncate mt-0.5">
                                * {p.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="text-end shrink-0">
                            <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                              + {formatMoney(p.amount, sym)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>

          </div>
        </div>
      )}

    </div>
  );
}


