/**
 * Center Plus Desktop — Firebase Integration
 * ==========================================
 * Initializes Firebase App, Authentication, and Firestore using environment
 * variables. The app remains local-first: every write lands in the local
 * store immediately, then syncs to Firestore asynchronously.
 *
 * Setup:
 *   1. Copy `.env.example` → `.env`
 *   2. Fill in your Firebase project credentials
 *   3. The `auth` and `db` exports below are ready to use
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  type Firestore,
} from "firebase/firestore";

/* --------------------------- env-based config --------------------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBy6VwqzN6HUYEmovYIGT6bS2N-wlRKQqU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nexora-windos-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nexora-windos-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nexora-windos-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "869178537311",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:869178537311:web:452ea2c9dddf6d85f332ea",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Y0TB8YHMDG",
};

/** True when all critical env vars are present and are not placeholder values. 
 * Set to true to fully enable Firebase syncing and Auth connections per user request. */
export const FIREBASE_ENABLED = true;

/* --------------------------- singletons (lazy) -------------------------- */
let _app: FirebaseApp | null = null;

/**
 * Lazily initialize the Firebase App singleton.
 * Returns null if credentials are not configured.
 */
function getApp(): FirebaseApp | null {
  if (!FIREBASE_ENABLED) return null;
  if (!_app) {
    try {
      _app = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Firebase initializeApp failed:", e);
      return null;
    }
  }
  return _app;
}

/** Firebase Authentication singleton. Null when not configured. */
export const auth: Auth | null = (() => {
  try {
    const app = getApp();
    return app ? getAuth(app) : null;
  } catch (e) {
    console.error("Firebase getAuth failed:", e);
    return null;
  }
})();

/** Firestore Database singleton. Null when not configured. */
export const db: Firestore | null = (() => {
  try {
    const app = getApp();
    return app
      ? initializeFirestore(app, {
          experimentalForceLongPolling: true,
          ignoreUndefinedProperties: true,
        })
      : null;
  } catch (e) {
    console.error("Firebase initializeFirestore failed:", e);
    return null;
  }
})();

/** Backwards-compatible exports for the raw singletons. */
export { firebaseConfig, getApp };

/* ----------------------- tenant-isolated path helpers ------------------- */
/**
 * Every collection lives under /centers/{centerId}/ to keep tenant data
 * fully isolated. These helpers build the correct document paths.
 */
export const paths = {
  /** /centers/{centerId}/profile/settings */
  settings: (cid: string) => `centers/${cid}/profile/settings`,
  /** /centers/{centerId}/{collection}/{id} */
  collection: (cid: string, coll: string, id: string) =>
    `centers/${cid}/${coll}/${id}`,
};

/** Map of local collection keys → Firestore sub-collection path segments. */
export const COLLECTIONS = [
  "students", "teachers", "groups", "classrooms", "schedule_events",
  "attendance", "payments", "expenses", "exams", "exam_grades",
  "assignments", "student_notes",
] as const;

/* ------------------------- sync primitives ------------------------------ */

function cleanUndefined(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === "object") {
    const proto = Object.getPrototypeOf(obj);
    if (proto === null || proto === Object.prototype) {
      const res: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== undefined) {
          res[key] = cleanUndefined(val);
        }
      }
      return res;
    }
  }
  return obj;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Push (upsert) a single record to Firestore at the given path.
 * Uses `merge: true` so partial updates don't clobber existing fields.
 * Falls back to a no-op delay when Firebase is not configured.
 */
export async function pushRecord(path: string, data: unknown): Promise<void> {
  if (!FIREBASE_ENABLED || !db) {
    await new Promise((r) => setTimeout(r, 250));
    return;
  }
  if (auth && !auth.currentUser) {
    console.warn("[pushRecord] Skipping sync: No authenticated user logged into Firebase");
    return;
  }
  const cleanData = cleanUndefined(data);
  try {
    await setDoc(doc(db, path), cleanData as Record<string, unknown>, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a document from Firestore at the given path.
 * No-op when Firebase is not configured.
 */
export async function deleteRecord(path: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  if (auth && !auth.currentUser) {
    console.warn("[deleteRecord] Skipping delete: No authenticated user logged into Firebase");
    return;
  }
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Pull all documents from a Firestore collection path.
 * Returns an empty array when Firebase is not configured.
 */
export async function pullCollection(path: string): Promise<Record<string, unknown>[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  if (auth && !auth.currentUser) {
    console.warn("[pullCollection] Skipping fetch: No authenticated user logged into Firebase");
    return [];
  }
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/* --------------------------- status helpers ----------------------------- */
export const FIREBASE_STATUS = {
  enabled: FIREBASE_ENABLED,
  projectId: firebaseConfig.projectId || "—",
  ready: FIREBASE_ENABLED ? "Cloud ready" : "Local-only",
};
