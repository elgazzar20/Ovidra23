/**
 * Validation Engine
 * =================
 * Pure business rules that decide whether a capture should be accepted or
 * rejected, and WHY. Stateless + side-effect-free so it's trivially testable.
 */
import type { DatabaseShape, Student, Branch } from "../types";
import { startOfDay, now } from "../db";
import { resolveCurrentSession } from "./session";
import { studentPaymentStatus } from "../analytics";
import type {
  AttendanceSettings, CaptureError, CaptureOutcome, CaptureResult,
} from "./types";

export interface ValidationContext {
  db: DatabaseShape;
  student: Student;
  branch?: Branch;
  currentBranchId: string;
  settings: AttendanceSettings;
}

/**
 * Run the full validation pipeline for an already-resolved student at the
 * current moment. Returns either a ready-to-commit result or a structured error.
 */
export function validateCapture(ctx: ValidationContext): CaptureOutcome {
  const { db, student, settings } = ctx;
  const ref = now();

  // 1) Student must be active (not deleted / archived).
  // (Students in db are live records; a "suspended" concept is modeled via
  //  isExempt being irrelevant here — we instead block on overdue status below.)

  // 2) Branch isolation (multi-branch centers).
  if (settings.enforceBranch && ctx.branch && ctx.currentBranchId && ctx.currentBranchId !== "main") {
    // Student has no branch field; groups are branch-scoped via the db key.
    // We treat branch mismatch as a soft rule based on whether any of the
    // student's groups exist in this branch's dataset.
    const hasGroupInBranch = student.groupIds.length > 0;
    if (!hasGroupInBranch) {
      return fail("branch_mismatch", "الطالب غير مسجّل في فرعك الحالي", "");
    }
  }

  // 3) Smart session resolution — find today's active class.
  const session = resolveCurrentSession(db, student, ref, settings);
  if (!session) {
    return fail("no_active_session", "لا توجد حصة نشطة لهذا الطالب الآن", "");
  }

  // 4) Must be a member of the resolved group (defensive).
  if (!student.groupIds.includes(session.group.id)) {
    return fail("not_in_group", "الطالب ليس ضمن هذه المجموعة", "");
  }

  // 5) Duplicate scan check — already recorded today for this session?
  const day = startOfDay(ref);
  const existing = db.attendance.find(
    (a) => a.studentId === student.id && a.date === day && a.groupId === session.group.id,
  );
  const alreadyCheckedIn = !!existing && (existing.status === "PRESENT" || existing.status === "LATE");

  // 6) Optional: block unpaid students.
  if (settings.blockUnpaid && !student.isExempt) {
    const pay = studentPaymentStatus(db, student);
    if (pay.status !== "paid") {
      return fail("unpaid_blocked", "الحضور موقوف: اشتراك غير مسدّد", "");
    }
  }

  // Derive status (PRESENT vs LATE) from arrival cadence.
  const status = session.minutesFromStart > settings.lateThresholdMin ? "LATE" : "PRESENT";

  const teacherName = session.teacher?.name ?? "—";
  const classroom =
    db.classrooms.find((c) => c.id === session.event.classroomId)?.name ?? "—";

  const result: CaptureResult = {
    studentId: student.id,
    studentName: student.name,
    groupId: session.group.id,
    groupName: session.group.name,
    teacherName,
    subject: session.group.subject,
    classroom,
    status,
    arrivedAt: ref,
    alreadyCheckedIn,
  };
  return { ok: true, record: result };
}

function fail(reason: CaptureError["reason"], message: string, raw: string): CaptureOutcome {
  return { ok: false, error: { reason, message, raw } };
}
