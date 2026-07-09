import { useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, XCircle, Clock, FileText, AlertCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, Select, Modal, Button, pushToast } from "./ui";
import { studentMonthAttendance, type SessionStatus } from "../lib/analytics";
import { monthKey, now } from "../lib/db";
import { cn } from "../utils/cn";
import type { Group } from "../lib/types";

const STATUS_META: Record<SessionStatus, { tone: string; ring: string; icon: typeof CheckCircle2 }> = {
  PRESENT: { tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-500/30", icon: CheckCircle2 },
  LATE: { tone: "text-amber-600 bg-amber-50 dark:bg-amber-500/10", ring: "ring-amber-500/30", icon: Clock },
  ABSENT: { tone: "text-rose-600 bg-rose-50 dark:bg-rose-500/10", ring: "ring-rose-500/30", icon: XCircle },
  EXCUSED: { tone: "text-sky-600 bg-sky-50 dark:bg-sky-500/10", ring: "ring-sky-500/30", icon: FileText },
  UNMARKED: { tone: "text-faint bg-elevated", ring: "ring-line", icon: FileText },
};

/** Lists the last N months as "yyyy-MM" + label options. */
function recentMonths(count: number, isAr: boolean) {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "long", year: "numeric" }) });
  }
  return out;
}

export function MonthlyAttendance({ 
  studentId, 
  selectedGroupId, 
  onSelectGroup 
}: { 
  studentId: string;
  selectedGroupId?: string;
  onSelectGroup?: (gid: string | undefined) => void;
}) {
  const { db, t, lang, upsert, remove, can } = useApp();
  const isAr = lang === "ar";
  const [month, setMonth] = useState(monthKey(now()));
  const [editingSession, setEditingSession] = useState<{ date: number; status: SessionStatus } | null>(null);
  const months = useMemo(() => recentMonths(12, isAr), [isAr]);

  const student = useMemo(() => db.students.find((s) => s.id === studentId), [db.students, studentId]);

  const groups = useMemo(() => {
    return (student?.groupIds ?? [])
      .map((id) => db.groups.find((g) => g.id === id))
      .filter(Boolean) as Group[];
  }, [student, db.groups]);

  // Determine active group selection — strictly default to the first group if none specified, no combined view
  const activeGroupId = selectedGroupId || groups[0]?.id;
  const setActiveGroupId = (gid: string | undefined) => {
    if (onSelectGroup) onSelectGroup(gid);
  };

  // Check if student was registered in the selected month
  const isRegisteredInSelectedMonth = useMemo(() => {
    if (!student || !student.registrationDate) return true;
    const regMonth = new Date(student.registrationDate).toISOString().slice(0, 7); // "yyyy-MM"
    return month >= regMonth;
  }, [student, month]);

  const data = useMemo(
    () => studentMonthAttendance(db, studentId, month, activeGroupId),
    [db, studentId, month, activeGroupId],
  );

  const counts = [
    { key: "PRESENT" as const, n: data.present, label: t("att.presentShort") },
    { key: "ABSENT" as const, n: data.absent, label: t("att.absentShort") },
    { key: "LATE" as const, n: data.late, label: t("att.lateShort") },
    { key: "EXCUSED" as const, n: data.excused, label: t("att.excusedShort") },
  ];

  return (
    <Card id="monthly-attendance-card" className="border border-line/80 shadow-sm p-5 bg-surface/50">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-ink">
          <CalendarCheck className="h-5 w-5 text-brand-600" />
          {t("att.monthTitle")}
        </h3>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-auto min-w-[140px] py-1 text-xs">
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
      </div>

      {/* Group Quick Filter Tabs */}
      {groups.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 bg-muted/40 p-1 rounded-lg border border-line">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeGroupId === g.id ? "bg-brand-600 text-white shadow-sm font-black" : "text-muted hover:bg-elevated"
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {!isRegisteredInSelectedMonth ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-500/10">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-ink">
            {isAr ? "لم يكن الطالب مسجلاً بعد في السنتر" : "Student was not registered yet"}
          </p>
          <p className="mt-1 text-xs text-muted max-w-xs">
            {isAr 
              ? `تاريخ تسجيل الطالب هو ${new Date(student?.registrationDate || 0).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}` 
              : `Student registered on ${new Date(student?.registrationDate || 0).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}
          </p>
        </div>
      ) : data.expected === 0 ? (
        <p className="py-8 text-center text-xs text-muted font-medium">{t("att.noSessions")}</p>
      ) : (
        <>
          {/* rate bar */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span className="text-ink">{isAr ? "نسبة الحضور:" : "Attendance:"} <b className="text-brand-600 text-sm font-extrabold">{Math.round(data.rate)}%</b></span>
              <span className="text-faint font-medium">{t("att.ofSessions", { n: data.expected })}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-elevated/70">
              {counts.map((c) => {
                const w = data.expected ? (c.n / data.expected) * 100 : 0;
                const color =
                  c.key === "PRESENT" ? "bg-emerald-500 animate-pulse-subtle" :
                  c.key === "LATE" ? "bg-amber-500" :
                  c.key === "ABSENT" ? "bg-rose-500" : "bg-sky-500";
                return <div key={c.key} className={color} style={{ width: `${Math.max(0, w)}%` }} />;
              })}
            </div>
          </div>

          {/* counts */}
          <div className="mb-4 grid grid-cols-4 gap-2">
            {counts.map((c) => {
              const meta = STATUS_META[c.key];
              const Icon = meta.icon;
              return (
                <div key={c.key} className={cn("rounded-xl p-2.5 text-center border transition-all hover:scale-[1.02]", meta.tone, meta.ring)}>
                  <Icon className="mx-auto mb-1 h-4 w-4" />
                  <p className="text-lg font-black leading-none">{c.n}</p>
                  <p className="mt-1 text-[10px] font-bold tracking-tight opacity-90">{c.label}</p>
                </div>
              );
            })}
          </div>

          {/* session-by-session history */}
          <div className="max-h-64 space-y-1.5 overflow-y-auto pe-1 divide-y divide-line/40">
            {data.sessions.map((s, i) => {
              const meta = STATUS_META[s.status];
              const Icon = meta.icon;
              const d = new Date(s.date);
              const isEditable = can("attendance.manage");
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 pt-1.5 first:pt-0 last:border-b-0 text-xs transition-all",
                    isEditable && "cursor-pointer hover:bg-brand-500/[0.04] active:scale-[0.99] rounded px-1.5 py-1"
                  )}
                  onClick={() => {
                    if (isEditable) {
                      setEditingSession({ date: s.date, status: s.status });
                    }
                  }}
                  title={isEditable ? (isAr ? "انقر لتعديل حالة الحضور" : "Click to edit attendance status") : undefined}
                >
                  <div className={cn("flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg border", meta.tone, meta.ring)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {d.toLocaleDateString(lang === "ar" ? "ar-EG" : undefined, { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0", meta.tone, meta.ring)}>
                    {s.status === "UNMARKED" ? t("att.unmarked") : t(`att.${s.status.toLowerCase()}`)}
                  </span>
                </div>
              );
            })}
          </div>
          {data.unmarked > 0 && (
            <p className="mt-2.5 text-center text-[10px] font-medium text-faint">{t("att.unmarked")}: {data.unmarked}</p>
          )}
        </>
      )}

      {/* Interactive Attendance Editor Modal */}
      {editingSession && (
        <Modal
          open={!!editingSession}
          onClose={() => setEditingSession(null)}
          title={isAr ? "تعديل حالة الحضور" : "Edit Attendance Status"}
        >
          <div className="space-y-4 p-1">
            <p className="text-xs text-muted">
              {isAr ? "اختر الحالة الجديدة لحضور الطالب ليوم:" : "Choose the new attendance status for:"}
            </p>
            <p className="text-sm font-bold text-brand-700 dark:text-brand-300 bg-brand-50/80 dark:bg-brand-500/10 p-2.5 rounded-lg border border-brand-100 dark:border-brand-500/20">
              {new Date(editingSession.date).toLocaleDateString(isAr ? "ar-EG" : undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                className="justify-start gap-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                onClick={() => {
                  if (!editingSession || !activeGroupId) return;
                  const { date } = editingSession;
                  const recordId = `${studentId}_${date}_${activeGroupId}`;
                  const existing = db.attendance.find((a) => a.studentId === studentId && a.groupId === activeGroupId && a.date === date);
                  upsert("attendance", {
                    id: existing?.id ?? recordId,
                    studentId,
                    groupId: activeGroupId,
                    date,
                    status: "PRESENT",
                    tempDegree: existing?.tempDegree,
                    notes: existing?.notes,
                    lastUpdated: now(),
                  });
                  pushToast(isAr ? "تم تسجيل الحضور بنجاح" : "Marked present successfully", "success");
                  setEditingSession(null);
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {t("att.present")}
              </Button>

              <Button
                variant="secondary"
                className="justify-start gap-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200"
                onClick={() => {
                  if (!editingSession || !activeGroupId) return;
                  const { date } = editingSession;
                  const recordId = `${studentId}_${date}_${activeGroupId}`;
                  const existing = db.attendance.find((a) => a.studentId === studentId && a.groupId === activeGroupId && a.date === date);
                  upsert("attendance", {
                    id: existing?.id ?? recordId,
                    studentId,
                    groupId: activeGroupId,
                    date,
                    status: "LATE",
                    tempDegree: existing?.tempDegree,
                    notes: existing?.notes,
                    lastUpdated: now(),
                  });
                  pushToast(isAr ? "تم تسجيل التأخير بنجاح" : "Marked late successfully", "success");
                  setEditingSession(null);
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                {t("att.late")}
              </Button>

              <Button
                variant="secondary"
                className="justify-start gap-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                onClick={() => {
                  if (!editingSession || !activeGroupId) return;
                  const { date } = editingSession;
                  const recordId = `${studentId}_${date}_${activeGroupId}`;
                  const existing = db.attendance.find((a) => a.studentId === studentId && a.groupId === activeGroupId && a.date === date);
                  upsert("attendance", {
                    id: existing?.id ?? recordId,
                    studentId,
                    groupId: activeGroupId,
                    date,
                    status: "ABSENT",
                    tempDegree: existing?.tempDegree,
                    notes: existing?.notes,
                    lastUpdated: now(),
                  });
                  pushToast(isAr ? "تم تسجيل الغياب بنجاح" : "Marked absent successfully", "success");
                  setEditingSession(null);
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                {t("att.absent")}
              </Button>

              <Button
                variant="secondary"
                className="justify-start gap-2 text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200"
                onClick={() => {
                  if (!editingSession || !activeGroupId) return;
                  const { date } = editingSession;
                  const recordId = `${studentId}_${date}_${activeGroupId}`;
                  const existing = db.attendance.find((a) => a.studentId === studentId && a.groupId === activeGroupId && a.date === date);
                  upsert("attendance", {
                    id: existing?.id ?? recordId,
                    studentId,
                    groupId: activeGroupId,
                    date,
                    status: "EXCUSED",
                    tempDegree: existing?.tempDegree,
                    notes: existing?.notes,
                    lastUpdated: now(),
                  });
                  pushToast(isAr ? "تم تسجيل الاستئذان بنجاح" : "Marked excused successfully", "success");
                  setEditingSession(null);
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                {t("att.excused")}
              </Button>

              <Button
                variant="secondary"
                className="col-span-1 sm:col-span-2 justify-center gap-2 text-muted bg-surface hover:bg-elevated border-line"
                onClick={() => {
                  if (!editingSession || !activeGroupId) return;
                  const { date } = editingSession;
                  const existing = db.attendance.find((a) => a.studentId === studentId && a.groupId === activeGroupId && a.date === date);
                  if (existing) {
                    remove("attendance", existing.id);
                  }
                  pushToast(isAr ? "تم مسح حالة الحضور لهذا اليوم بنجاح" : "Attendance record cleared successfully", "info");
                  setEditingSession(null);
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-faint" />
                {isAr ? "حذف السجل / غير مسجل" : "Clear Record / Unmarked"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
