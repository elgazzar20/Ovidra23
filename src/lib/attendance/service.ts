/**
 * Attendance Service
 * ==================
 * The orchestration layer. Wires the Hardware Abstraction Layer to the crypto,
 * validation, persistence and sound subsystems. The single entry point the UI
 * uses for the entire capture flow.
 *
 * End-to-end latency target: < 1 second per scan.
 */
import { hardware } from "./hal";
import { verifyToken } from "./crypto";
import { validateCapture } from "./validation";
import { sound } from "./sound";
import type { DatabaseShape, Student } from "../types";
import { startOfDay, now } from "../db";
import type {
  AttendanceSettings, CaptureError, CaptureOutcome, ScanEvent, InputSource,
} from "./types";
import { DEFAULT_ATTENDANCE_SETTINGS } from "./types";

export interface AttendanceDeps {
  getDb: () => DatabaseShape;
  getCurrentBranchId: () => string;
  upsertAttendance: (rec: {
    id: string; studentId: string; groupId: string; date: number;
    status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED"; notes?: string;
    tempDegree?: number; lastUpdated: number;
  }) => void;
  /** Persist an audit log entry for security forensics. */
  logCapture?: (entry: { at: number; studentId?: string; source: InputSource; ok: boolean; reason?: string; payload: string }) => void;
  settings?: AttendanceSettings;
}

/**
 * Build the high-level capture pipeline. Returns `processScan` (the pure core)
 * plus start/stop helpers for the hardware listener.
 */
export function createAttendanceService(deps: AttendanceDeps) {
  const settings = deps.settings ?? DEFAULT_ATTENDANCE_SETTINGS;
  sound.setEnabled(settings.soundEnabled);

  /** Core: take a raw payload + source, return a capture outcome, and persist. */
  async function processScan(payload: string, source: InputSource): Promise<CaptureOutcome> {
    const db = deps.getDb();
    const at = now();

    // 1) Verify + decode the signed token (anti-forgery).
    const token = await verifyToken(payload);
    if (!token) {
      const err: CaptureError = { reason: "invalid_token", message: "رمز غير صالح", raw: payload };
      deps.logCapture?.({ at, source, ok: false, reason: err.reason, payload });
      return { ok: false, error: err };
    }
    if (token.signed && !token.valid) {
      const err: CaptureError = { reason: "invalid_token", message: "رمز مزوّر أو منتهي", raw: payload };
      deps.logCapture?.({ at, source, ok: false, reason: err.reason, payload });
      return { ok: false, error: err };
    }

    // 2) Look up the student.
    const student = db.students.find(
      (s) => s.id === token.studentId || s.qrCode === payload,
    );
    if (!student) {
      const err: CaptureError = { reason: "unknown_student", message: "طالب غير مسجّل", raw: payload };
      deps.logCapture?.({ at, source, ok: false, reason: err.reason, payload });
      return { ok: false, error: err };
    }

    // 3) Validate business rules + resolve the current session.
    const outcome = validateCapture({
      db,
      student,
      currentBranchId: deps.getCurrentBranchId(),
      settings,
    });
    if (!outcome.ok) {
      deps.logCapture?.({ at, studentId: student.id, source, ok: false, reason: outcome.error.reason, payload });
      return outcome;
    }

    // 4) Persist (idempotent — same id overwrites the same record, no dupes).
    const day = startOfDay(at);
    deps.upsertAttendance({
      id: `${student.id}_${day}_${outcome.record.groupId}`,
      studentId: student.id,
      groupId: outcome.record.groupId,
      date: day,
      status: outcome.record.status,
      lastUpdated: at,
    });

    deps.logCapture?.({ at, studentId: student.id, source, ok: true, payload });

    // 5) Sound feedback.
    if (outcome.record.alreadyCheckedIn) sound.playFor("info");
    else sound.playFor("ok");

    return outcome;
  }

  /** Start listening to hardware and route scans to the processor. */
  function start(onResult: (o: CaptureOutcome, e: ScanEvent) => void): () => void {
    void hardware.start();
    const off = hardware.onScan(async (evt) => {
      const outcome = await processScan(evt.payload, evt.source);
      onResult(outcome, evt);
    });
    return () => { off(); hardware.stop(); };
  }

  /** Process a manual / camera / NFC payload (non-wedge entry). */
  async function capture(payload: string, source: InputSource): Promise<CaptureOutcome> {
    return processScan(payload, source);
  }

  return { processScan, capture, start };
}

export type AttendanceService = ReturnType<typeof createAttendanceService>;

/** A lookup helper for the UI: find a student preview by a scanned payload. */
export async function lookupStudentByPayload(db: DatabaseShape, payload: string): Promise<Student | null> {
  const token = await verifyToken(payload);
  if (!token) return null;
  return db.students.find((s) => s.id === token.studentId || s.qrCode === payload) ?? null;
}
