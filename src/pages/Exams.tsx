import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, FileText, Award, BookOpen, CalendarClock, Send, Bell, MessageCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader,
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Field,
  Badge,
  Modal,
  Tabs,
  EmptyState,
  pushToast,
} from "../components/ui";
import type { Exam, ExamGrade, Assignment } from "../lib/types";
import { GRADES } from "../lib/constants";
import { now, startOfDay } from "../lib/db";
import { examAverage } from "../lib/analytics";
import { usePersistentView } from "../components/PersistentViewToggle";
import { ViewToggle } from "../components/ViewToggle";
import { cn } from "../utils/cn";
import { FeatureLockOverlay } from "../components/FeatureLockOverlay";
import { getWhatsAppHomeworkShareUrl } from "../lib/whatsapp";

export function Exams() {
  const { t, subscriptionPlan } = useApp();
  const [tab, setTab] = useState("exams");
  const isHomeworkLocked = subscriptionPlan === "free";
  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("exams.title")} subtitle={t("exams.subtitle")} />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "exams", label: t("exams.tab.exams"), icon: <FileText className="h-4 w-4" /> },
          { id: "grades", label: t("exams.tab.grades"), icon: <Award className="h-4 w-4" /> },
          { id: "homework", label: t("exams.tab.homework"), icon: <BookOpen className="h-4 w-4" /> },
        ]}
      />
      {tab === "exams" && <ExamsTab />}
      {tab === "grades" && <GradesTab />}
      {tab === "homework" && (
        <div className="relative min-h-[350px]">
          <div className={cn(isHomeworkLocked ? "pointer-events-none blur-sm select-none" : "")}>
            <HomeworkTab />
          </div>
          {isHomeworkLocked && (
            <FeatureLockOverlay
              title="نظام الواجبات مغلق"
              description="أنشئ واجبات وتتبع تسليمات الطلاب وأرسل إشعارات تذكير بالمواعيد. متاحة في الخطة الاحترافية أو المؤسسية."
              requiredPlan="pro"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ExamsTab() {
  const { db, t, lang, upsert, remove, can } = useApp();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const { view, change: setView } = usePersistentView("exams", "grid");
  const [form, setForm] = useState<Exam>({ id: "", groupId: db.groups[0]?.id ?? "", name: "", maxGrade: 50, date: startOfDay(now()), lastUpdated: now() });

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");

  const filteredGroups = useMemo(() => {
    return db.groups.filter((g) => {
      const matchTeacher = !selectedTeacherId || g.teacherId === selectedTeacherId;
      const matchGrade = !selectedGradeId || g.grade === selectedGradeId;
      return matchTeacher && matchGrade;
    });
  }, [db.groups, selectedTeacherId, selectedGradeId]);

  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const matched = db.groups.filter(g => 
      (!teacherId || g.teacherId === teacherId) && (!selectedGradeId || g.grade === selectedGradeId)
    );
    if (matched.length > 0) {
      setForm(f => ({ ...f, groupId: matched[0].id }));
    } else {
      setForm(f => ({ ...f, groupId: "" }));
    }
  };

  const handleGradeChange = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    const matched = db.groups.filter(g => 
      (!selectedTeacherId || g.teacherId === selectedTeacherId) && (!gradeId || g.grade === gradeId)
    );
    if (matched.length > 0) {
      setForm(f => ({ ...f, groupId: matched[0].id }));
    } else {
      setForm(f => ({ ...f, groupId: "" }));
    }
  };

  const openCreate = () => { 
    const firstGroup = db.groups[0];
    setForm({ id: "", groupId: firstGroup?.id ?? "", name: "", maxGrade: 50, date: startOfDay(now()), lastUpdated: now() }); 
    setSelectedTeacherId(firstGroup?.teacherId ?? "");
    setSelectedGradeId(firstGroup?.grade ?? "");
    setEditing(null); 
    setOpen(true); 
  };

  const openEdit = (e: Exam) => { 
    setForm({ ...e }); 
    const g = db.groups.find((x) => x.id === e.groupId);
    setSelectedTeacherId(g?.teacherId ?? "");
    setSelectedGradeId(g?.grade ?? "");
    setEditing(e); 
    setOpen(true); 
  };

  const save = () => {
    if (!form.name.trim() || !form.groupId) return;
    upsert("exams", form);
    if (!editing) pushToast(t("exams.notifyExam"));
    setOpen(false);
  };
  const set = <K extends keyof Exam>(k: K, v: Exam[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {can("exams.manage") && <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("exams.newExam")}</Button>}
        {db.exams.length > 0 && <ViewToggle value={view} onChange={setView} />}
      </div>
      {db.exams.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<FileText className="h-6 w-6" />} title={t("exams.empty")} /></Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                <th className="px-4 py-2.5 text-start font-semibold">{t("exams.name")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("classes.groups")}</th>
                <th className="px-4 py-2.5 text-center font-semibold">{t("exams.maxGrade")}</th>
                <th className="px-4 py-2.5 text-center font-semibold">{t("exams.avg")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("att.date")}</th>
              </tr></thead>
              <tbody>
                {db.exams.map((e) => {
                  const group = db.groups.find((g) => g.id === e.groupId);
                  const avg = examAverage(db, e);
                  return (
                    <tr key={e.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                      <td className="px-4 py-2.5 font-medium text-ink">{e.name}</td>
                      <td className="px-4 py-2.5 text-muted">{group?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-ink">{e.maxGrade}</td>
                      <td className="px-4 py-2.5 text-center"><Badge tone="brand">{avg != null ? `${Math.round(avg)}%` : "—"}</Badge></td>
                      <td className="px-4 py-2.5 text-muted">{new Date(e.date).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : view === "compact" ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line/60">
            {db.exams.map((e) => {
              const group = db.groups.find((g) => g.id === e.groupId);
              const avg = examAverage(db, e);
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/40">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15"><FileText className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{e.name}</p>
                    <p className="truncate text-[10px] text-faint">{group?.name ?? "—"} · {new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <span className="hidden text-xs text-muted sm:inline">/ {e.maxGrade}</span>
                  <Badge tone="brand">{avg != null ? `${Math.round(avg)}%` : "—"}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {db.exams.map((e) => {
            const group = db.groups.find((g) => g.id === e.groupId);
            const avg = examAverage(db, e);
            return (
              <Card key={e.id} className="card-hover p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{e.name}</p>
                    <p className="text-[11px] text-muted">{group?.name ?? "—"}</p>
                  </div>
                  {can("exams.manage") && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove("exams", e.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-brand-600">{avg != null ? `${Math.round(avg)}%` : "—"}</p>
                    <p className="text-[10px] text-faint">{t("exams.avg")}</p>
                  </div>
                  <Badge tone="neutral">/ {e.maxGrade}</Badge>
                  <p className="text-[11px] text-faint">{new Date(e.date).toLocaleDateString()}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("action.edit") : t("exams.newExam")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button onClick={save}>{t("action.save")}</Button></>}>
        <div className="space-y-3">
          <Field label={t("exams.name")}><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Midterm Exam" /></Field>
          
          <Field label={ar ? "المعلم المسؤول (تحديد المدرس)" : "Teacher (Select Teacher)"}>
            <Select value={selectedTeacherId} onChange={(e) => handleTeacherChange(e.target.value)}>
              <option value="">{ar ? "اختر المدرس..." : "Select Teacher..."}</option>
              {db.teachers.filter(t => !t.isArchived).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "الصف الدراسي (للصف الكام)" : "Grade"}>
              <Select value={selectedGradeId} onChange={(e) => handleGradeChange(e.target.value)}>
                <option value="">{ar ? "اختر الصف..." : "Select Grade..."}</option>
                {GRADES.map((g) => (
                  <option key={g.id} value={g.id}>{ar ? g.ar : g.en}</option>
                ))}
              </Select>
            </Field>

            <Field label={ar ? "المجموعة / الحصة" : "Group"}>
              <Select value={form.groupId} onChange={(e) => set("groupId", e.target.value)}>
                <option value="">{ar ? "اختر المجموعة..." : "Select Group..."}</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "درجات الامتحان (من كام)" : "Max Grade"}><Input type="number" value={form.maxGrade} onChange={(e) => set("maxGrade", +e.target.value)} /></Field>
            <Field label={t("att.date")}><Input type="date" value={new Date(form.date).toISOString().slice(0, 10)} onChange={(e) => set("date", startOfDay(new Date(e.target.value).getTime()))} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function GradesTab() {
  const { db, t, lang, upsert } = useApp();
  const isAr = lang === "ar";
  
  const [examId, setExamId] = useState(db.exams[0]?.id ?? "");
  const [examSearch, setExamSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const filteredExams = useMemo(() => {
    const s = examSearch.toLowerCase().trim();
    if (!s) return db.exams;
    return db.exams.filter((e) => e.name.toLowerCase().includes(s));
  }, [db.exams, examSearch]);

  const exam = db.exams.find((e) => e.id === examId) || filteredExams[0];
  const activeExamId = exam?.id ?? "";

  const groupStudents = useMemo(
    () => (exam ? db.students.filter((s) => s.groupIds.includes(exam.groupId)) : []),
    [db.students, exam],
  );

  const filteredStudents = useMemo(() => {
    const s = studentSearch.toLowerCase().trim();
    if (!s) return groupStudents;
    return groupStudents.filter((st) => st.name.toLowerCase().includes(s));
  }, [groupStudents, studentSearch]);

  const gradeOf = (sid: string): ExamGrade | undefined =>
    db.examGrades.find((g) => g.examId === activeExamId && g.studentId === sid);

  const setGrade = (sid: string, value: number) => {
    if (!activeExamId) return;
    const existing = gradeOf(sid);
    upsert("examGrades", {
      id: existing?.id ?? `${activeExamId}_${sid}`,
      examId: activeExamId, studentId: sid, obtainedGrade: value,
      notes: existing?.notes, published: existing?.published, publishedAt: existing?.publishedAt,
      lastUpdated: now(),
    });
  };

  const publish = (sid?: string) => {
    if (!activeExamId) return;
    const targets = groupStudents.filter((s) => !sid || s.id === sid);
    let count = 0;
    for (const s of targets) {
      const g = gradeOf(s.id);
      if (!g) continue;
      upsert("examGrades", { ...g, published: true, publishedAt: now(), lastUpdated: now() });
      count++;
    }
    pushToast(sid ? t("toast.published") : t("toast.published"));
    void count;
  };

  const allPublished = groupStudents.length > 0 && groupStudents.every((s) => gradeOf(s.id)?.published);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line p-4 bg-surface/50 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1 items-end">
          {/* Exam search field */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">{isAr ? "البحث عن امتحان" : "Search Exam"}</span>
            <Input
              type="text"
              value={examSearch}
              onChange={(e) => setExamSearch(e.target.value)}
              placeholder={isAr ? "اكتب اسم الامتحان للفلترة..." : "Type exam name to filter..."}
              className="h-9 text-xs"
            />
          </div>

          {/* Exam select dropdown */}
          <Field label={t("exams.name")} className="w-full">
            <Select value={activeExamId} onChange={(e) => setExamId(e.target.value)}>
              {filteredExams.length === 0 ? (
                <option value="">{isAr ? "لا توجد امتحانات مطابقة" : "No matching exams"}</option>
              ) : (
                filteredExams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)
              )}
            </Select>
          </Field>

          {/* Student name search field */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">{isAr ? "البحث عن طالب" : "Search Student"}</span>
            <Input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder={isAr ? "اكتب اسم الطالب للبحث..." : "Type student name..."}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 justify-between md:justify-end shrink-0">
          {exam && <Badge tone="brand">/ {exam.maxGrade}</Badge>}
          {exam && groupStudents.length > 0 && (
            <Button size="sm" variant="subtle" disabled={allPublished} onClick={() => publish()}>
              <Send className="h-3.5 w-3.5" />{t("exams.publishAll")}
            </Button>
          )}
        </div>
      </div>
      {!exam ? (
        <div className="p-6"><EmptyState title={isAr ? "يرجى اختيار امتحان أولاً" : "Please select an exam first"} /></div>
      ) : groupStudents.length === 0 ? (
        <div className="p-6"><EmptyState title={isAr ? "لا يوجد طلاب في هذه المجموعة" : "No students in this group"} /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-6"><EmptyState title={isAr ? "لا توجد نتائج مطابقة لبحثك" : "No matching search results"} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
              <th className="px-4 py-2.5 text-start font-semibold">{t("students.name")}</th>
              <th className="px-4 py-2.5 text-start font-semibold">{t("students.code")}</th>
              <th className="px-4 py-2.5 text-end font-semibold">{t("exams.grade")} / {exam.maxGrade}</th>
              <th className="px-4 py-2.5 text-end font-semibold">%</th>
              <th className="px-4 py-2.5 text-end font-semibold">{t("exams.publish")}</th>
            </tr></thead>
            <tbody>
              {filteredStudents.map((s) => {
                const g = gradeOf(s.id);
                const pct = g && exam.maxGrade > 0 ? (g.obtainedGrade / exam.maxGrade) * 100 : 0;
                return (
                  <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                    <td className="px-4 py-2.5 font-medium text-ink">{s.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{s.id}</td>
                    <td className="px-4 py-2.5 text-end">
                      <Input type="number" step="0.5" min="0" max={exam.maxGrade} value={g?.obtainedGrade ?? ""} onChange={(e) => setGrade(s.id, +e.target.value)} className="ms-auto h-8 w-24 text-end" />
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <Badge tone={pct >= 50 ? "success" : "danger"}>{Math.round(pct)}%</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      {g?.published ? (
                        <Badge tone="success"><Bell className="h-3 w-3" />{t("exams.published")}</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={!g} onClick={() => publish(s.id)}>
                          <Send className="h-3.5 w-3.5" />{t("exams.publish")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function HomeworkTab() {
  const { db, t, upsert, remove, can } = useApp();
  const [open, setOpen] = useState(false);
  const { view, change: setView } = usePersistentView("homework", "grid");
  const [form, setForm] = useState<Assignment>({ id: "", groupId: db.groups[0]?.id ?? "", title: "", description: "", dueDate: startOfDay(now()), lastUpdated: now() });

  const openCreate = () => { setForm({ id: "", groupId: db.groups[0]?.id ?? "", title: "", description: "", dueDate: startOfDay(now()), lastUpdated: now() }); setOpen(true); };
  const save = () => { if (!form.title.trim()) return; const isNew = !form.id; upsert("assignments", form); if (isNew) pushToast(t("exams.notifyHw")); setOpen(false); };
  const set = <K extends keyof Assignment>(k: K, v: Assignment[K]) => setForm((f) => ({ ...f, [k]: v }));

  const sorted = [...db.assignments].sort((a, b) => a.dueDate - b.dueDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {can("exams.manage") && <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("exams.newHw")}</Button>}
        {sorted.length > 0 && <ViewToggle value={view} onChange={setView} />}
      </div>
      {sorted.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<BookOpen className="h-6 w-6" />} title={t("exams.empty")} /></Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                <th className="px-4 py-2.5 text-start font-semibold">{t("exams.title2")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("classes.groups")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("exams.due")}</th>
                <th className="px-4 py-2.5 text-end font-semibold"></th>
              </tr></thead>
              <tbody>
                {sorted.map((a) => {
                  const group = db.groups.find((g) => g.id === a.groupId);
                  const overdue = a.dueDate < startOfDay(now());
                  return (
                    <tr key={a.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                      <td className="px-4 py-2.5 font-medium text-ink">{a.title}</td>
                      <td className="px-4 py-2.5 text-muted">{group?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={overdue ? "font-medium text-rose-600" : "text-muted"}>{new Date(a.dueDate).toLocaleDateString()}</span>
                        {overdue && <Badge tone="danger" className="ms-2">{t("students.registered")}</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          onClick={() => window.open(getWhatsAppHomeworkShareUrl(db, a).url, "_blank")}
                        >
                          <MessageCircle className="h-4 w-4 me-1.5" />
                          مشاركة
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : view === "compact" ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line/60">
            {sorted.map((a) => {
              const group = db.groups.find((g) => g.id === a.groupId);
              const overdue = a.dueDate < startOfDay(now());
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/40">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15"><BookOpen className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{a.title}</p>
                    <p className="truncate text-[10px] text-faint">{group?.name ?? "—"}</p>
                  </div>
                  <span className={cn("text-[11px]", overdue ? "font-medium text-rose-600" : "text-muted")}>{new Date(a.dueDate).toLocaleDateString()}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 ms-2"
                    onClick={() => window.open(getWhatsAppHomeworkShareUrl(db, a).url, "_blank")}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((a) => {
            const group = db.groups.find((g) => g.id === a.groupId);
            const overdue = a.dueDate < startOfDay(now());
            return (
              <Card key={a.id} className="card-hover p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{a.title}</p>
                    <p className="text-[11px] text-muted">{group?.name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      onClick={() => window.open(getWhatsAppHomeworkShareUrl(db, a).url, "_blank")}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    {can("exams.manage") && <Button variant="ghost" size="icon" onClick={() => remove("assignments", a.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                  </div>
                </div>
                {a.description && <p className="mt-2 text-xs text-muted">{a.description}</p>}
                <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[11px]">
                  <CalendarClock className="h-3.5 w-3.5 text-faint" />
                  <span className={overdue ? "font-medium text-rose-600" : "text-muted"}>
                    {new Date(a.dueDate).toLocaleDateString()}
                  </span>
                  {overdue && <Badge tone="danger" className="ms-auto">{t("students.registered")}</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("exams.newHw")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button onClick={save}>{t("action.save")}</Button></>}>
        <div className="space-y-3">
          <Field label={t("exams.title2")}><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label={t("classes.groups")}>
            <Select value={form.groupId} onChange={(e) => set("groupId", e.target.value)}>
              {db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label={t("exams.due")}><Input type="date" value={new Date(form.dueDate).toISOString().slice(0, 10)} onChange={(e) => set("dueDate", startOfDay(new Date(e.target.value).getTime()))} /></Field>
          <Field label={t("classes.notes")}><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
