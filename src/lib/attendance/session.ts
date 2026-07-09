/**
 * Smart Session Detection
 * =======================
 * Given a student and the current time, resolves the *single* active class they
 * should be checked into — without ever asking the operator to pick a group or
 * teacher. Resolution is driven by the weekly schedule (ScheduleEvent) and the
 * groups the student belongs to.
 */
import type { DatabaseShape, ScheduleEvent, Student, Group, Teacher } from "../types";
import { dayOfWeekOf, startOfDay, now } from "../db";
import type { AttendanceSettings } from "./types";

export interface ResolvedSession {
  event: ScheduleEvent;
  group: Group;
  teacher?: Teacher;
  /** "before" | "active" | "after" relative to the grace windows. */
  phase: "before" | "active" | "after";
  /** Minutes from the session start (negative = early). */
  minutesFromStart: number;
}

/** Convert an "HH:mm" string to minutes-since-midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Resolve the best-matching active session for a student right now.
 * Returns null when the student has no scheduled class within the allowed
 * window (early grace … late cutoff).
 */
export function resolveCurrentSession(
  db: DatabaseShape,
  student: Student,
  ref: number = now(),
  settings: AttendanceSettings,
): ResolvedSession | null {
  const today = dayOfWeekOf(startOfDay(ref)); // 1..7 (Mon..Sun)
  const nowMin = new Date(ref).getHours() * 60 + new Date(ref).getMinutes();

  // All schedule events for the student's groups that meet today.
  const candidates = db.scheduleEvents.filter((ev) => {
    if (ev.dayOfWeek !== today) return false;
    return student.groupIds.includes(ev.groupId);
  });

  let best: ResolvedSession | null = null;
  let bestDistance = Infinity;

  for (const ev of candidates) {
    const group = db.groups.find((g) => g.id === ev.groupId);
    if (!group) continue;
    const teacher = group.teacherId ? db.teachers.find((t) => t.id === group.teacherId) : undefined;

    const startMin = timeToMinutes(ev.startTime);
    const endMin = timeToMinutes(ev.endTime);
    const distFromStart = nowMin - startMin;

    // Determine phase relative to the grace windows.
    let phase: ResolvedSession["phase"];
    if (distFromStart < -settings.earlyGraceMin) phase = "before"; // too early
    else if (distFromStart > endMin - startMin + settings.lateCutoffMin) phase = "after"; // session over
    else phase = "active";

    if (phase === "before" || phase === "after") continue; // outside allowed window

    // Prefer the session whose start is closest to now.
    const distance = Math.abs(distFromStart);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { event: ev, group, teacher, phase, minutesFromStart: distFromStart };
    }
  }

  return best;
}

/**
 * List all sessions the student has today (used by the UI to show "next class").
 */
export function todaysSessions(db: DatabaseShape, student: Student, ref: number = now()) {
  const today = dayOfWeekOf(startOfDay(ref));
  return db.scheduleEvents
    .filter((ev) => ev.dayOfWeek === today && student.groupIds.includes(ev.groupId))
    .map((ev) => {
      const group = db.groups.find((g) => g.id === ev.groupId);
      const teacher = group?.teacherId ? db.teachers.find((t) => t.id === group.teacherId) : undefined;
      return { event: ev, group, teacher };
    })
    .sort((a, b) => a.event.startTime.localeCompare(b.event.startTime));
}
