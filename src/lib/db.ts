import type {
  DatabaseShape,
  Student,
  Teacher,
  Group,
  Classroom,
  ScheduleEvent,
  AttendanceRecord,
  AttendanceStatus,
  Payment,
  Expense,
  Exam,
  ExamGrade,
  CenterProfile,
  DayOfWeek,
  } from "./types";
import { DEFAULT_CURRENCY, GRADES } from "./constants";

/* ----------------------------- date helpers ----------------------------- */
export const now = () => {
  try {
    const saved = localStorage.getItem("center_simulated_time_offset");
    const offset = saved ? parseInt(saved, 10) : 0;
    return Date.now() + offset;
  } catch {
    return Date.now();
  }
};
export const startOfDay = (d: Date | number) => {
  const date = typeof d === "number" ? new Date(d) : d;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
export const addDays = (ts: number, days: number) => ts + days * 86_400_000;
export const monthKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const dayOfWeekOf = (ts: number): DayOfWeek => {
  const js = new Date(ts).getDay();
  return (js === 0 ? 7 : js) as DayOfWeek;
};

/* ------------------------------- id helpers ------------------------------ */
let counter = 0;
export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

export function nextStudentCode(students: Student[]): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const existingIds = new Set(students.map((s) => s.id.toUpperCase()));
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.has(code));
  return code;
}

export function nextTeacherCode(teachers: Teacher[]): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const existingIds = new Set(teachers.map((t) => t.id.toUpperCase()));
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.has(code));
  return code;
}

/* --------------------------- persistence layer --------------------------- */
const DB_PREFIX = "cpd_db_";

export function migrateOldIds(db: DatabaseShape): DatabaseShape {
  let changed = false;

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function generateNewCode(existing: Set<string>): string {
    let code = "";
    do {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (existing.has(code));
    return code;
  }

  // 1. Gather existing IDs to avoid collisions
  const existingStudentIds = new Set(db.students.map((s) => s.id.toUpperCase()));
  const existingTeacherIds = new Set(db.teachers.map((t) => t.id.toUpperCase()));

  // 2. Map old student IDs to new 6-character uppercase IDs
  const studentIdMap: Record<string, string> = {};
  const updatedStudents = db.students.map((student) => {
    const isOld = student.id.toUpperCase().startsWith("STU_") || student.id.length !== 6;
    if (isOld) {
      changed = true;
      let newId = generateNewCode(existingStudentIds);
      existingStudentIds.add(newId);
      studentIdMap[student.id] = newId;
      return { ...student, id: newId, qrCode: `CPD:${newId}` };
    }
    return student;
  });

  // 3. Map old teacher IDs to new 6-character uppercase IDs
  const teacherIdMap: Record<string, string> = {};
  const updatedTeachers = db.teachers.map((teacher) => {
    const isOld = teacher.id.toUpperCase().startsWith("T_") || teacher.id.toUpperCase().startsWith("TCH_") || teacher.id.length !== 6;
    if (isOld) {
      changed = true;
      let newId = generateNewCode(existingTeacherIds);
      existingTeacherIds.add(newId);
      teacherIdMap[teacher.id] = newId;
      return { ...teacher, id: newId };
    }
    return teacher;
  });

  if (!changed) {
    return db;
  }

  // Update students' teacher references
  const finalStudents = updatedStudents.map((student) => {
    let studentChanged = false;
    const teachersList = student.teachers.map((t) => {
      if (teacherIdMap[t.teacherId]) {
        studentChanged = true;
        return { ...t, teacherId: teacherIdMap[t.teacherId] };
      }
      return t;
    });
    if (studentChanged) {
      return { ...student, teachers: teachersList };
    }
    return student;
  });

  // Update group teacherId references
  const updatedGroups = db.groups.map((g) => {
    if (g.teacherId && teacherIdMap[g.teacherId]) {
      return { ...g, teacherId: teacherIdMap[g.teacherId] };
    }
    return g;
  });

  // Update attendance studentId references
  const updatedAttendance = db.attendance.map((att) => {
    if (studentIdMap[att.studentId]) {
      return { ...att, studentId: studentIdMap[att.studentId] };
    }
    return att;
  });

  // Update payments studentId & teacherId references
  const updatedPayments = db.payments.map((pay) => {
    let payChanged = false;
    let sId = pay.studentId;
    let tId = pay.teacherId;
    if (studentIdMap[pay.studentId]) {
      sId = studentIdMap[pay.studentId];
      payChanged = true;
    }
    if (pay.teacherId && teacherIdMap[pay.teacherId]) {
      tId = teacherIdMap[pay.teacherId];
      payChanged = true;
    }
    if (payChanged) {
      return { ...pay, studentId: sId, teacherId: tId };
    }
    return pay;
  });

  // Update examGrades studentId references
  const updatedExamGrades = db.examGrades.map((eg) => {
    if (studentIdMap[eg.studentId]) {
      return { ...eg, studentId: studentIdMap[eg.studentId] };
    }
    return eg;
  });

  // Update studentNotes studentId and teacherId references
  const updatedStudentNotes = db.studentNotes.map((n) => {
    let noteChanged = false;
    let sId = n.studentId;
    let tId = n.teacherId;
    if (studentIdMap[n.studentId]) {
      sId = studentIdMap[n.studentId];
      noteChanged = true;
    }
    if (n.teacherId && teacherIdMap[n.teacherId]) {
      tId = teacherIdMap[n.teacherId];
      noteChanged = true;
    }
    if (noteChanged) {
      return { ...n, studentId: sId, teacherId: tId };
    }
    return n;
  });

  return {
    ...db,
    students: finalStudents,
    teachers: updatedTeachers,
    groups: updatedGroups,
    attendance: updatedAttendance,
    payments: updatedPayments,
    examGrades: updatedExamGrades,
    studentNotes: updatedStudentNotes,
  };
}

export function persistDb(centerId: string, db: DatabaseShape) {
  try {
    localStorage.setItem(DB_PREFIX + centerId, JSON.stringify(db));
  } catch {
    /* storage full / unavailable — keep working in-memory (local-first) */
  }
}

export function loadDb(centerId: string): DatabaseShape | null {
  try {
    const raw = localStorage.getItem(DB_PREFIX + centerId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DatabaseShape;
    const migrated = migrateOldIds(parsed);
    if (migrated !== parsed) {
      persistDb(centerId, migrated);
    }
    return migrated;
  } catch {
    return null;
  }
}

export function clearDb(centerId: string) {
  localStorage.removeItem(DB_PREFIX + centerId);
}

/* ------------------------------ backup layer ----------------------------- */
const BACKUP_PREFIX = "cpd_backup_";

export interface BackupFile {
  app: "center-plus-desktop";
  version: number;
  exportedAt: number;
  centerId: string;
  centerName: string;
  db: DatabaseShape;
}

/** Save a timestamped backup of the center's data (used before risky ops). */
export function saveBackup(centerId: string, label = "auto"): number {
  const db = loadDb(centerId);
  if (!db) return 0;
  const ts = now();
  const file: BackupFile = {
    app: "center-plus-desktop",
    version: db.version,
    exportedAt: ts,
    centerId,
    centerName: db.profile.name,
    db,
  };
  try {
    const list = listBackups(centerId);
    list.unshift({ ts, label, file });
    localStorage.setItem(BACKUP_PREFIX + centerId, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* storage full */
  }
  return ts;
}

export interface BackupMeta {
  ts: number;
  label: string;
  file: BackupFile;
}

export function listBackups(centerId: string): BackupMeta[] {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + centerId);
    return raw ? (JSON.parse(raw) as BackupMeta[]) : [];
  } catch {
    return [];
  }
}

export function restoreBackup(centerId: string, ts: number) {
  const meta = listBackups(centerId).find((b) => b.ts === ts);
  if (meta) persistDb(centerId, meta.file.db);
  return !!meta;
}

export function deleteBackup(centerId: string, ts: number) {
  const list = listBackups(centerId).filter((b) => b.ts !== ts);
  localStorage.setItem(BACKUP_PREFIX + centerId, JSON.stringify(list));
}

/** Trigger a JSON-file download of the whole center dataset. */
export function downloadBackupFile(db: DatabaseShape, centerId: string) {
  const file: BackupFile = {
    app: "center-plus-desktop",
    version: db.version,
    exportedAt: now(),
    centerId,
    centerName: db.profile.name,
    db,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `center-plus-backup-${centerId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse a previously-exported backup file (from the user's device). */
export async function parseBackupFile(file: File): Promise<BackupFile> {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupFile;
  if (!parsed?.db || !parsed.db.profile) throw new Error("invalid");
  return parsed;
}

/** Restore a dataset parsed from an uploaded file into a center. */
export function restoreFromFile(centerId: string, file: BackupFile): number {
  const ts = now();
  persistDb(centerId, file.db);
  // also record it in the in-app backup list
  try {
    const list = listBackups(centerId);
    list.unshift({ ts, label: `Imported file · ${file.centerName ?? ""}`, file });
    localStorage.setItem(BACKUP_PREFIX + centerId, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
  return ts;
}

/** Local-first conflict resolution: the record with the larger lastUpdated wins. */
export function mergeByLastUpdated<T extends { lastUpdated: number }>(
  local: T[],
  remote: T[],
  key: (r: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(key(r), r);
  for (const r of remote) {
    const cur = map.get(key(r));
    if (!cur || r.lastUpdated > cur.lastUpdated) map.set(key(r), r);
  }
  return [...map.values()];
}

/* ------------------------------ seed engine ------------------------------ */
const FIRST = [
  "Omar", "Lina", "Youssef", "Mariam", "Adam", "Salma", "Khaled", "Nour",
  "Karim", "Hana", "Yara", "Ziad", "Farida", "Hassan", "Jana", "Tarek",
  "Malak", "Bilal", "Ritam", "Sara", "Ali", "Dina", "Mostafa", "Farida",
];
const LAST = [
  "Hassan", "Mostafa", "El-Sayed", "Adel", "Fouad", "Nabil", "Sami", "Rashed",
  "Kamel", "Wahid", "Salah", "Atef", "Lotfy", "Gaber", "Hosny", "Mansour",
];
const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Arabic",
];
const TEACHER_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e"];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export function emptyDb(centerId: string, name: string): DatabaseShape {
  const ts = now();
  return {
    version: 2,
    profile: {
      centerId,
      name,
      currency: DEFAULT_CURRENCY,
      locale: "en",
      logoText: name.slice(0, 1).toUpperCase(),
      lastUpdated: ts,
    },
    students: [],
    teachers: [],
    groups: [],
    classrooms: [],
    scheduleEvents: [],
    attendance: [],
    payments: [],
    expenses: [],
    exams: [],
    examGrades: [],
    assignments: [],
    studentNotes: [],
    branches: [],
    cardThemes: [],
    activeCardTheme: undefined,
    auditLogs: [],
  };
}

/** Composite DB key for multi-branch isolation: main branch uses centerId
 *  directly, sub-branches use centerId_branchId. */
export function dbKeyFor(centerId: string, branchId: string): string {
  return branchId === "main" || !branchId ? centerId : `${centerId}_${branchId}`;
}

export function seedDb(centerId: string): DatabaseShape {
  const db = emptyDb(centerId, "Future Minds Center");
  const ts = now();
  db.profile.name = "Future Minds Center";
  db.profile.logoText = "FM";
  db.profile.currency = DEFAULT_CURRENCY;

  // Classrooms
  const roomNames = ["Room A · Ground", "Room B · Ground", "Lab 1 · First", "Lab 2 · Second"];
  const classrooms: Classroom[] = roomNames.map((name, i) => ({
    id: uid("room"),
    name,
    capacity: pick([24, 20, 18, 16], i),
    notes: i === 2 ? "Equipped with projector" : undefined,
    lastUpdated: ts,
  }));
  db.classrooms = classrooms;

  // Teachers — each teaches 1-2 subjects with a pay model
  const teachers: Teacher[] = [];
  const tchGrades = [GRADES[6], GRADES[9], GRADES[12]]; // G4, P1, S1
  for (let i = 0; i < 6; i++) {
    const subjects =
      i % 2 === 0
        ? [SUBJECTS[i]]
        : [SUBJECTS[i], pick(SUBJECTS, i + 3)];
    const payType = i % 2 === 0 ? "percentage" : "fixed";
    const code = nextTeacherCode(teachers);
    teachers.push({
      id: code,
      name: `${pick(FIRST, i + 4)} ${pick(LAST, i * 3)}`,
      phone: `+20 10${rnd(20, 99)} ${rnd(100, 999)} ${rnd(1000, 9999)}`,
      email: `teacher${i + 1}@futureminds.edu`,
      subjects,
      payType,
      commissionRate: pick([8, 10, 12, 15], i),
      fixedAmount: pick([400, 600, 800], i),
      color: TEACHER_COLORS[i % TEACHER_COLORS.length],
      lastUpdated: ts,
    });
  }
  db.teachers = teachers;

  // Groups — one per teacher, scoped to a grade. Each meets 2 days/week.
  const MEETING_DAYS: DayOfWeek[][] = [[1, 3], [2, 4], [5, 6], [1, 4], [2, 5], [3, 6]];
  const groups: Group[] = SUBJECTS.map((subject, i) => ({
    id: uid("grp"),
    name: `${subject} · ${tchGrades[i % tchGrades.length].en}`,
    teacherId: teachers[i].id,
    grade: tchGrades[i % tchGrades.length].id,
    subject,
    days: MEETING_DAYS[i % MEETING_DAYS.length],
    scheduleDescription: "",
    lastUpdated: ts,
  }));
  db.groups = groups;

  // Schedule events (Mon-Sat for each group)
  const days: DayOfWeek[] = [1, 2, 3, 4, 5, 6];
  const slots = [
    ["09:00", "10:30"],
    ["11:00", "12:30"],
    ["13:00", "14:30"],
    ["15:00", "16:30"],
    ["17:00", "18:30"],
    ["19:00", "20:30"],
  ];
  const scheduleEvents: ScheduleEvent[] = [];
  groups.forEach((g, gi) => {
    [0, 2].forEach((_o, k) => {
      const slot = slots[(gi + k) % slots.length];
      scheduleEvents.push({
        id: uid("sch"),
        groupId: g.id,
        classroomId: classrooms[gi % classrooms.length].id,
        dayOfWeek: days[(gi + k * 2) % days.length],
        startTime: slot[0],
        endTime: slot[1],
        locked: false,
        lastUpdated: ts,
      });
    });
    g.scheduleDescription = `Day ${pick(days, gi)} · ${slots[gi % slots.length][0]}`;
  });
  db.scheduleEvents = scheduleEvents;

  // Students — 4 per group, each registered with its group's teacher (+fee)
  const students: Student[] = [];
  const regBase = addDays(startOfDay(now()), -150);
  let nameIdx = 0;
  groups.forEach((g, gi) => {
    const teacher = teachers[gi];
    for (let i = 0; i < 4; i++) {
      const code = nextStudentCode(students);
      const fee = pick([300, 350, 400, 450, 500], gi + i);
      const exempt = i === 0 && gi === 0;
      const registrationDate = addDays(regBase, rnd(0, 120));
      // ~25% of students also study with a second teacher
      const teachersList =
        Math.random() < 0.25 && teachers.length > gi + 1
          ? [
              { teacherId: teacher.id, fee },
              { teacherId: teachers[(gi + 2) % teachers.length].id, fee: pick([200, 250], i) },
            ]
          : [{ teacherId: teacher.id, fee }];
      students.push({
        id: code,
        name: `${pick(FIRST, nameIdx)} ${pick(LAST, nameIdx * 2 + gi)}`,
        grade: g.grade ?? tchGrades[gi % tchGrades.length].id,
        groupIds: [g.id],
        teachers: teachersList,
        studentPhone: `+20 10${rnd(10, 99)} ${rnd(100, 999)} ${rnd(1000, 9999)}`,
        parentName: `${pick(FIRST, nameIdx + 10)} ${pick(LAST, nameIdx)}`,
        parentPhone: `+20 12${rnd(10, 99)} ${rnd(100, 999)} ${rnd(1000, 9999)}`,
        discount: exempt ? fee : 0,
        isExempt: exempt,
        qrCode: `CPD:${code}`,
        registrationDate,
        enrollmentType: i === 0 ? "private" : (i % 5 === 0 ? "private" : "group"),
        paymentType: i % 3 === 0 ? "deferred" : "advance",
        lastUpdated: ts,
      });
      nameIdx++;
    }
  });
  db.students = students;

  // Attendance — generate a record for each meeting day of each group over the
  // last ~45 days, so the monthly view reflects real session-by-session history.
  const attendance: AttendanceRecord[] = [];
  const statuses: AttendanceStatus[] = ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT", "EXCUSED"];
  const jsDow = (ts: number) => { const j = new Date(ts).getDay(); return j === 0 ? 7 : j; };
  for (let d = 0; d <= 45; d++) {
    const day = startOfDay(addDays(now(), -d));
    const dow = jsDow(day);
    for (const s of students) {
      const gid = s.groupIds[0];
      if (!gid) continue;
      const grp = db.groups.find((g) => g.id === gid);
      // only on this group's meeting days
      if (!grp?.days?.includes(dow as DayOfWeek)) continue;
      const status = pick(statuses, rnd(0, statuses.length - 1));
      attendance.push({
        id: uid("att"),
        studentId: s.id,
        groupId: gid,
        date: day,
        status,
        tempDegree: status === "PRESENT" ? +(36.4 + Math.random() * 0.9).toFixed(1) : undefined,
        notes: status === "EXCUSED" ? "Medical leave" : undefined,
        lastUpdated: day,
      });
    }
  }
  db.attendance = attendance;

  // Payments — a MONTHLY_FEE payment per teacher for each calendar month from
  // the registration month through the current month (advance billing). ~82%
  // are paid so the demo shows a realistic mix of paid / overdue students.
  const payments: Payment[] = [];
  const nextMonthKey = (mk: string): string => {
    const [y, mo] = mk.split("-").map(Number);
    const d = new Date(y, mo, 1); // mo is 1-based → next month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const liableFromReg = (regTs: number): string[] => {
    const out: string[] = [];
    const cur = monthKey(now());
    let m = monthKey(regTs);
    let guard = 0;
    while (m <= cur && guard < 600) {
      out.push(m);
      m = nextMonthKey(m);
      guard++;
    }
    return out;
  };
  for (const s of students) {
    for (const mk of liableFromReg(s.registrationDate)) {
      if (Math.random() < 0.18) continue; // missed this month -> shows as due
      const [yy, mm] = mk.split("-").map(Number);
      const d = startOfDay(new Date(yy, mm - 1, rnd(1, 28)).getTime());
      for (const t of s.teachers) {
        payments.push({
          id: uid("pay"),
          studentId: s.id,
          amount: t.fee,
          date: d,
          type: "MONTHLY_FEE",
          month: mk,
          teacherId: t.teacherId,
          forCenter: false,
          notes: undefined,
          lastUpdated: d,
        });
      }
    }
    // a couple of exam/book fees payments allocated to the first teacher
    if (Math.random() < 0.5) {
      payments.push({
        id: uid("pay"),
        studentId: s.id,
        amount: pick([40, 60, 80], rnd(0, 2)),
        date: startOfDay(addDays(now(), -rnd(5, 60))),
        type: pick(["EXAM_FEE", "BOOKS"], rnd(0, 1)),
        month: monthKey(addDays(now(), -30)),
        teacherId: s.teachers[0]?.teacherId,
        forCenter: false,
        notes: undefined,
        lastUpdated: startOfDay(addDays(now(), -10)),
      });
    }
    // occasional center subscription payment
    if (Math.random() < 0.3) {
      payments.push({
        id: uid("pay"),
        studentId: s.id,
        amount: pick([50, 100], rnd(0, 1)),
        date: startOfDay(addDays(now(), -rnd(5, 40))),
        type: "OTHER",
        month: monthKey(addDays(now(), -30)),
        teacherId: undefined,
        forCenter: true,
        notes: "Center subscription",
        lastUpdated: startOfDay(addDays(now(), -5)),
      });
    }
  }
  db.payments = payments;

  // Expenses
  const expenseSeed: Array<[Expense["category"], number, number]> = [
    ["Rent", 4000, 1], ["Salaries", 12000, 2], ["Electricity", 600, 5],
    ["Internet", 250, 9], ["Tools", 320, 14], ["Salaries", 12000, 32],
    ["Rent", 4000, 33], ["Electricity", 540, 40], ["Internet", 250, 45],
    ["Tools", 180, 50], ["Other", 150, 58], ["Salaries", 12000, 62],
    ["Rent", 4000, 63], ["Electricity", 610, 70], ["Internet", 250, 75],
  ];
  db.expenses = expenseSeed.map(([category, amount, daysAgo]) => ({
    id: uid("exp"),
    title: `${category} · ${monthKey(addDays(now(), -daysAgo))}`,
    amount,
    category,
    date: startOfDay(addDays(now(), -daysAgo)),
    notes: undefined,
    lastUpdated: startOfDay(addDays(now(), -daysAgo)),
  }));

  // Exams + grades
  const exams: Exam[] = [];
  const examGrades: ExamGrade[] = [];
  groups.forEach((g, gi) => {
    [0, 1].forEach((k) => {
      const exam: Exam = {
        id: uid("exm"),
        groupId: g.id,
        name: `${g.subject} ${k === 0 ? "Midterm" : "Quiz"}`,
        maxGrade: k === 0 ? 50 : 20,
        date: startOfDay(addDays(now(), -(10 + gi * 3 + k * 14))),
        lastUpdated: ts,
      };
      exams.push(exam);
      const groupStudents = students.filter((s) => s.groupIds.includes(g.id));
      for (const s of groupStudents) {
        examGrades.push({
          id: uid("grd"),
          examId: exam.id,
          studentId: s.id,
          obtainedGrade: +(exam.maxGrade * (0.5 + Math.random() * 0.48)).toFixed(1),
          notes: undefined,
          lastUpdated: ts,
        });
      }
    });
  });
  db.exams = exams;
  db.examGrades = examGrades;

  // Assignments
  db.assignments = groups.slice(0, 4).map((g, i) => ({
    id: uid("asg"),
    groupId: g.id,
    title: `${g.subject} Assignment ${i + 1}`,
    description: `Practice problems covering the latest ${g.subject} chapter.`,
    dueDate: startOfDay(addDays(now(), rnd(1, 9))),
    lastUpdated: ts,
  }));

  // Student notes
  db.studentNotes = students.slice(0, 6).map((s, i) => ({
    id: uid("note"),
    studentId: s.id,
    teacherId: s.teachers[0]?.teacherId,
    text: pick(
      [
        "Great improvement this month, keep it up!",
        "Needs to focus more during group sessions.",
        "Excellent participation and teamwork.",
        "Should review previous lessons at home.",
        "Outstanding performance in the last quiz.",
        "Encourage more practice on weak topics.",
      ],
      i,
    ),
    date: startOfDay(addDays(now(), -rnd(1, 12))),
    lastUpdated: startOfDay(addDays(now(), -rnd(1, 12))),
  }));

  // Branches — seed with a main branch + a demo second branch
  db.branches = [
    {
      id: "main",
      name: db.profile.name || "Main Branch",
      address: "Downtown · Main Street",
      phone: "+20 100 000 0001",
      manager: "Dr. Mona Adel",
      isMain: true,
      lastUpdated: ts,
    },
    {
      id: "branch_downtown",
      name: "Downtown Branch",
      address: "City Center · 2nd Floor",
      phone: "+20 100 000 0002",
      manager: "Eng. Khaled Sami",
      isMain: false,
      lastUpdated: ts,
    },
  ];

  return db;
}

/** Mutate a profile field immutably. */
export function withProfile(
  db: DatabaseShape,
  patch: Partial<CenterProfile>,
): DatabaseShape {
  return {
    ...db,
    profile: { ...db.profile, ...patch, lastUpdated: now() },
  };
}
