/**
 * Smart Attendance — Core domain types
 * ====================================
 * Shared types for the enterprise attendance engine. Kept dependency-free so
 * every layer (HAL, business, data) can import it without circular deps.
 */
import type { AttendanceStatus } from "../types";

/** Outcome of a single scan / capture attempt. */
export type CaptureOutcome =
  | { ok: true; record: CaptureResult }
  | { ok: false; error: CaptureError };

/** A successful capture's summary (shown in the confirmation UI). */
export interface CaptureResult {
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  teacherName: string;
  subject: string;
  classroom: string;
  /** "PRESENT" or "LATE" (auto-derived from the session's start time). */
  status: AttendanceStatus;
  /** Arrival time (epoch ms). */
  arrivedAt: number;
  /** Whether this exact scan was already recorded today for this session. */
  alreadyCheckedIn: boolean;
}

/** Structured, translatable error reasons from the validation engine. */
export type CaptureErrorReason =
  | "unknown_student"
  | "invalid_token"
  | "no_active_session"
  | "duplicate_scan"
  | "suspended_student"
  | "branch_mismatch"
  | "outside_window"
  | "not_in_group"
  | "unpaid_blocked"
  | "device_error";

export interface CaptureError {
  reason: CaptureErrorReason;
  /** Human-readable message (already localized). */
  message: string;
  /** Raw scanned payload (for the log). */
  raw: string;
}

/** The hardware input source that produced a scan. */
export type InputSource = "wedge" | "camera" | "serial" | "nfc" | "manual";

/** A decoded scan event emitted by the Hardware Abstraction Layer. */
export interface ScanEvent {
  payload: string;
  source: InputSource;
  at: number;
}

/** Attendance system settings (stored on the center profile / localStorage). */
export interface AttendanceSettings {
  /** Minutes a student may arrive before the session start and still be PRESENT. */
  earlyGraceMin: number;
  /** Minutes after start that still count as PRESENT (beyond → LATE). */
  lateThresholdMin: number;
  /** Minutes after the session end before attendance is refused. */
  lateCutoffMin: number;
  /** Block students with unpaid fees from checking in. */
  blockUnpaid: boolean;
  /** Play sounds on capture outcomes. */
  soundEnabled: boolean;
  /** Require an active branch match (multi-branch isolation). */
  enforceBranch: boolean;
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  earlyGraceMin: 10,
  lateThresholdMin: 15,
  lateCutoffMin: 30,
  blockUnpaid: false,
  soundEnabled: true,
  enforceBranch: true,
};
