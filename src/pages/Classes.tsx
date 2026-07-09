import {  useMemo, useState } from "react";
import { 
  Plus, Pencil, Trash2, Boxes, DoorOpen, User, Clock, AlertTriangle,
  Lock, Unlock, CheckSquare, Square, X, CalendarDays,
} from "lucide-react";
import {  useApp } from "../context/AppContext";
import { 
  PageHeader, Button, Card, Input, Select, Field, Badge, Modal, Tabs, EmptyState, FilterSelect, pushToast,
} from "../components/ui";
import {  TimePicker } from "../components/TimePicker";
import {  usePersistentView } from "../components/PersistentViewToggle";
import {  ViewToggle } from "../components/ViewToggle";
import type { Group, Classroom, ScheduleEvent, DayOfWeek } from "../lib/types";
import {  now, uid } from "../lib/db";
import {  GRADES, STAGE_TONE, gradeLabel, formatTime12 as fmt12, SUBJECTS, subjectLabel } from "../lib/constants";
import {  toMin, overlaps } from "../lib/schedule";
import {  cn } from "../utils/cn";
import {  FeatureLockOverlay } from "../components/FeatureLockOverlay";

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];
const DAY_KEY: Record<number, string> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun" };

interface DraftSession {
  id: string;
  dayOfWeek: DayOfWeek;
  classroomId: string;
  startTime: string;
  endTime: string;
  locked: boolean;
}

function defaultSession(classroomId: string): DraftSession {
  return { id: uid("sch"), dayOfWeek: 1, classroomId, startTime: "16:00", endTime: "17:30", locked: false };
}

export function Classes() {
  const { t, subscriptionPlan } = useApp();
  const [tab, setTab] = useState("groups");
  const isRoomsLocked = subscriptionPlan === "free";
  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("classes.title")} subtitle={t("classes.subtitle")} />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "groups", label: t("classes.groups"), icon: <Boxes className="h-4 w-4" /> },
          { id: "rooms", label: t("classes.classrooms"), icon: <DoorOpen className="h-4 w-4" /> },
        ]}
      />
      {tab === "groups" ? (
        <GroupsTab />
      ) : (
        <div className="relative min-h-[350px]">
          <div className={cn(isRoomsLocked ? "pointer-events-none blur-sm select-none" : "")}>
            <RoomsTab />
          </div>
          {isRoomsLocked && (
            <FeatureLockOverlay
              title="إدارة القاعات مغلقة"
              description="أنشئ قاعات واستخدم نظام كشف التعارضات الذكي لمنع تداخل الحصص. متاحة في الخطة الاحترافية أو المؤسسية."
              requiredPlan="pro"
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Groups tab ------------------------------ */
function GroupsTab() {

  const handleDeleteGroup = (g: Group) => {
    const hasAttendance = db.attendance.some(a => a.groupId === g.id);
    const hasExams = db.exams.some(e => e.groupId === g.id);
    const hasAssignments = db.assignments && db.assignments.some(a => a.groupId === g.id);

    if (hasAttendance || hasExams || hasAssignments) {
      if (window.confirm(lang === "ar" ? "لا يمكن حذف هذه المجموعة لوجود سجلات مرتبطة بها (غياب، امتحانات). هل ترغب في أرشفتها بدلاً من ذلك؟" : "Cannot delete this group because it has associated records. Would you like to archive it instead?")) {
        upsert("groups", { ...g, isArchived: true, lastUpdated: Date.now() });
        pushToast(lang === "ar" ? "تم أرشفة المجموعة" : "Group archived");
      }
    } else {
      if (window.confirm(lang === "ar" ? "تأكيد حذف المجموعة؟" : "Confirm delete group?")) {
        remove("groups", g.id);
        pushToast(t("toast.deleted"));
      }
    }
  };

  const { db, t, lang, upsert, remove, can } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState<Group>({ id: "", name: "", teacherId: db.teachers.filter(t => !t.isArchived)[0]?.id, grade: GRADES[0].id, subject: "", days: [], scheduleDescription: "", lastUpdated: now() });
  const [selected, setSelected] = useState<string[]>([]);
  const [sessions, setSessions] = useState<DraftSession[]>([]);
  const [fTeacher, setFTeacher] = useState("");
  const [fGrade, setFGrade] = useState("");
  const { view: gView, change: setGView } = usePersistentView("groups", "grid");

  const set = <K extends keyof Group>(k: K, v: Group[K]) => setForm((f) => ({ ...f, [k]: v }));

  const filteredGroups = useMemo(
    () => db.groups.filter((g) => !g.isArchived && (!fTeacher || g.teacherId === fTeacher) && (!fGrade || g.grade === fGrade)),
    [db.groups, fTeacher, fGrade],
  );

  const openCreate = () => {
    const teacherId = db.teachers[0]?.id;
    setForm({ id: "", name: "", teacherId, grade: GRADES[0].id, subject: db.teachers[0]?.subjects[0] ?? "", days: [1, 3], scheduleDescription: "", lastUpdated: now() });
    setSelected([]);
    setSessions(db.classrooms[0] ? [defaultSession(db.classrooms[0].id)] : []);
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (g: Group) => {
    const teacher = db.teachers.find((x) => x.id === g.teacherId);
    setForm({ ...g });
    setSelected(db.students.filter((s) => s.groupIds.includes(g.id)).map((s) => s.id));
    setSessions(
      db.scheduleEvents
        .filter((e) => e.groupId === g.id)
        .map((e) => ({ id: e.id, dayOfWeek: e.dayOfWeek, classroomId: e.classroomId, startTime: e.startTime, endTime: e.endTime, locked: !!e.locked })),
    );
    setEditing({ ...g, subject: g.subject || teacher?.subjects[0] || "" });
    setOpen(true);
  };

  // students matching the chosen teacher + grade
  const matchingStudents = useMemo(
    () => db.students.filter((s) => s.grade === form.grade && s.teachers.some((tr) => tr.teacherId === form.teacherId)),
    [db.students, form.grade, form.teacherId],
  );

  const toggleStudent = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // conflict detection for each draft (against other groups + sibling drafts)
  const conflictFor = (idx: number): { locked: boolean } | null => {
    const d = sessions[idx];
    if (toMin(d.endTime) <= toMin(d.startTime)) return { locked: false };
    for (const e of db.scheduleEvents) {
      if (editing && e.groupId === editing.id) continue; // ignore this group's old events
      const ev = { ...e } as ScheduleEvent;
      if (overlaps(ev, { ...d, id: d.id } as ScheduleEvent)) return { locked: !!e.locked };
    }
    for (let j = 0; j < sessions.length; j++) {
      if (j === idx) continue;
      if (overlaps(sessions[j] as unknown as ScheduleEvent, d as unknown as ScheduleEvent)) return { locked: sessions[j].locked };
    }
    return null;
  };
  const hasLockedConflict = sessions.some((_, i) => conflictFor(i)?.locked);

  const save = () => {
    if (!form.name.trim()) return;
    if (hasLockedConflict) return;
    const groupId = form.id || uid("grp");
    const group: Group = { ...form, id: groupId, lastUpdated: now() };
    upsert("groups", group);

    // sync membership
    const prevMembers = editing ? db.students.filter((s) => s.groupIds.includes(groupId)) : [];
    const toAdd = selected.filter((id) => !prevMembers.some((s) => s.id === id));
    const toRemove = prevMembers.filter((s) => !selected.includes(s.id));
    for (const id of toAdd) {
      const s = db.students.find((x) => x.id === id);
      if (s) upsert("students", { ...s, groupIds: [...new Set([...s.groupIds, groupId])] });
    }
    for (const s of toRemove) upsert("students", { ...s, groupIds: s.groupIds.filter((g) => g !== groupId) });

    // replace schedule events for this group
    const oldEvents = db.scheduleEvents.filter((e) => e.groupId === groupId);
    const keepIds = new Set(sessions.map((s) => s.id));
    for (const e of oldEvents) if (!keepIds.has(e.id)) remove("scheduleEvents", e.id);
    for (const s of sessions) {
      const ev: ScheduleEvent = {
        id: s.id, groupId, classroomId: s.classroomId, dayOfWeek: s.dayOfWeek,
        startTime: s.startTime, endTime: s.endTime, locked: s.locked, lastUpdated: now(),
      };
      upsert("scheduleEvents", ev);
    }
    setOpen(false);
  };

  const updateSession = (idx: number, patch: Partial<DraftSession>) =>
    setSessions((p) => p.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const studentCount = (id: string) => db.students.filter((s) => s.groupIds.includes(id)).length;
  const groupTimes = (gid: string) =>
    db.scheduleEvents.filter((e) => e.groupId === gid).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-4">
      {can("classes.manage") && <div className="flex justify-end"><Button onClick={openCreate}><Plus className="h-4 w-4" />{t("classes.newGroup")}</Button></div>}
      {db.groups.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Boxes className="h-6 w-6" />} title={t("classes.emptyGroups")} /></Card>
      ) : (
        <>
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <FilterSelect label={t("class.filter.teacher")} value={fTeacher} onChange={setFTeacher}
            options={[{ value: "", label: t("students.filter.all") }, ...db.teachers.map((tc) => ({ value: tc.id, label: tc.name }))]} />
          <FilterSelect label={t("class.filter.grade")} value={fGrade} onChange={setFGrade}
            options={[{ value: "", label: t("students.filter.all") }, ...GRADES.map((g) => ({ value: g.id, label: lang === "ar" ? g.ar : g.en }))]} />
          <div className="ms-auto flex items-center gap-2">
            <Badge tone="brand">{t("class.results", { n: filteredGroups.length })}</Badge>
            <ViewToggle value={gView} onChange={setGView} />
          </div>
        </Card>
        {gView === "table" ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                  <th className="px-4 py-2.5 text-start font-semibold">{t("classes.groups")}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t("classes.teacher")}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t("classes.targetGrade")}</th>
                  <th className="px-4 py-2.5 text-center font-semibold">{t("classes.count")}</th>
                </tr></thead>
                <tbody>
                  {filteredGroups.map((g) => {
                    const teacher = db.teachers.find((x) => x.id === g.teacherId);
                    const grade = GRADES.find((x) => x.id === g.grade);
                    return (
                      <tr key={g.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                        <td className="px-4 py-2.5 font-medium text-ink">{g.name}</td>
                        <td className="px-4 py-2.5 text-muted">{teacher?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted">{grade ? gradeLabel(g.grade, lang) : "—"}</td>
                        <td className="px-4 py-2.5 text-center text-ink">{studentCount(g.id)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : gView === "compact" ? (
          <Card className="overflow-hidden">
            <div className="divide-y divide-line/60">
              {filteredGroups.map((g) => {
                const teacher = db.teachers.find((x) => x.id === g.teacherId);
                return (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/40">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15"><Boxes className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{g.name}</p>
                      <p className="truncate text-[10px] text-faint">{teacher?.name ?? "—"}</p>
                    </div>
                    <Badge tone="brand">{studentCount(g.id)}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g) => {
            const teacher = db.teachers.find((x) => x.id === g.teacherId);
            const grade = GRADES.find((x) => x.id === g.grade);
            const times = groupTimes(g.id);
            return (
              <Card key={g.id} className="card-hover p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{g.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone="brand">{g.subject}</Badge>
                      {grade && <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STAGE_TONE[grade.stage])}>{gradeLabel(g.grade, lang)}</span>}
                    </div>
                  </div>
                  {can("classes.manage") && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 space-y-1 text-xs text-muted">
                  <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-faint" />{teacher?.name ?? "—"}</p>
                  {g.days?.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-faint" />
                      {g.days.map((d) => (
                        <span key={d} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{t(`schedule.days.${DAY_KEY[d]}`)}</span>
                      ))}
                    </p>
                  )}
                  {times.length > 0 ? times.map((e) => {
                    const room = db.classrooms.find((c) => c.id === e.classroomId);
                    return (
                      <p key={e.id} className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-faint" />
                        {t(`schedule.days.${DAY_KEY[e.dayOfWeek]}`)} · {fmt12(e.startTime, lang)}–{fmt12(e.endTime, lang)}
                        {e.locked && <Lock className="h-3 w-3 text-amber-500" />}
                        <span className="text-faint">· {room?.name}</span>
                      </p>
                    );
                  }) : null}
                </div>
                <div className="mt-3 border-t border-line pt-3 text-center">
                  <p className="text-lg font-bold text-ink">{studentCount(g.id)}</p>
                  <p className="text-[10px] text-faint">{t("classes.count")}</p>
                </div>
              </Card>
            );
          })}
        </div>
        )}
        </>
      )}

      {/* group editor modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("action.edit") : t("classes.newGroup")} size="xl"
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
          <Button onClick={save} disabled={hasLockedConflict}>{t("action.save")}</Button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`${t("classes.groups")} ${t("students.name")}`}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Mathematics · Grade 9" />
            </Field>
            <div className="space-y-3">
              <Field label={lang === "ar" ? "المادة" : "Subject"}>
                <Select
                  value={SUBJECTS.includes(form.subject) ? form.subject : (form.subject ? (form.subject.startsWith("Course:") || form.subject.startsWith("كورس:") ? "Course" : "Custom") : "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Course") {
                      set("subject", lang === "ar" ? "كورس: " : "Course: ");
                    } else if (val === "Custom") {
                      set("subject", "");
                    } else {
                      set("subject", val);
                    }
                  }}
                >
                  <option value="">—</option>
                  {SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>
                      {subjectLabel(sub, lang)}
                    </option>
                  ))}
                  <option value="Course">
                    {lang === "ar" ? "كورس" : "Course"}
                  </option>
                  <option value="Custom">
                    {lang === "ar" ? "مادة مخصصة" : "Custom Subject"}
                  </option>
                </Select>
              </Field>

              {(form.subject.startsWith("Course:") || form.subject.startsWith("كورس:") || form.subject === "Course" || form.subject === "كورس") && (
                <Field label={lang === "ar" ? "نوع الكورس" : "Course Type"} required>
                  <Input
                    value={form.subject.replace(/^(Course:|كورس:)\s*/, "")}
                    onChange={(e) => {
                      const prefix = lang === "ar" ? "كورس: " : "Course: ";
                      set("subject", prefix + e.target.value);
                    }}
                    placeholder={lang === "ar" ? "مثال: محادثة إنجليزية، برمجة ويب" : "e.g., English Conversation, Web Dev"}
                  />
                </Field>
              )}

              {(!SUBJECTS.includes(form.subject) && !form.subject.startsWith("Course:") && !form.subject.startsWith("كورس:") && form.subject !== "Course" && form.subject !== "كورس") && (
                <Field label={lang === "ar" ? "اسم المادة المخصصة" : "Custom Subject Name"}>
                  <Input
                    value={form.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    placeholder={lang === "ar" ? "اكتب اسم المادة المخصصة" : "Type custom subject name"}
                  />
                </Field>
              )}
            </div>
            <Field label={t("classes.groupTeacher")}>
              <Select value={form.teacherId ?? ""} onChange={(e) => set("teacherId", e.target.value)}>
                <option value="">—</option>
                {db.teachers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </Field>
            <Field label={t("classes.targetGrade")}>
              <Select value={form.grade ?? ""} onChange={(e) => set("grade", e.target.value)}>
                {GRADES.map((g) => <option key={g.id} value={g.id}>{lang === "ar" ? g.ar : g.en}</option>)}
              </Select>
            </Field>
          </div>

          {/* meeting days — drives expected attendance */}
          <Field label={t("group.days")} hint={t("group.daysHint")}>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = form.days.includes(d);
                return (
                  <button key={d} type="button" onClick={() =>
                    set("days", on ? form.days.filter((x) => x !== d) : [...form.days, d])}
                    className={cn("h-9 w-12 rounded-lg border text-xs font-bold transition",
                      on ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                    {t(`schedule.days.${DAY_KEY[d]}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* matching students */}
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">
                {t("classes.selectStudents")} <span className="text-faint">({matchingStudents.length})</span>
              </span>
              {matchingStudents.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setSelected(matchingStudents.map((s) => s.id))} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline">
                    <CheckSquare className="h-3.5 w-3.5" />{t("classes.selectAll")}
                  </button>
                  <button onClick={() => setSelected([])} className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:underline">
                    <Square className="h-3.5 w-3.5" />{t("classes.clearAll")}
                  </button>
                </div>
              )}
            </div>
            {matchingStudents.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-amber-600">
                {form.teacherId ? t("classes.noMatching") : t("classes.addStudentsFirst")}
              </p>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {matchingStudents.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleStudent(s.id)}
                      className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                        on ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                      {on ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="font-mono text-[10px] text-faint">{s.id}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* schedule builder */}
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">{t("schedule.title")}</span>
              <Button size="sm" variant="subtle" disabled={!db.classrooms.length}
                onClick={() => setSessions((p) => [...p, defaultSession(db.classrooms[0].id)])}>
                <Plus className="h-3.5 w-3.5" />{t("schedule.add")}
              </Button>
            </div>
            <div className="space-y-2">
              {sessions.map((s, i) => {
                const conflict = conflictFor(i);
                const badTime = toMin(s.endTime) <= toMin(s.startTime);
                return (
                  <div key={s.id} className="rounded-lg border border-line p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={s.dayOfWeek} onChange={(e) => updateSession(i, { dayOfWeek: +e.target.value as DayOfWeek })} className="w-24">
                        {DAYS.map((d) => <option key={d} value={d}>{t(`schedule.days.${DAY_KEY[d]}`)}</option>)}
                      </Select>
                      <Select value={s.classroomId} onChange={(e) => updateSession(i, { classroomId: e.target.value })} className="min-w-[140px] flex-1">
                        {db.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                      <button onClick={() => setSessions((p) => p.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted hover:text-rose-500">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-faint">{t("classes.startTime")}</span>
                        <TimePicker value={s.startTime} onChange={(v) => updateSession(i, { startTime: v })} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-faint">{t("classes.endTime")}</span>
                        <TimePicker value={s.endTime} onChange={(v) => updateSession(i, { endTime: v })} />
                      </div>
                      <button
                        onClick={() => updateSession(i, { locked: !s.locked })}
                        className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium",
                          s.locked ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300" : "border-line text-muted hover:bg-elevated")}
                        title={t("action.lock")}
                      >
                        {s.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {s.locked ? t("status.synced").replace("synced", "Locked") : "Lock"}
                      </button>
                    </div>
                    {(conflict || badTime) && (
                      <p className={cn("mt-1.5 flex items-center gap-1 text-[10px] font-medium", conflict?.locked ? "text-rose-600" : "text-amber-600")}>
                        <AlertTriangle className="h-3 w-3" />
                        {badTime ? t("schedule.conflict") : conflict?.locked ? `${t("schedule.conflict")} 🔒` : t("schedule.conflict")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------- Rooms tab ------------------------------- */
function RoomsTab() {
  const { db, t, lang, upsert, remove, can } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState<Classroom>({ id: "", name: "", capacity: 24, notes: "", lastUpdated: now() });
  const { view: rView, change: setRView } = usePersistentView("rooms", "grid");

  const openCreate = () => { setForm({ id: "", name: "", capacity: 24, notes: "", lastUpdated: now() }); setEditing(null); setOpen(true); };
  const openEdit = (c: Classroom) => { setForm({ ...c }); setEditing(c); setOpen(true); };
  const save = () => { if (!form.name.trim()) return; upsert("classrooms", form); setOpen(false); };
  const set = <K extends keyof Classroom>(k: K, v: Classroom[K]) => setForm((f) => ({ ...f, [k]: v }));
  const booked = (id: string) => db.scheduleEvents.filter((e) => e.classroomId === id).length;
  void lang;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {can("classes.manage") ? <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("classes.newRoom")}</Button> : <span />}
        {db.classrooms.length > 0 && <ViewToggle value={rView} onChange={setRView} />}
      </div>
      {db.classrooms.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<DoorOpen className="h-6 w-6" />} title={t("classes.emptyRooms")} /></Card>
      ) : rView === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                <th className="px-4 py-2.5 text-start font-semibold">{t("classes.room")}</th>
                <th className="px-4 py-2.5 text-center font-semibold">{t("classes.capacity")}</th>
                <th className="px-4 py-2.5 text-center font-semibold">{t("schedule.add")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("classes.notes")}</th>
              </tr></thead>
              <tbody>
                {db.classrooms.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                    <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-2.5 text-center text-ink">{c.capacity}</td>
                    <td className="px-4 py-2.5 text-center text-ink">{booked(c.id)}</td>
                    <td className="px-4 py-2.5 text-muted">{c.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : rView === "compact" ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line/60">
            {db.classrooms.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15"><DoorOpen className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="truncate text-[10px] text-faint">{c.notes ?? "—"}</p>
                </div>
                <span className="text-xs text-muted">{c.capacity} · {booked(c.id)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {db.classrooms.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <DoorOpen className="h-5 w-5" />
                </div>
                {can("classes.manage") && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove("classrooms", c.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                )}
              </div>
              <p className="mt-3 truncate font-semibold text-ink">{c.name}</p>
              {c.notes && <p className="text-[11px] text-muted">{c.notes}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-center">
                <div><p className="text-sm font-bold text-ink">{c.capacity}</p><p className="text-[10px] text-faint">{t("classes.capacity")}</p></div>
                <div><p className="text-sm font-bold text-ink">{booked(c.id)}</p><p className="text-[10px] text-faint">{t("schedule.add")}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("action.edit") : t("classes.newRoom")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button onClick={save}>{t("action.save")}</Button></>}>
        <div className="space-y-3">
          <Field label={`${t("classes.room")} ${t("students.name")}`}><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Room A · Ground" /></Field>
          <Field label={t("classes.capacity")}><Input type="number" value={form.capacity} onChange={(e) => set("capacity", +e.target.value)} /></Field>
          <Field label={t("classes.notes")}><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
