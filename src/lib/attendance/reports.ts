/**
 * Attendance Reports Engine
 * =========================
 * Generates structured attendance analytics for any date range: per-student,
 * per-teacher, per-group, and late/early-leave/absence summaries. Pure functions
 * that the UI maps onto PDF/Excel exports.
 */
import type { DatabaseShape } from "../types";
import { startOfDay, addDays, now } from "../db";

export interface DateRange { from: number; to: number; }

export interface ReportRow {
  studentId: string;
  studentName: string;
  grade: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  rate: number; // 0-100
}

export interface TeacherReportRow {
  teacherId: string;
  teacherName: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
}

export interface AttendanceReport {
  range: DateRange;
  totalScans: number;
  uniqueStudents: number;
  avgRate: number;
  students: ReportRow[];
  teachers: TeacherReportRow[];
  byDay: { date: number; present: number; late: number; absent: number }[];
}

/** Build a full attendance report for a date range. */
export function buildReport(db: DatabaseShape, range: DateRange): AttendanceReport {
  const recs = db.attendance.filter((a) => a.date >= range.from && a.date <= range.to);

  // ---- per-student ----
  const byStudent = new Map<string, { present: number; late: number; absent: number; excused: number }>();
  for (const r of recs) {
    let s = byStudent.get(r.studentId);
    if (!s) { s = { present: 0, late: 0, absent: 0, excused: 0 }; byStudent.set(r.studentId, s); }
    if (r.status === "PRESENT") s.present++;
    else if (r.status === "LATE") s.late++;
    else if (r.status === "ABSENT") s.absent++;
    else if (r.status === "EXCUSED") s.excused++;
  }

  const students: ReportRow[] = db.students.map((st) => {
    const s = byStudent.get(st.id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    const total = s.present + s.late + s.absent + s.excused;
    const rate = total ? Math.round(((s.present + s.late) / total) * 100) : 0;
    return { studentId: st.id, studentName: st.name, grade: st.grade, present: s.present, late: s.late, absent: s.absent, excused: s.excused, total, rate };
  }).filter((r) => r.total > 0).sort((a, b) => b.rate - a.rate);

  // ---- per-teacher ----
  const byTeacher = new Map<string, { present: number; late: number; absent: number }>();
  for (const r of recs) {
    const group = db.groups.find((g) => g.id === r.groupId);
    const tid = group?.teacherId;
    if (!tid) continue;
    let t = byTeacher.get(tid);
    if (!t) { t = { present: 0, late: 0, absent: 0 }; byTeacher.set(tid, t); }
    if (r.status === "PRESENT") t.present++;
    else if (r.status === "LATE") t.late++;
    else if (r.status === "ABSENT") t.absent++;
  }
  const teachers: TeacherReportRow[] = Array.from(byTeacher.entries()).map(([tid, t]) => {
    const teacher = db.teachers.find((x) => x.id === tid);
    const total = t.present + t.late + t.absent;
    return { teacherId: tid, teacherName: teacher?.name ?? "—", present: t.present, late: t.late, absent: t.absent, total, rate: total ? Math.round(((t.present + t.late) / total) * 100) : 0 };
  }).sort((a, b) => b.total - a.total);

  // ---- by day ----
  const byDay = new Map<number, { present: number; late: number; absent: number }>();
  for (const r of recs) {
    let d = byDay.get(r.date);
    if (!d) { d = { present: 0, late: 0, absent: 0 }; byDay.set(r.date, d); }
    if (r.status === "PRESENT") d.present++;
    else if (r.status === "LATE") d.late++;
    else if (r.status === "ABSENT") d.absent++;
  }
  const days = Array.from(byDay.entries()).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date - b.date);

  const totalScans = recs.length;
  const avgRate = students.length ? Math.round(students.reduce((s, r) => s + r.rate, 0) / students.length) : 0;

  return { range, totalScans, uniqueStudents: students.length, avgRate, students, teachers, byDay: days };
}

/** Pre-built range presets. */
export function rangeToday(): DateRange { const d = startOfDay(now()); return { from: d, to: d }; }
export function rangeWeek(): DateRange { const d = startOfDay(now()); return { from: addDays(d, -6), to: d }; }
export function rangeMonth(): DateRange { const d = startOfDay(now()); return { from: addDays(d, -29), to: d }; }

/** Export a report as CSV (opens in Excel). */
export function exportReportCsv(report: AttendanceReport): void {
  const headers = ["Student ID", "Name", "Grade", "Present", "Late", "Absent", "Excused", "Total", "Rate %"];
  const rows = report.students.map((r) => [r.studentId, r.studentName, r.grade, r.present, r.late, r.absent, r.excused, r.total, r.rate]);
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
