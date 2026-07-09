import type { DatabaseShape, ScheduleEvent } from "./types";

export const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Do two events collide in the same classroom on the same day? */
export function overlaps(a: ScheduleEvent, b: ScheduleEvent): boolean {
  if (a.classroomId !== b.classroomId || a.dayOfWeek !== b.dayOfWeek) return false;
  return toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime);
}

export interface ConflictInfo {
  withGroup?: string;
  withRoom?: string;
  locked?: boolean;
}

/** Find the first conflicting event for `ev` across the whole center. */
export function findConflict(
  db: DatabaseShape,
  ev: ScheduleEvent,
  ignoreId?: string,
): ConflictInfo | null {
  for (const e of db.scheduleEvents) {
    if (e.id === ignoreId || e.id === ev.id) continue;
    if (overlaps(e, ev)) {
      const g = db.groups.find((x) => x.id === e.groupId);
      const r = db.classrooms.find((c) => c.id === e.classroomId);
      return { withGroup: g?.name, withRoom: r?.name, locked: e.locked };
    }
  }
  return null;
}
