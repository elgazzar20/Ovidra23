/**
 * Attendance settings store — persisted in localStorage, scoped per center.
 */
import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceSettings } from "./types";

const KEY = (centerId: string) => `cpd_att_settings_${centerId}`;

export function loadAttendanceSettings(centerId: string): AttendanceSettings {
  try {
    const raw = localStorage.getItem(KEY(centerId));
    if (!raw) return { ...DEFAULT_ATTENDANCE_SETTINGS };
    return { ...DEFAULT_ATTENDANCE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ATTENDANCE_SETTINGS };
  }
}

export function saveAttendanceSettings(centerId: string, s: AttendanceSettings): void {
  try { localStorage.setItem(KEY(centerId), JSON.stringify(s)); } catch { /* ignore */ }
}
