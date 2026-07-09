/**
 * Smart Attendance — Public API barrel
 * ===================================
 * Single import point for the attendance engine. Consumers depend on this
 * facade, not on internal module paths — keeping the architecture decoupled.
 */
export type {
  AttendanceSettings, CaptureOutcome, CaptureResult, CaptureError,
  CaptureErrorReason, InputSource, ScanEvent,
} from "./types";
export { DEFAULT_ATTENDANCE_SETTINGS } from "./types";

export { hardware } from "./hal";
export { sound } from "./sound";
export { signStudentToken, legacyToken, verifyToken } from "./crypto";
export { createAttendanceService, lookupStudentByPayload } from "./service";
export type { AttendanceService, AttendanceDeps } from "./service";
export {
  resolveCurrentSession, todaysSessions, timeToMinutes,
} from "./session";
export type { ResolvedSession } from "./session";
export { validateCapture } from "./validation";
export {
  buildReport, rangeToday, rangeWeek, rangeMonth, exportReportCsv,
} from "./reports";
export type { AttendanceReport, ReportRow, TeacherReportRow, DateRange } from "./reports";
export { loadAttendanceSettings, saveAttendanceSettings } from "./settings";
