/**
 * Parent-Student Linking System
 * ==============================
 * Handles linking a parent to their child via:
 *   1. Student Code entry
 *   2. QR Code scan (contains the student code)
 *
 * Once linked, the parent receives real-time updates for:
 *   attendance, grades, payments, homework, notifications.
 */

import { db, FIREBASE_ENABLED } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { UNIFIED_PATHS } from "./unified-schema";
import type { UnifiedStudent, UnifiedParent, StudentLink } from "./unified-schema";

export interface LinkResult {
  ok: boolean;
  error?: string;
  student?: UnifiedStudent;
}

/**
 * Links a parent to a student using the student code.
 *
 * Flow:
 *   1. Look up /students/{code} — verify it exists
 *   2. Check if link already exists
 *   3. Create /student_links/{code}_{parentUid}
 *   4. Add code to parent's childrenCodes array
 *   5. Set student's parentUid field
 */
export async function linkParentToStudent(
  studentCode: string,
  parentUid: string,
  parentDisplayName: string,
): Promise<LinkResult> {
  if (!FIREBASE_ENABLED || !db) {
    return { ok: false, error: "Cloud not configured" };
  }

  try {
    // 1. Verify student exists
    const studentRef = doc(db, UNIFIED_PATHS.student(studentCode));
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) {
      return { ok: false, error: "Student code not found" };
    }
    const student = { studentCode, ...studentSnap.data() } as UnifiedStudent;

    // 2. Check for existing active link
    const linkId = `${studentCode}_${parentUid}`;
    const linkRef = doc(db, UNIFIED_PATHS.studentLink(studentCode, parentUid));
    const linkSnap = await getDoc(linkRef);
    if (linkSnap.exists() && (linkSnap.data() as StudentLink).active) {
      return { ok: false, error: "Already linked to this student" };
    }

    // 3. Create the link
    const link: StudentLink = {
      linkId,
      studentCode,
      parentUid,
      centerId: student.centerId,
      createdAt: Date.now(),
      active: true,
    };
    await setDoc(linkRef, link);

    // 4. Update parent's childrenCodes
    const parentRef = doc(db, UNIFIED_PATHS.parent(parentUid));
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
      const parent = parentSnap.data() as UnifiedParent;
      if (!parent.childrenCodes?.includes(studentCode)) {
        await updateDoc(parentRef, {
          childrenCodes: [...(parent.childrenCodes ?? []), studentCode],
          updatedAt: Date.now(),
        });
      }
    } else {
      // Create parent document if it doesn't exist
      await setDoc(parentRef, {
        uid: parentUid,
        displayName: parentDisplayName,
        phone: "",
        childrenCodes: [studentCode],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // 5. Set student's parentUid
    await updateDoc(studentRef, {
      parentUid,
      parentName: parentDisplayName,
      updatedAt: Date.now(),
    });

    return { ok: true, student };
  } catch (err) {
    console.error("[link] Failed:", err);
    return { ok: false, error: "Linking failed. Please try again." };
  }
}

/**
 * Unlinks a parent from a student.
 */
export async function unlinkParentFromStudent(
  studentCode: string,
  parentUid: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!FIREBASE_ENABLED || !db) return { ok: false, error: "Cloud not configured" };

  try {
    // Deactivate the link
    await updateDoc(doc(db, UNIFIED_PATHS.studentLink(studentCode, parentUid)), {
      active: false,
    });

    // Remove from parent's childrenCodes
    const parentRef = doc(db, UNIFIED_PATHS.parent(parentUid));
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
      const parent = parentSnap.data() as UnifiedParent;
      await updateDoc(parentRef, {
        childrenCodes: (parent.childrenCodes ?? []).filter((c) => c !== studentCode),
        updatedAt: Date.now(),
      });
    }

    // Clear student's parentUid
    await updateDoc(doc(db, UNIFIED_PATHS.student(studentCode)), {
      parentUid: null,
      parentName: null,
      updatedAt: Date.now(),
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Unlinking failed" };
  }
}

/**
 * Fetches all children (students) linked to a parent.
 */
export async function getParentChildren(parentUid: string): Promise<UnifiedStudent[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  try {
    const parentSnap = await getDoc(doc(db, UNIFIED_PATHS.parent(parentUid)));
    if (!parentSnap.exists()) return [];

    const parent = parentSnap.data() as UnifiedParent;
    const codes = parent.childrenCodes ?? [];
    if (!codes.length) return [];

    const students: UnifiedStudent[] = [];
    for (const code of codes) {
      const snap = await getDoc(doc(db, UNIFIED_PATHS.student(code)));
      if (snap.exists()) {
        students.push({ studentCode: code, ...snap.data() } as UnifiedStudent);
      }
    }
    return students;
  } catch {
    return [];
  }
}

/**
 * Fetches all active links for a student (multiple parents possible).
 */
export async function getStudentLinks(studentCode: string): Promise<StudentLink[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  try {
    const q = query(
      collection(db, UNIFIED_PATHS.studentLinks),
      where("studentCode", "==", studentCode),
      where("active", "==", true),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as StudentLink);
  } catch {
    return [];
  }
}

/**
 * Generates a QR payload for a student (used by the mobile scanner).
 * Format: "CPD_STUDENT:{studentCode}"
 */
export function buildStudentQR(code: string): string {
  return `CPD_STUDENT:${code}`;
}

/**
 * Parses a scanned QR payload and extracts the student code.
 */
export function parseStudentQR(payload: string): string | null {
  const match = /^CPD_STUDENT:(.+)$/.exec(payload);
  return match ? match[1] : null;
}
