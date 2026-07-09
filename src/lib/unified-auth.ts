/**
 * Unified Authentication Layer
 * =============================
 * Handles all auth flows shared between mobile and desktop:
 *   - Email/Password
 *   - Google Sign-In
 *   - Invite Code (staff login)
 *
 * Creates /users/{uid} documents with the unified role system.
 */

import { auth, db, FIREBASE_ENABLED } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  type User as FbUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { UNIFIED_PATHS } from "./unified-schema";
import type { UnifiedRole, UnifiedUser } from "./unified-schema";

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: FbUser;
  role?: UnifiedRole;
}

/**
 * Creates the /users/{uid} document after any successful registration.
 * This is the source of truth for role + status.
 */
async function createUserDocument(
  fb: FbUser,
  displayName: string,
  role: UnifiedRole = "admin",
  centerId?: string,
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;

  const userDoc = {
    uid: fb.uid,
    email: fb.email ?? "",
    displayName,
    photoURL: fb.photoURL ?? "",
    role,
    centerId: centerId ?? fb.uid,
    status: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, UNIFIED_PATHS.user(fb.uid)), userDoc, { merge: true });
  } catch {
    // Non-blocking — local-first continues
  }
}

/**
 * Register with Email/Password (creates a new center owner / admin).
 */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    if (!auth) {
      return { ok: false, error: "Firebase not initialized" };
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await createUserDocument(cred.user, name, "admin");
    return { ok: true, user: cred.user, role: "admin" };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    return { ok: false, error: mapError(code) };
  }
}

/**
 * Sign in with Email/Password.
 * Checks Firestore for the user's role after auth.
 */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    if (!auth) {
      return { ok: false, error: "Firebase not initialized" };
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const role = await fetchUserRole(cred.user.uid);
    return { ok: true, user: cred.user, role };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    return { ok: false, error: mapError(code) };
  }
}

/**
 * Sign in with Google.
 * Creates user doc if it doesn't exist.
 */
export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    if (!auth) {
      return { ok: false, error: "Firebase not initialized" };
    }
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const role = await fetchOrCreateUserRole(cred.user);
    return { ok: true, user: cred.user, role };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    return { ok: false, error: mapError(code) };
  }
}

/**
 * Sign in / register using an invite code.
 *
 * Flow:
 *   1. Look up /system/invite_codes/{code}
 *   2. If found & not used → create account (or link existing)
 *   3. Set the role from the invite code
 *   4. Mark code as used
 */
export async function loginWithInviteCode(
  code: string,
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  if (!FIREBASE_ENABLED || !db) {
    return { ok: false, error: "Cloud not configured" };
  }

  try {
    // 1. Validate invite code
    const inviteRef = doc(db, `system/invite_codes/${code}`);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      return { ok: false, error: "Invalid invite code" };
    }
    const invite = inviteSnap.data();
    if (invite.used) {
      return { ok: false, error: "This invite code has already been used" };
    }
    if (invite.expiresAt < Date.now()) {
      return { ok: false, error: "This invite code has expired" };
    }

    // 2. Create the auth account
    if (!auth) {
      return { ok: false, error: "Firebase not initialized" };
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    // 3. Create user document with the role from the invite
    await createUserDocument(cred.user, displayName, invite.role as UnifiedRole, invite.centerId);

    // 4. Mark invite as used
    await setDoc(inviteRef, {
      used: true,
      usedBy: cred.user.uid,
      usedAt: Date.now(),
    }, { merge: true });

    return { ok: true, user: cred.user, role: invite.role as UnifiedRole };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    return { ok: false, error: mapError(code) };
  }
}

/**
 * Fetches a user's role from Firestore /users/{uid}.
 */
export async function fetchUserRole(uid: string): Promise<UnifiedRole | undefined> {
  if (!FIREBASE_ENABLED || !db) return undefined;
  try {
    const snap = await getDoc(doc(db, UNIFIED_PATHS.user(uid)));
    if (snap.exists()) {
      return snap.data().role as UnifiedRole;
    }
  } catch {
    // non-blocking
  }
  return undefined;
}

/**
 * Fetches role or creates a default user doc (for first-time Google login).
 */
async function fetchOrCreateUserRole(fb: FbUser): Promise<UnifiedRole> {
  const existing = await fetchUserRole(fb.uid);
  if (existing) return existing;

  // Create default admin user
  await createUserDocument(fb, fb.displayName ?? fb.email?.split("@")[0] ?? "User", "admin");
  return "admin";
}

/**
 * Fetches the full unified user profile.
 */
export async function fetchUnifiedUser(uid: string): Promise<UnifiedUser | null> {
  if (!FIREBASE_ENABLED || !db) return null;
  try {
    const snap = await getDoc(doc(db, UNIFIED_PATHS.user(uid)));
    if (snap.exists()) {
      return { uid, ...snap.data() } as UnifiedUser;
    }
  } catch {
    // non-blocking
  }
  return null;
}

/* ==================== Error Mapping ==================== */

function mapError(code: string): string {
  if (code.includes("email-already-in-use")) return "Email already registered";
  if (code.includes("user-not-found")) return "No account found";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong password";
  if (code.includes("popup-closed") || code.includes("cancelled")) return "Sign-in cancelled";
  if (code.includes("too-many-requests")) return "Too many attempts. Try later";
  if (code.includes("network")) return "Network error";
  return "Authentication failed";
}
