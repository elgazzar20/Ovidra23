/**
 * Unified Cloud Schema — Mobile + Desktop Shared Database
 * ========================================================
 * Defines the shared Firestore collections that BOTH the mobile app
 * and desktop app use. This sits alongside the existing local-first
 * center-isolated data (which remains the working layer for the desktop app).
 *
 * Collections:
 *   /users/{uid}              — unified user profiles (auth + role)
 *   /students/{studentCode}   — global student registry
 *   /parents/{parentUid}      — parent profiles
 *   /student_links/{linkId}   — student ↔ parent binding
 *   /attendance/{recordId}    — global attendance records
 *   /grades/{gradeId}         — global exam grades
 *   /payments/{paymentId}     — global payment records
 *   /notifications/{notifId}  — real-time notifications
 *   /system/counters          — centralized sequential counters
 *   /system/invite_codes      — staff invite codes
 *   /audit_logs/{logId}       — super admin audit trail
 *   /centers/{centerId}       — center registry (super admin view)
 */

import { db, FIREBASE_ENABLED } from "./firebase";
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";

/* ==================== Unified Types ==================== */

/** Unified role — matches the mobile app exactly. */
export type UnifiedRole = "super_admin" | "admin" | "teacher" | "parent" | "student";

/** Unified user document — stored in /users/{uid}. */
export interface UnifiedUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UnifiedRole;
  centerId?: string;       // which center they belong to
  branchId?: string;       // which branch
  status: "active" | "suspended" | "disabled";
  phone?: string;
  inviteCode?: string;     // for staff invited via code
  createdAt: number;
  updatedAt: number;
}

/** Global student document — /students/{studentCode}. */
export interface UnifiedStudent {
  studentCode: string;     // e.g. "10001" — the document ID
  fullName: string;
  grade: string;
  phone?: string;
  parentPhone?: string;
  parentUid?: string;      // linked parent's Firebase UID
  parentName?: string;
  centerId: string;
  branchId?: string;
  teacherIds: string[];
  groupIds: string[];
  attendanceStats: {
    totalSessions: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
  examStats: {
    averageGrade: number;
    examCount: number;
  };
  financialStats: {
    totalPaid: number;
    balanceDue: number;
    currency: string;
  };
  createdAt: number;
  updatedAt: number;
}

/** Parent document — /parents/{parentUid}. */
export interface UnifiedParent {
  uid: string;             // Firebase Auth UID
  displayName: string;
  phone: string;
  email?: string;
  photoURL?: string;
  childrenCodes: string[]; // array of studentCode values
  centerId?: string;
  fcmToken?: string;       // mobile push notification token
  createdAt: number;
  updatedAt: number;
}

/** Student ↔ Parent link — /student_links/{linkId}. */
export interface StudentLink {
  linkId: string;          // `${studentCode}_${parentUid}`
  studentCode: string;
  parentUid: string;
  studentUid?: string;
  centerId: string;
  createdAt: number;
  active: boolean;
}

/** Global attendance record — /attendance/{recordId}. */
export interface UnifiedAttendance {
  recordId: string;        // `${studentCode}_${date}_${groupId}`
  studentCode: string;
  centerId: string;
  groupId: string;
  date: number;            // epoch ms (start of day)
  status: "PRESENT" | "ABSENT" | "EXCUSED" | "LATE";
  markedBy: string;        // uid of teacher/admin who marked
  markedAt: number;
  device: "mobile" | "desktop";
  note?: string;
}

/** Global grade record — /grades/{gradeId}. */
export interface UnifiedGrade {
  gradeId: string;
  studentCode: string;
  examId: string;
  centerId: string;
  obtainedGrade: number;
  maxGrade: number;
  published: boolean;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Global payment record — /payments/{paymentId}. */
export interface UnifiedPayment {
  paymentId: string;
  studentCode: string;
  centerId: string;
  amount: number;
  type: string;
  month: string;
  method: "cash" | "card" | "transfer" | "online";
  collectedBy: string;     // uid
  collectedAt: number;
  device: "mobile" | "desktop";
  note?: string;
}

/** Notification — /notifications/{notifId}. */
export interface UnifiedNotification {
  notifId: string;
  recipientUid: string;    // parent or student uid
  studentCode: string;
  centerId: string;
  type: "attendance" | "grade" | "payment" | "homework" | "exam" | "note" | "general";
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

/** Invite code for staff — /system/invite_codes/{code}. */
export interface InviteCode {
  code: string;            // 8-char alphanumeric
  centerId: string;
  role: UnifiedRole;
  email?: string;
  used: boolean;
  usedBy?: string;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
}

/* ==================== Collection Helpers ==================== */

/** Returns the Firestore collection reference, or null if Firebase isn't configured. */
function ref(path: string): CollectionReference | null {
  if (!FIREBASE_ENABLED || !db) return null;
  return collection(db, path);
}

/** Returns the Firestore document reference, or null if Firebase isn't configured. */
function docRef(path: string): DocumentReference | null {
  if (!FIREBASE_ENABLED || !db) return null;
  return doc(db, path);
}

/* ==================== Path Constants ==================== */

export const UNIFIED_PATHS = {
  // Users
  users: "users",
  user: (uid: string) => `users/${uid}`,

  // Students (global registry)
  students: "students",
  student: (code: string) => `students/${code}`,

  // Parents
  parents: "parents",
  parent: (uid: string) => `parents/${uid}`,

  // Student Links
  studentLinks: "student_links",
  studentLink: (studentCode: string, parentUid: string) =>
    `student_links/${studentCode}_${parentUid}`,

  // Attendance (global)
  attendance: "attendance",

  // Grades (global)
  grades: "grades",

  // Payments (global)
  payments: "payments",

  // Notifications
  notifications: "notifications",

  // System
  counters: "system/counters",
  studentCounter: "system/counters/student_counter",
  inviteCodes: "system/invite_codes",

  // Centers (super admin)
  centers: "centers",

  // Audit
  auditLogs: "audit_logs",
} as const;

/* ==================== Collection References ==================== */

export const collections = {
  users: () => ref(UNIFIED_PATHS.users),
  students: () => ref(UNIFIED_PATHS.students),
  parents: () => ref(UNIFIED_PATHS.parents),
  studentLinks: () => ref(UNIFIED_PATHS.studentLinks),
  attendance: () => ref(UNIFIED_PATHS.attendance),
  grades: () => ref(UNIFIED_PATHS.grades),
  payments: () => ref(UNIFIED_PATHS.payments),
  notifications: () => ref(UNIFIED_PATHS.notifications),
  inviteCodes: () => ref(UNIFIED_PATHS.inviteCodes),
  centers: () => ref(UNIFIED_PATHS.centers),
  auditLogs: () => ref(UNIFIED_PATHS.auditLogs),
};

export const docs = {
  user: (uid: string) => docRef(UNIFIED_PATHS.user(uid)),
  student: (code: string) => docRef(UNIFIED_PATHS.student(code)),
  parent: (uid: string) => docRef(UNIFIED_PATHS.parent(uid)),
  studentCounter: () => docRef(UNIFIED_PATHS.studentCounter),
  studentLink: (code: string, uid: string) => docRef(UNIFIED_PATHS.studentLink(code, uid)),
};
