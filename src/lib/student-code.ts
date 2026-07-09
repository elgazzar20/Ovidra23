/**
 * Centralized Student Code Generator
 * ==================================
 * Uses a Firestore Transaction on system/counters/student_counter
 * to guarantee unique sequential codes even when the mobile app
 * and desktop create students at the exact same moment.
 *
 * Codes are sequential: 10001, 10002, 10003, ...
 */

import { db, FIREBASE_ENABLED } from "./firebase";
import {
  runTransaction,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { UNIFIED_PATHS } from "./unified-schema";

const START_CODE = 10001;

/**
 * Atomically generates the next student code via Firestore Transaction.
 *
 * This is the ONLY function that should ever create student codes.
 * It prevents duplicates even under concurrent writes from multiple devices.
 *
 * @param centerId — the center this student belongs to (for logging)
 * @returns the new sequential code string (e.g. "10042")
 */
export async function generateStudentCode(centerId: string): Promise<string> {
  if (!FIREBASE_ENABLED || !db) {
    // Fallback: local-only mode (for offline/demo)
    const local = parseInt(localStorage.getItem("cpd_local_student_counter") || String(START_CODE - 1), 10);
    const next = local + 1;
    localStorage.setItem("cpd_local_student_counter", String(next));
    return String(next);
  }

  const counterRef = doc(db, UNIFIED_PATHS.studentCounter);

  try {
    const newCode = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let lastCode: number;
      if (!counterDoc.exists()) {
        // Initialize the counter on first use
        lastCode = START_CODE - 1;
        transaction.set(counterRef, {
          lastCode,
          centerId,
          updatedAt: Date.now(),
        });
      } else {
        lastCode = counterDoc.data().lastCode as number;
      }

      const nextCode = lastCode + 1;

      // Increment the counter atomically
      transaction.update(counterRef, {
        lastCode: nextCode,
        updatedAt: Date.now(),
        lastCenterId: centerId,
      });

      return nextCode;
    });

    return String(newCode);
  } catch (err) {
    console.error("[student-code] Transaction failed, falling back:", err);
    // Last-resort fallback (non-atomic — only used if transaction fails)
    const snap = await getDoc(counterRef);
    const fallback = snap.exists() ? (snap.data().lastCode as number) + 1 : START_CODE;
    await setDoc(counterRef, { lastCode: fallback, updatedAt: Date.now() }, { merge: true });
    return String(fallback);
  }
}

/**
 * Peeks at the current counter value without incrementing.
 * Useful for UI previews ("Next student will be #10042").
 */
export async function peekNextCode(): Promise<number> {
  if (!FIREBASE_ENABLED || !db) {
    return parseInt(localStorage.getItem("cpd_local_student_counter") || String(START_CODE - 1), 10) + 1;
  }
  try {
    const snap = await getDoc(doc(db, UNIFIED_PATHS.studentCounter));
    if (!snap.exists()) return START_CODE;
    return (snap.data().lastCode as number) + 1;
  } catch {
    return START_CODE;
  }
}

/**
 * Validates that a student code exists in the global /students collection.
 */
export async function validateStudentCode(code: string): Promise<boolean> {
  if (!FIREBASE_ENABLED || !db) return false;
  try {
    const snap = await getDoc(doc(db, UNIFIED_PATHS.student(code)));
    return snap.exists();
  } catch {
    return false;
  }
}
