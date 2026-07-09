import type {
  DatabaseShape,
  Student,
  Teacher,
  Exam,
  AttendanceStatus,
  Payment,
  Group,
} from "./types";
import { monthKey, startOfDay, addDays, now } from "./db";
import { currencySymbolOf } from "./constants";

/** Mirrors Kotlin's coerceAtLeast(0f) — never let a chart dimension go negative. */
export const clampNonNegative = (n: number) => Math.max(0, n);

/* ------------------------------- students ------------------------------- */
export function studentInGroup(s: Student, groupId: string): boolean {
  return s.groupIds?.includes(groupId) ?? false;
}

/** Sum of all teacher fees, minus the discount. */
export function studentNetFee(s: Student): number {
  if (s.isExempt) return 0;
  const total = (s.teachers ?? []).reduce((sum, t) => sum + (t.fee || 0), 0);
  return Math.max(0, total - (s.discount || 0));
}

export function studentTeacherIds(s: Student): string[] {
  return (s.teachers ?? []).map((t) => t.teacherId);
}

export function monthsSince(ts: number, ref = now()): number {
  const diff = Math.max(0, ref - ts);
  return Math.max(1, Math.round(diff / (30 * 86_400_000)));
}

/* --------------------- monthly billing (advance / deferred) -------------------- */
/** Shift a "yyyy-MM" month key by `delta` months (delta may be negative). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Compare two "yyyy-MM" keys: -1 (a<b), 0 (equal), 1 (a>b). */
export function cmpMonth(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The ordered list of calendar months a student is responsible for paying,
 * from the registration month up to today:
 *  - advance  (مقدم): liable through the CURRENT month (pay at the start).
 *  - deferred (مؤخر): liable through the PREVIOUS month (pay at month end).
 */
export function liableMonthsFor(student: Student, ref = now()): string[] {
  if (student.isExempt || studentNetFee(student) <= 0) return [];
  const cur = monthKey(ref);
  const start = monthKey(student.registrationDate);
  const end = student.paymentType === "deferred" ? shiftMonth(cur, -1) : cur;
  if (cmpMonth(start, end) > 0) return []; // registered "ahead" of the due window
  const out: string[] = [];
  let m = start;
  let guard = 0;
  while (cmpMonth(m, end) <= 0 && guard < 600) {
    out.push(m);
    m = shiftMonth(m, 1);
    guard++;
  }
  return out;
}

/** Total MONTHLY_FEE payments recorded for a student in a given month. */
export function monthPaidAmount(db: DatabaseShape, studentId: string, month: string): number {
  return (db.payments ?? [])
    .filter((p) => p.studentId === studentId && p.month === month && p.type === "MONTHLY_FEE")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

/** Whether a student has fully covered the net fee for a given month. */
export function isMonthPaid(db: DatabaseShape, student: Student, month: string): boolean {
  const net = studentNetFee(student);
  if (net <= 0) return true;
  return monthPaidAmount(db, student.id, month) >= net;
}

/** Months the student is liable for since registration (count). */
export function liabilityMonths(student: Student): number {
  return liableMonthsFor(student).length;
}

export function totalPaidFor(db: DatabaseShape, studentId: string): number {
  return db.payments
    .filter((p) => p.studentId === studentId)
    .reduce((sum, p) => sum + p.amount, 0);
}

/** Amount paid allocated to a specific teacher for a student. */
export function paidForTeacher(
  db: DatabaseShape,
  studentId: string,
  teacherId: string,
): number {
  return db.payments
    .filter((p) => p.studentId === studentId && p.teacherId === teacherId)
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Outstanding balance = (liable months × net monthly fee) − monthly payments
 * already recorded against those months. Honours advance/deferred billing so a
 * freshly-registered student correctly shows their fee as due (not zero).
 */
export function balanceDue(db: DatabaseShape, student: Student): number {
  if (student.isExempt) return 0;
  const net = studentNetFee(student);
  if (net <= 0) return 0;
  const months = liableMonthsFor(student);
  if (months.length === 0) return 0;
  let paid = 0;
  for (const m of months) paid += Math.min(net, monthPaidAmount(db, student.id, m));
  return Math.max(0, months.length * net - paid);
}

export interface PaymentStatus {
  status: "paid" | "unpaid" | "overdue";
  monthsLate: number;
  currentMonth: string;
  warningDay7: boolean;
}

/**
 * Monthly payment status driven by advance/deferred billing:
 *  - exempt / no fee → "paid".
 *  - all liable months covered → "paid" (updates the moment a payment lands).
 *  - the most-recent liable month unpaid but no older gap → "unpaid"
 *    (advance students get a `warningDay7` flag once the month reaches day 7).
 *  - one or more fully-elapsed months unpaid → "overdue" with monthsLate count.
 */
export function studentPaymentStatus(db: DatabaseShape, student: Student): PaymentStatus {
  const cur = monthKey(now());
  const net = studentNetFee(student);
  if (student.isExempt || net <= 0)
    return { status: "paid", monthsLate: 0, currentMonth: cur, warningDay7: false };

  const months = liableMonthsFor(student); // ascending
  if (months.length === 0)
    return { status: "paid", monthsLate: 0, currentMonth: cur, warningDay7: false };

  const unpaid = months.filter((m) => !isMonthPaid(db, student, m));
  if (unpaid.length === 0)
    return { status: "paid", monthsLate: 0, currentMonth: cur, warningDay7: false };

  // The most recent liable month is the one being collected in the current
  // billing cycle — it is "unpaid" but not yet "late". Every unpaid month
  // strictly before it counts toward monthsLate (i.e. months that have passed).
  const last = months[months.length - 1];
  const monthsLate = unpaid.filter((m) => m !== last).length;

  const isAdvance = student.paymentType !== "deferred";
  const currentUnpaid = unpaid.includes(last);
  const warningDay7 = isAdvance && currentUnpaid && new Date().getDate() >= 7;

  return {
    status: monthsLate > 0 ? "overdue" : "unpaid",
    monthsLate,
    currentMonth: cur,
    warningDay7,
  };
}

/* -------------------------------- finance ------------------------------- */

export function totalRevenue(db: DatabaseShape): number {
  return db.payments
    .filter((p) => p.notes !== "__payout__")
    .reduce((s, p) => s + p.amount, 0);
}

export function totalExpenses(db: DatabaseShape): number {
  return db.expenses.reduce((s, e) => s + e.amount, 0);
}

export function totalCenterIncome(db: DatabaseShape): number {
  return db.payments
    .filter((p) => p.notes !== "__payout__")
    .reduce((sum, p) => {
      if (p.forCenter || !p.teacherId) return sum + p.amount;
      const t = db.teachers.find((x) => x.id === p.teacherId);
      if (!t) return sum + p.amount;
      return sum + centerShareOf(t, p.amount);
    }, 0);
}

export function monthlyRevenue(db: DatabaseShape, ref = now()): number {
  const key = monthKey(ref);
  return db.payments
    .filter((p) => p.month === key && p.notes !== "__payout__")
    .reduce((s, p) => s + p.amount, 0);
}

export function monthlyExpenses(db: DatabaseShape, ref = now()): number {
  const key = monthKey(ref);
  return db.expenses
    .filter((e) => monthKey(e.date) === key)
    .reduce((s, e) => s + e.amount, 0);
}

/** Center income = teacher commission/fees + center subscription payments. */
export function monthlyCenterIncome(db: DatabaseShape, ref = now()): number {
  const key = monthKey(ref);
  return db.payments
    .filter((p) => p.month === key && p.notes !== "__payout__")
    .reduce((sum, p) => {
      if (p.forCenter || !p.teacherId) return sum + p.amount;
      const t = db.teachers.find((x) => x.id === p.teacherId);
      if (!t) return sum + p.amount;
      return sum + centerShareOf(t, p.amount);
    }, 0);
}

export interface MonthPoint {
  month: string;
  revenue: number;
  expenses: number;
  centerIncome: number;
}

export function monthlySeries(db: DatabaseShape, count = 6): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const ref = addDays(startOfDay(now()), -i * 30);
    const key = monthKey(ref);
    const rev = db.payments
      .filter((p) => p.month === key && p.notes !== "__payout__")
      .reduce((s, p) => s + p.amount, 0);
    const exp = db.expenses
      .filter((e) => monthKey(e.date) === key)
      .reduce((s, e) => s + e.amount, 0);
    const centerIncome = monthlyCenterIncome(db, ref);
    points.push({ month: key, revenue: rev, expenses: exp, centerIncome });
  }
  return points;
}

/* -------------------------------- teachers ------------------------------ */
/** Total fees collected on behalf of a teacher (across all students). */
export function teacherRevenue(db: DatabaseShape, teacherId: string): number {
  return db.payments
    .filter((p) => p.teacherId === teacherId && p.notes !== "__payout__")
    .reduce((s, p) => s + p.amount, 0);
}

export function teacherRevenueThisMonth(
  db: DatabaseShape,
  teacherId: string,
  ref = now(),
): number {
  const key = monthKey(ref);
  return db.payments
    .filter((p) => p.teacherId === teacherId && p.month === key && p.notes !== "__payout__")
    .reduce((s, p) => s + p.amount, 0);
}

/** How much the center earns from a single payment of `amount`. */
export function centerShareOf(teacher: Teacher, amount: number): number {
  if (teacher.payType === "fixed") return Math.min(amount, teacher.fixedAmount);
  return (amount * (teacher.commissionRate || 0)) / 100;
}

export function teacherCenterShare(db: DatabaseShape, teacher: Teacher): number {
  const rev = teacherRevenue(db, teacher.id);
  if (teacher.payType === "fixed") return teacher.fixedAmount;
  return (rev * (teacher.commissionRate || 0)) / 100;
}

export function teacherNet(db: DatabaseShape, teacher: Teacher): number {
  const rev = teacherRevenue(db, teacher.id);
  return rev - teacherCenterShare(db, teacher);
}

export function studentsOfTeacher(db: DatabaseShape, teacherId: string): Student[] {
  return db.students.filter((s) => studentTeacherIds(s).includes(teacherId));
}

export function groupsOfTeacher(db: DatabaseShape, teacherId: string) {
  return db.groups.filter((g) => g.teacherId === teacherId);
}

/* ------------------------------ attendance ------------------------------ */
const PRESENT_LIKE: AttendanceStatus[] = ["PRESENT", "LATE"];

export type SessionStatus = AttendanceStatus | "UNMARKED";

export interface MonthSession {
  date: number;
  status: SessionStatus;
}

export interface MonthAttendance {
  month: string; // "yyyy-MM"
  expected: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
  /** attendance rate based only on recorded sessions */
  rate: number;
  sessions: MonthSession[];
}

/**
 * Computes a student's attendance for a given month, driven by the meeting
 * days of their groups. A student is NEVER counted absent on a day their
 * group doesn't meet.
 *
 * Auto-absent rule: if a meeting day has fully elapsed (it is before today)
 * and no attendance was recorded for it, the student is treated as ABSENT
 * that day. Only the current/future meeting days stay UNMARKED until recorded.
 *
 * Pass `groupId` to scope the calculation to a single group (per-group view).
 */
export function studentMonthAttendance(
  db: DatabaseShape,
  studentId: string,
  month: string,
  groupId?: string,
): MonthAttendance {
  const student = db.students.find((s) => s.id === studentId);
  const today = startOfDay(now());

  const groups = (student?.groupIds ?? [])
    .map((id) => db.groups.find((g) => g.id === id))
    .filter(Boolean) as Group[];
  const scope = groupId ? groups.filter((g) => g.id === groupId) : groups;

  // union of meeting days across the scoped groups
  const daySet = new Set<number>();
  for (const g of scope) for (const d of g.days ?? []) daySet.add(d);

  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const toDow = (ts: number) => {
    const js = new Date(ts).getDay(); // 0=Sun
    return js === 0 ? 7 : js;
  };

  // expected dates (meeting days in the month)
  const expectedDates: number[] = [];
  if (daySet.size > 0) {
    for (let d = 1; d <= daysInMonth; d++) {
      const ts = startOfDay(new Date(yy, mm - 1, d).getTime());
      if (daySet.has(toDow(ts))) expectedDates.push(ts);
    }
  }

  // student's records for that month (optionally scoped to a group), keyed by date
  const records = db.attendance.filter(
    (a) => a.studentId === studentId && monthKey(a.date) === month && (!groupId || a.groupId === groupId),
  );
  const byDate = new Map<number, AttendanceStatus>();
  for (const r of records) byDate.set(r.date, r.status);

  // if no meeting days are defined, fall back to the actual record dates
  if (expectedDates.length === 0) {
    const set = new Set(records.map((r) => r.date));
    for (const ts of set) expectedDates.push(ts);
    expectedDates.sort((a, b) => a - b);
  }

  let present = 0, late = 0, absent = 0, excused = 0, unmarked = 0;
  const sessions: MonthSession[] = expectedDates.map((date) => {
    const status = byDate.get(date);
    if (!status) {
      // full day elapsed with no record → auto-absent; otherwise still pending
      if (date < today) { absent++; return { date, status: "ABSENT" }; }
      unmarked++;
      return { date, status: "UNMARKED" };
    }
    if (status === "PRESENT") present++;
    else if (status === "LATE") late++;
    else if (status === "ABSENT") absent++;
    else if (status === "EXCUSED") excused++;
    return { date, status };
  });

  // Simple, intuitive rate: present + late divided by total expected days (excluding excused sessions)
  const totalExpected = expectedDates.length;
  const totalRelevant = totalExpected - excused;
  const rate = totalRelevant > 0 ? ((present + late) / totalRelevant) * 100 : 0;

  return {
    month,
    expected: expectedDates.length,
    present, late, absent, excused, unmarked, rate,
    sessions: sessions.sort((a, b) => b.date - a.date),
  };
}

/**
 * Per-group monthly attendance breakdown for a student — returns one entry per
 * group the student belongs to, each computed independently (so a student with
 * two teachers/groups sees two attendance counts, e.g. 8 sessions/month each).
 */
export interface GroupAttendanceSummary {
  groupId: string;
  groupName: string;
  subject: string;
  teacherName: string;
  expected: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
}

export function studentGroupAttendance(
  db: DatabaseShape,
  studentId: string,
  month: string,
): GroupAttendanceSummary[] {
  const student = db.students.find((s) => s.id === studentId);
  const groups = (student?.groupIds ?? [])
    .map((id) => db.groups.find((g) => g.id === id))
    .filter(Boolean) as Group[];
  return groups.map((g) => {
    const a = studentMonthAttendance(db, studentId, month, g.id);
    const teacher = db.teachers.find((t) => t.id === g.teacherId);
    return {
      groupId: g.id,
      groupName: g.name,
      subject: subjectLabelOf(g.subject),
      teacherName: teacher?.name ?? "—",
      expected: a.expected,
      present: a.present,
      absent: a.absent,
      late: a.late,
      excused: a.excused,
      rate: Math.round(a.rate),
    };
  });
}

function subjectLabelOf(subject: string): string {
  return subject;
}

export function attendanceRate(
  db: DatabaseShape,
  opts: { groupId?: string; days?: number } = {},
): number {
  const { groupId, days } = opts;
  let records = db.attendance;
  if (groupId) records = records.filter((r) => r.groupId === groupId);
  if (days) {
    const cutoff = startOfDay(addDays(now(), -days));
    records = records.filter((r) => r.date >= cutoff);
  }
  if (records.length === 0) return 0;
  const present = records.filter((r) => PRESENT_LIKE.includes(r.status)).length;
  return (present / records.length) * 100;
}

export interface DayTrend {
  label: string;
  rate: number;
}

export function attendanceTrend(db: DatabaseShape, days = 14): DayTrend[] {
  const out: DayTrend[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(addDays(now(), -i));
    const recs = db.attendance.filter((r) => r.date === day);
    const present = recs.filter((r) => PRESENT_LIKE.includes(r.status)).length;
    const rate = recs.length ? (present / recs.length) * 100 : 0;
    const d = new Date(day);
    out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, rate });
  }
  return out;
}

/* -------------------------------- grades -------------------------------- */
export interface GradeBucket {
  label: string;
  count: number;
}

export function gradeDistribution(db: DatabaseShape): GradeBucket[] {
  const buckets = [
    { label: "<50%", min: 0, max: 0.5, count: 0 },
    { label: "50-65%", min: 0.5, max: 0.65, count: 0 },
    { label: "65-80%", min: 0.65, max: 0.8, count: 0 },
    { label: "80-90%", min: 0.8, max: 0.9, count: 0 },
    { label: "90%+", min: 0.9, max: 1.01, count: 0 },
  ];
  for (const g of db.examGrades) {
    const exam = db.exams.find((e) => e.id === g.examId);
    if (!exam || exam.maxGrade <= 0) continue;
    const ratio = g.obtainedGrade / exam.maxGrade;
    const b = buckets.find((b) => ratio >= b.min && ratio < b.max);
    if (b) b.count++;
  }
  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

export function studentAverage(db: DatabaseShape, studentId: string): number | null {
  const grades = db.examGrades.filter((g) => g.studentId === studentId);
  if (!grades.length) return null;
  let sumRatio = 0;
  let counted = 0;
  for (const g of grades) {
    const exam = db.exams.find((e) => e.id === g.examId);
    if (!exam || exam.maxGrade <= 0) continue;
    sumRatio += g.obtainedGrade / exam.maxGrade;
    counted++;
  }
  return counted ? (sumRatio / counted) * 100 : null;
}

export function examAverage(db: DatabaseShape, exam: Exam): number | null {
  const grades = db.examGrades.filter((g) => g.examId === exam.id);
  if (!grades.length || exam.maxGrade <= 0) return null;
  const sum = grades.reduce((s, g) => s + g.obtainedGrade / exam.maxGrade, 0);
  return (sum / grades.length) * 100;
}

/* ------------------------------- currency ------------------------------- */
export function currencySymbol(db: DatabaseShape): string {
  return currencySymbolOf(db.profile.currency);
}

export function formatMoney(amount: number, symbol = "$"): string {
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

/** Human label for a payment (teacher or center subscription). */
export function paymentTarget(db: DatabaseShape, p: Payment): string {
  if (p.forCenter || !p.teacherId) return "Center";
  return db.teachers.find((t) => t.id === p.teacherId)?.name ?? "Center";
}
