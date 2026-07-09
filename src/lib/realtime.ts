/**
 * Real-Time Sync Layer
 * =====================
 * Provides onSnapshot() listeners that push live updates from Firestore
 * to the React app. Any change made on the mobile app appears instantly
 * on desktop, and vice versa.
 *
 * Usage:
 *   const unsub = listenToStudent("10042", (student) => { ... });
 *   // later: unsub();
 */

import { db, FIREBASE_ENABLED } from "./firebase";
import {
  onSnapshot,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore";
import { UNIFIED_PATHS } from "./unified-schema";
import type {
  UnifiedStudent,
  UnifiedAttendance,
  UnifiedGrade,
  UnifiedPayment,
  UnifiedNotification,
} from "./unified-schema";

/* ==================== Single Document Listeners ==================== */

/**
 * Listen to a single student document in real-time.
 * @param code — student code (document ID)
 * @param cb — callback fired on every change
 * @returns unsubscribe function
 */
export function listenToStudent(
  code: string,
  cb: (student: UnifiedStudent | null) => void,
): Unsubscribe {
  if (!FIREBASE_ENABLED || !db) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, UNIFIED_PATHS.student(code)),
    (snap) => {
      if (snap.exists()) {
        cb({ studentCode: code, ...snap.data() } as UnifiedStudent);
      } else {
        cb(null);
      }
    },
    (err) => console.error("[realtime] student listener error:", err),
  );
}

/* ==================== Collection Listeners ==================== */

/**
 * Listen to all attendance records for a specific student.
 */
export function listenToStudentAttendance(
  studentCode: string,
  cb: (records: UnifiedAttendance[]) => void,
): Unsubscribe {
  return listenToCollection<UnifiedAttendance>(
    UNIFIED_PATHS.attendance,
    [where("studentCode", "==", studentCode), orderBy("date", "desc"), limit(100)],
    cb,
  );
}

/**
 * Listen to all grades for a specific student.
 */
export function listenToStudentGrades(
  studentCode: string,
  cb: (grades: UnifiedGrade[]) => void,
): Unsubscribe {
  return listenToCollection<UnifiedGrade>(
    UNIFIED_PATHS.grades,
    [where("studentCode", "==", studentCode), orderBy("createdAt", "desc"), limit(50)],
    cb,
  );
}

/**
 * Listen to all payments for a specific student.
 */
export function listenToStudentPayments(
  studentCode: string,
  cb: (payments: UnifiedPayment[]) => void,
): Unsubscribe {
  return listenToCollection<UnifiedPayment>(
    UNIFIED_PATHS.payments,
    [where("studentCode", "==", studentCode), orderBy("collectedAt", "desc"), limit(50)],
    cb,
  );
}

/**
 * Listen to notifications for a specific user (parent/student uid).
 */
export function listenToNotifications(
  recipientUid: string,
  cb: (notifications: UnifiedNotification[]) => void,
): Unsubscribe {
  return listenToCollection<UnifiedNotification>(
    UNIFIED_PATHS.notifications,
    [where("recipientUid", "==", recipientUid), orderBy("createdAt", "desc"), limit(30)],
    cb,
  );
}

/**
 * Listen to all students within a center (for admin/teacher dashboards).
 */
export function listenToCenterStudents(
  centerId: string,
  cb: (students: UnifiedStudent[]) => void,
): Unsubscribe {
  return listenToCollection<UnifiedStudent>(
    UNIFIED_PATHS.students,
    [where("centerId", "==", centerId), limit(500)],
    cb,
  );
}

/* ==================== Internal Helper ==================== */

function listenToCollection<T>(
  path: string,
  constraints: QueryConstraint[],
  cb: (items: T[]) => void,
): Unsubscribe {
  if (!FIREBASE_ENABLED || !db) {
    cb([]);
    return () => {};
  }
  try {
    const q = query(collection(db, path), ...constraints);
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
        cb(items);
      },
      (err) => console.error(`[realtime] collection listener error (${path}):`, err),
    );
  } catch (err) {
    console.error(`[realtime] query error (${path}):`, err);
    cb([]);
    return () => {};
  }
}
