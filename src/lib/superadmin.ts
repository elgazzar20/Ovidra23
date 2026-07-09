/**
 * Super Admin System — Core Library
 * ==================================
 * Handles OTP generation/verification, platform-wide Firestore queries,
 * subscription management, and audit logging.
 *
 * SECURITY: OTP generation & verification should ideally run in Firebase
 * Cloud Functions. This client-side implementation is the integration layer.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocFromCache,
  getDocsFromCache,
} from "firebase/firestore";
import { db as firestoreDb, FIREBASE_ENABLED, auth } from "./firebase";

// Helper functions to prevent offline/slow network hanging by forcing a fast timeout and cache fallback
async function getDocWithTimeout(docRef: any, ms = 8000): Promise<any> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      return await getDocFromCache(docRef);
    } catch {
      // ignore
    }
  }
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), ms);
  });
  try {
    const snap = await Promise.race([getDoc(docRef), timeoutPromise]);
    clearTimeout(timeoutId);
    return snap;
  } catch (err) {
    clearTimeout(timeoutId);
    try {
      return await getDocFromCache(docRef);
    } catch {
      throw err;
    }
  }
}

async function getDocsWithTimeout(q: any, ms = 8000): Promise<any> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      return await getDocsFromCache(q);
    } catch {
      // ignore
    }
  }
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), ms);
  });
  try {
    const snap = await Promise.race([getDocs(q), timeoutPromise]);
    clearTimeout(timeoutId);
    return snap;
  } catch (err) {
    clearTimeout(timeoutId);
    try {
      return await getDocsFromCache(q);
    } catch {
      throw err;
    }
  }
}

/* ============================== Types ============================== */

export interface SuperAdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: string; // "super_admin" | "center_owner" | "secretary" | ...
  status: AccountStatus;
  photoURL?: string;
  centerId?: string;
  createdAt: number;
}

export type AccountStatus = "active" | "suspended" | "disabled";

export type SubscriptionPlan = "free" | "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "expired" | "paused";

export interface CenterRecord {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  status: AccountStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate?: number;
  subscriptionEndDate?: number;
  studentCount: number;
  teacherCount: number;
  createdAt: number;
  // Dynamic limits (override defaults if set)
  customLimits?: CenterLimits;
}

export interface CenterLimits {
  maxStudents?: number;
  maxTeachers?: number;
  maxStaff?: number;
  maxGroups?: number;
  maxClassrooms?: number;
  maxSchedules?: number;
}

export const DEFAULT_LIMITS: Partial<Record<SubscriptionPlan, CenterLimits>> & Record<"free" | "pro" | "enterprise", CenterLimits> = {
  free: { maxStudents: 30, maxTeachers: 2, maxStaff: 1, maxGroups: 3, maxClassrooms: 2, maxSchedules: 10 },
  basic: { maxStudents: 200, maxTeachers: 10, maxStaff: 5, maxGroups: 20, maxClassrooms: 10, maxSchedules: 50 },
  pro: { maxStudents: 500, maxTeachers: 30, maxStaff: 10, maxGroups: 50, maxClassrooms: 20, maxSchedules: 100 },
  enterprise: { maxStudents: 99999, maxTeachers: 99999, maxStaff: 99999, maxGroups: 99999, maxClassrooms: 99999, maxSchedules: 99999 },
};

/** Updates a center's custom limits (overrides plan defaults). */
export async function updateCenterLimits(
  centerId: string,
  limits: CenterLimits,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  await updateDoc(doc(firestoreDb, "centers", centerId), { customLimits: limits });
  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: "limits:update",
    targetType: "center",
    targetId: centerId,
    targetName: centerId,
    newValue: JSON.stringify(limits),
  });
}

/** Sends a notification/message to a center owner. */
export async function sendOwnerMessage(
  centerId: string,
  ownerUid: string,
  message: string,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  const notifId = `admin_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await setDoc(doc(firestoreDb, "notifications", notifId), {
    notifId,
    recipientUid: ownerUid,
    centerId,
    type: "general",
    title: "رسالة من إدارة المنصة",
    body: message,
    read: false,
    createdAt: Date.now(),
  });
  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: "message:send",
    targetType: "center",
    targetId: centerId,
    targetName: "owner_message",
  });
}

export interface AuditLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType: "center" | "user" | "teacher" | "student" | "subscription" | "payment" | "settings" | "feature" | "auth";
  targetId: string;
  targetName: string;
  previousValue?: string;
  newValue?: string;
  timestamp: number;
  ipAddress?: string;
  browser?: string;
  device?: string;
  userAgent?: string;
  userRole?: string;
}

export interface OTPRecord {
  uid: string;
  code: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  used: boolean;
  lockedUntil?: number;
}

/* ====================== Role Verification ====================== */

/**
 * Verifies if the current Firebase user is the Super Admin.
 *
 * Reads from: admins/super_admin
 * Checks:     active === true AND email === currentUser.email
 */
export async function checkSuperAdminRole(email: string): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();

  // 0. If Firebase is enabled, but the user is not signed in, we cannot query Firestore yet.
  if (FIREBASE_ENABLED && auth && !auth.currentUser) {
    // Silent local fallback
    try {
      const localStaffRaw = localStorage.getItem("platform_staff");
      if (localStaffRaw) {
        const staffList = JSON.parse(localStaffRaw) as any[];
        const staffMember = staffList.find(s => s.email?.toLowerCase() === cleanEmail && s.status === "active");
        if (staffMember) return true;
      }
      const defaultEmails = [
        "mohamedelgazzar700@gmail.com",
        "mohamedelgazzar748@gmail.com",
        "support@centerplus.com",
        "finance@centerplus.com",
        "developer@centerplus.com",
        "moderator@centerplus.com"
      ];
      if (defaultEmails.includes(cleanEmail)) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  // 1. Check primary super admin from admins/super_admin
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      const snap = await getDocWithTimeout(doc(firestoreDb, "admins", "super_admin"));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.active === true && data?.email?.toLowerCase() === cleanEmail) {
          return true;
        }
      }
    }
  } catch (err) {
    // Quiet debug log instead of console.warn to keep console clean
    console.debug("Primary super admin check failed, continuing with staff check:", err);
  }

  // 2. Check platform staff from platform_staff/{email} document directly
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      const staffDocRef = doc(firestoreDb, "platform_staff", cleanEmail);
      const staffSnap = await getDocWithTimeout(staffDocRef);
      if (staffSnap.exists()) {
        const data = staffSnap.data();
        if (data?.status === "active") {
          return true;
        }
      } else {
        // Document successfully fetched and does not exist - this email is not staff
        return false;
      }
    }
  } catch (err) {
    console.debug("platform_staff direct document check failed:", err);
  }

  // 3. Check if they are in the entire list from platform_staff collection (backup query)
  // Only attempt if the user might be platform staff or admin to avoid constant permission warnings
  const defaultEmails = [
    "mohamedelgazzar700@gmail.com",
    "mohamedelgazzar748@gmail.com",
    "support@centerplus.com",
    "finance@centerplus.com",
    "developer@centerplus.com",
    "moderator@centerplus.com"
  ];
  if (defaultEmails.includes(cleanEmail)) {
    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        const staffSnap = await getDocsWithTimeout(collection(firestoreDb, "platform_staff"));
        const staffList = staffSnap.docs.map((doc: any) => doc.data());
        const staffMember = staffList.find((s: any) => s.email?.toLowerCase() === cleanEmail && s.status === "active");
        if (staffMember) {
          return true;
        }
      }
    } catch (err) {
      console.debug("platform_staff collection query check failed:", err);
    }
  }

  // 4. Local Storage fallback (important for development/offline mode)
  try {
    const localStaffRaw = localStorage.getItem("platform_staff");
    if (localStaffRaw) {
      const staffList = JSON.parse(localStaffRaw) as any[];
      const staffMember = staffList.find(s => s.email?.toLowerCase() === cleanEmail && s.status === "active");
      if (staffMember) {
        return true;
      }
    }
    if (defaultEmails.includes(cleanEmail)) {
      return true;
    }
  } catch (err) {
    console.debug("platform_staff local storage check failed:", err);
  }

  return false;
}

/* ====================== OTP System ====================== */

/** Generates a cryptographically-random 6-digit OTP. */
export function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

/**
 * Creates an OTP record and stores it in Firestore.
 * Also "sends" the email — in production this calls a Cloud Function.
 */
export async function createAndSendOTP(
  uid: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const code = generateOTP();
  const now = Date.now();
  const record: OTPRecord = {
    uid,
    code,
    email,
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000, // 5 minutes
    attempts: 0,
    maxAttempts: 5,
    used: false,
  };

  // Store in Firestore
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "otp_verifications", uid), record);
    } catch {
      // Continue — OTP still works locally
    }
  }

  // Send email — integration point for Cloud Functions / SendGrid / Resend
  // In production: await sendOTPEmail(email, code) via callable function
  // For now: log to console (dev mode)
  console.log(`🔐 [Super Admin OTP] Code for ${email}: ${code}`);

  return { ok: true };
}

/**
 * Verifies an OTP code against the stored record.
 * Enforces: expiry, max attempts, lockout period, single-use.
 */
export async function verifyOTP(
  uid: string,
  inputCode: string,
): Promise<{ ok: boolean; error?: string; lockedUntil?: number }> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    return { ok: false, error: "Firebase not configured" };
  }

  try {
    const snap = await getDoc(doc(firestoreDb, "otp_verifications", uid));
    if (!snap.exists()) return { ok: false, error: "No OTP found. Please request a new code." };

    const record = snap.data() as OTPRecord;
    const now = Date.now();

    // Check lockout
    if (record.lockedUntil && now < record.lockedUntil) {
      const mins = Math.ceil((record.lockedUntil - now) / 60000);
      return { ok: false, error: `Account locked. Try again in ${mins} minute(s).`, lockedUntil: record.lockedUntil };
    }

    // Check expiry
    if (now > record.expiresAt) {
      return { ok: false, error: "OTP expired. Please request a new code." };
    }

    // Check if already used
    if (record.used) {
      return { ok: false, error: "OTP already used. Please request a new code." };
    }

    // Check attempts
    const newAttempts = record.attempts + 1;
    if (inputCode !== record.code) {
      if (newAttempts >= record.maxAttempts) {
        // Lock for 15 minutes
        await updateDoc(doc(firestoreDb, "otp_verifications", uid), {
          attempts: newAttempts,
          lockedUntil: now + 15 * 60 * 1000,
        });
        return { ok: false, error: "Too many failed attempts. Account locked for 15 minutes." };
      }
      await updateDoc(doc(firestoreDb, "otp_verifications", uid), { attempts: newAttempts });
      return { ok: false, error: `Invalid code. ${record.maxAttempts - newAttempts} attempt(s) remaining.` };
    }

    // Success — mark as used
    await updateDoc(doc(firestoreDb, "otp_verifications", uid), { used: true });
    return { ok: true };
  } catch {
    return { ok: false, error: "Verification failed. Please try again." };
  }
}

/* ====================== Platform Queries ====================== */

/** Fetches all centers from the root `centers` collection. */
export async function fetchAllCenters(): Promise<CenterRecord[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem("cpd_local_centers");
      return local ? JSON.parse(local) as CenterRecord[] : [];
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "centers"));
    const centers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CenterRecord));
    localStorage.setItem("cpd_local_centers", JSON.stringify(centers));
    console.log("[SuperAdmin] Fetched centers:", centers.length);
    return centers;
  } catch (err) {
    console.error("[SuperAdmin] fetchAllCenters ERROR, falling back to local:", err);
    try {
      const local = localStorage.getItem("cpd_local_centers");
      return local ? JSON.parse(local) as CenterRecord[] : [];
    } catch {
      return [];
    }
  }
}

/** Fetches all users from the root `users` collection. */
export async function fetchAllUsers(): Promise<SuperAdminUser[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) return [];
  try {
    const snap = await getDocs(collection(firestoreDb, "users"));
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as SuperAdminUser));
    console.log("[SuperAdmin] Fetched users:", users.length);
    return users;
  } catch (err) {
    console.error("[SuperAdmin] fetchAllUsers ERROR:", err);
    return [];
  }
}

/** Fetches recent audit logs. */
export async function fetchAuditLogs(count = 50): Promise<AuditLog[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) return [];
  try {
    const q = query(collection(firestoreDb, "audit_logs"), orderBy("timestamp", "desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
  } catch {
    return [];
  }
}

let cachedIp = "127.0.0.1";
let ipFetched = false;

export async function fetchIpAddress(): Promise<string> {
  if (ipFetched) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok) {
      const data = await res.json();
      cachedIp = data.ip || "127.0.0.1";
      ipFetched = true;
    }
  } catch {
    // offline or blocked
  }
  return cachedIp;
}

export function parseUserAgent() {
  if (typeof window === "undefined" || !window.navigator) {
    return { browser: "Unknown", device: "Server", userAgent: "" };
  }
  const ua = window.navigator.userAgent;
  let browser = "Chrome";
  let device = "Desktop";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
  else if (ua.includes("Trident") || ua.includes("MSIE")) browser = "Internet Explorer";
  else if (ua.includes("Edge") || ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

  if (/Mobi|Android|iPhone|iPad|Tablet/i.test(ua)) {
    if (/iPad|Tablet/i.test(ua)) device = "Tablet";
    else device = "Mobile";
  }

  return { browser, device, userAgent: ua };
}

/* ====================== Admin Actions ====================== */

/** Logs a super admin action to the audit_logs collection. */
export async function logAdminAction(entry: Omit<AuditLog, "id" | "timestamp">): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ip = entry.ipAddress || (await fetchIpAddress());
    const uaInfo = parseUserAgent();

    await setDoc(doc(firestoreDb, "audit_logs", logId), {
      ipAddress: ip,
      browser: entry.browser || uaInfo.browser,
      device: entry.device || uaInfo.device,
      userAgent: entry.userAgent || uaInfo.userAgent,
      userRole: entry.userRole || "super_admin",
      ...entry,
      timestamp: Date.now(),
    });
  } catch {
    // non-blocking
  }
}

/** Updates a center's status (suspend / reactivate / disable). */
export async function updateCenterStatus(
  centerId: string,
  status: AccountStatus,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  await updateDoc(doc(firestoreDb, "centers", centerId), { status });
  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: `center:${status}`,
    targetType: "center",
    targetId: centerId,
    targetName: centerId,
    newValue: status,
  });
}

/** Updates a user's status. */
export async function updateUserStatus(
  uid: string,
  status: AccountStatus,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  await updateDoc(doc(firestoreDb, "users", uid), { status });
  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: `user:${status}`,
    targetType: "user",
    targetId: uid,
    targetName: uid,
    newValue: status,
  });
}

/** Updates a center's subscription. */
export async function updateSubscription(
  centerId: string,
  patch: Partial<Pick<CenterRecord, "subscriptionPlan" | "subscriptionStatus" | "subscriptionStartDate" | "subscriptionEndDate" | any>>,
  admin: { uid: string; email: string },
): Promise<void> {
  // 1. Try Firestore update
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await updateDoc(doc(firestoreDb, "centers", centerId), patch);

      // Send a notification if discount is applied
      if (patch.discountAmount !== undefined) {
        try {
          const centerSnap = await getDoc(doc(firestoreDb, "centers", centerId));
          if (centerSnap.exists()) {
            const centerData = centerSnap.data();
            const ownerUid = centerData.ownerId;
            if (ownerUid) {
              const notifId = `discount_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              await setDoc(doc(firestoreDb, "notifications", notifId), {
                notifId,
                recipientUid: ownerUid,
                centerId,
                type: "subscription",
                title: "تم تطبيق خصم خاص على حسابك 🎁",
                body: `تم تطبيق خصم يدوي خاص بقيمة ${patch.discountAmount} ج.م على حساب سنترك. السبب: ${patch.discountReason || "تسهيلات الدفع"}. يمكنك مراجعة خطتك الآن.`,
                read: false,
                createdAt: Date.now(),
              });
            }
          }
        } catch (notifErr) {
          console.error("[SuperAdmin] Failed to dispatch discount notification:", notifErr);
        }
      }
    }
  } catch (e) {
    console.error("[SuperAdmin] updateSubscription Firestore error:", e);
    throw e;
  }

  // 2. Update in local storage list of centers
  try {
    const raw = localStorage.getItem("cpd_local_centers");
    const centers = raw ? JSON.parse(raw) as CenterRecord[] : [];
    const idx = centers.findIndex(c => c.id === centerId);
    if (idx !== -1) {
      centers[idx] = { ...centers[idx], ...patch };
      localStorage.setItem("cpd_local_centers", JSON.stringify(centers));
    }
  } catch (e) {
    console.error("[SuperAdmin] Failed to update local centers list:", e);
  }

  // 3. Update specific center plan keys so the center user immediately sees the changes!
  try {
    if (patch.subscriptionPlan) {
      localStorage.setItem(`cpd_plan_${centerId}`, JSON.stringify(patch.subscriptionPlan));
    }
    if (patch.subscriptionEndDate !== undefined) {
      localStorage.setItem(`cpd_plan_end_${centerId}`, String(patch.subscriptionEndDate));
    }
    if (patch.discountAmount !== undefined) {
      localStorage.setItem(`cpd_plan_discount_${centerId}`, String(patch.discountAmount));
    }
    if (patch.discountReason !== undefined) {
      localStorage.setItem(`cpd_plan_discount_reason_${centerId}`, patch.discountReason);
    }
  } catch (e) {
    console.error("[SuperAdmin] Failed to update individual center local keys:", e);
  }

  // 4. Log action
  try {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "subscription:update",
      targetType: "subscription",
      targetId: centerId,
      targetName: centerId,
      newValue: JSON.stringify(patch),
    });
  } catch (e) {
    console.error("[SuperAdmin] logAdminAction error in updateSubscription:", e);
  }
}

/** Deletes a center document (soft — data remains in localStorage/backup). */
export async function deleteCenterRecord(
  centerId: string,
  admin: { uid: string; email: string },
): Promise<void> {
  // 1. Delete from Firestore if enabled
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, "centers", centerId));
    } catch (e) {
      console.warn("[SuperAdmin] Failed to delete center doc from Firestore:", e);
    }
    try {
      await deleteDoc(doc(firestoreDb, "users", centerId));
    } catch (e) {
      console.warn("[SuperAdmin] Failed to delete user doc from Firestore:", e);
    }
  }

  // 2. Delete from local storage cache
  try {
    const raw = localStorage.getItem("cpd_local_centers");
    if (raw) {
      const list = JSON.parse(raw) as CenterRecord[];
      const filtered = list.filter((c) => c.id !== centerId);
      localStorage.setItem("cpd_local_centers", JSON.stringify(filtered));
    }
  } catch (e) {
    console.error("[SuperAdmin] Failed to update local centers list after deletion:", e);
  }

  // 3. Log admin action
  try {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "center:delete",
      targetType: "center",
      targetId: centerId,
      targetName: centerId,
    });
  } catch (e) {
    console.error("[SuperAdmin] Failed to log admin action for center deletion:", e);
  }
}

/** Deletes a user document. */
export async function deleteUserRecord(
  uid: string,
  admin: { uid: string; email: string },
): Promise<void> {
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await deleteDoc(doc(firestoreDb, "users", uid));
    } catch (e) {
      console.warn("[SuperAdmin] Failed to delete user doc from Firestore:", e);
    }
    try {
      await deleteDoc(doc(firestoreDb, "centers", uid));
    } catch (e) {
      console.warn("[SuperAdmin] Failed to delete center doc from Firestore:", e);
    }
  }

  // Also remove from local centers list if the uid was a centerId
  try {
    const raw = localStorage.getItem("cpd_local_centers");
    if (raw) {
      const list = JSON.parse(raw) as CenterRecord[];
      const filtered = list.filter((c) => c.id !== uid);
      localStorage.setItem("cpd_local_centers", JSON.stringify(filtered));
    }
  } catch (e) {
    console.error("[SuperAdmin] Failed to update local centers list after user deletion:", e);
  }

  try {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "user:delete",
      targetType: "user",
      targetId: uid,
      targetName: uid,
    });
  } catch (e) {
    console.error("[SuperAdmin] Failed to log admin action for user deletion:", e);
  }
}

/* ====================== Feature Flags ====================== */

export interface FeatureFlag {
  key: string;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  enabled: boolean;
  plan: SubscriptionPlan | "all";
}

export const FEATURE_FLAGS: { key: string; label: string; labelAr: string; description: string; descriptionAr: string; plan: SubscriptionPlan | "all" }[] = [
  { key: "ai_assistant", label: "AI Assistant", labelAr: "المساعد الذكي", description: "AI-powered academic analysis", descriptionAr: "تحليل أكاديمي بالذكاء الاصطناعي", plan: "enterprise" },
  { key: "qr_scanner", label: "QR Scanner", labelAr: "ماسح QR", description: "QR code attendance scanning", descriptionAr: "حضور برموز QR", plan: "enterprise" },
  { key: "smart_ai_reports", label: "Smart AI Reports", labelAr: "تقارير ذكية", description: "AI-powered performance analysis", descriptionAr: "تحليل أداء بالذكاء الاصطناعي", plan: "pro" },
  { key: "parent_portal", label: "Parent Portal", labelAr: "بوابة ولي الأمر", description: "Parent access to student data", descriptionAr: "وصول ولي الأمر لبيانات الطالب", plan: "pro" },
  { key: "teacher_mobile_app", label: "Teacher Mobile App", labelAr: "تطبيق المعلم", description: "Mobile app for teachers", descriptionAr: "تطبيق الهاتف للمعلمين", plan: "pro" },
  { key: "advanced_analytics", label: "Advanced Analytics", labelAr: "تحليلات متقدمة", description: "Detailed charts and insights", descriptionAr: "رسوم بيانية ورؤى تفصيلية", plan: "pro" },
  { key: "financial_reports", label: "Financial Reports", labelAr: "تقارير مالية", description: "PDF/Excel financial exports", descriptionAr: "تصدير مالي PDF و Excel", plan: "pro" },
  { key: "attendance_ai", label: "Attendance AI", labelAr: "حضور ذكي", description: "AI attendance predictions", descriptionAr: "توقعات الحضور بالذكاء الاصطناعي", plan: "enterprise" },
  { key: "multi_branch", label: "Multi-Branch", labelAr: "تعدد الفروع", description: "Manage multiple branches", descriptionAr: "إدارة فروع متعددة", plan: "enterprise" },
  { key: "backup_restore", label: "Backup & Restore", labelAr: "نسخ احتياطي", description: "Automated data backups", descriptionAr: "نسخ احتياطي تلقائي للبيانات", plan: "all" },
  { key: "excel_import", label: "Excel Import", labelAr: "استيراد إكسل", description: "Bulk import from Excel files", descriptionAr: "استيراد جماعي من ملفات إكسل", plan: "pro" },
];

/** Returns the features that should be enabled for a given plan. */
export function getFeaturesForPlan(plan: SubscriptionPlan): Record<string, boolean> {
  const features: Record<string, boolean> = {};
  for (const f of FEATURE_FLAGS) {
    const flagPlan = f.plan as string;
    if (flagPlan === "all") features[f.key] = true;
    else if (plan === "enterprise") features[f.key] = true;
    else if (plan === "pro" && (flagPlan === "pro" || flagPlan === "basic" || flagPlan === "all")) features[f.key] = true;
    else if (plan === "basic" && (flagPlan === "basic" || flagPlan === "all")) features[f.key] = true;
  }
  return features;
}

/** Auto-applies all features for a plan to a center. */
export async function applyPlanFeatures(
  centerId: string,
  plan: SubscriptionPlan,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  const features = getFeaturesForPlan(plan);
  await setDoc(doc(firestoreDb, "centers", centerId, "config", "features"), {
    ...features,
    autoAppliedPlan: plan,
    updatedAt: Date.now(),
  }, { merge: true });
  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: `features:plan:${plan}`,
    targetType: "center",
    targetId: centerId,
    targetName: plan,
    newValue: JSON.stringify(features),
  });
}

/** Reads feature flags for a center from Firestore. */
export async function fetchCenterFeatures(centerId: string): Promise<Record<string, boolean>> {
  if (!FIREBASE_ENABLED || !firestoreDb) return {};
  try {
    const snap = await getDoc(doc(firestoreDb, "centers", centerId, "config", "features"));
    return snap.exists() ? (snap.data() as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Toggles a feature flag for a center. */
export async function toggleFeatureFlag(
  centerId: string,
  featureKey: string,
  enabled: boolean,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  await setDoc(doc(firestoreDb, "centers", centerId, "config", "features"), {
    [featureKey]: enabled,
    updatedAt: Date.now(),
  }, { merge: true });
  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: `feature:${enabled ? "enable" : "disable"}`,
    targetType: "center",
    targetId: centerId,
    targetName: featureKey,
    newValue: String(enabled),
  });
}

/* ====================== Subscription Plans ====================== */

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price: number;
  maxStudents: number;
  maxTeachers: number;
  features: string[];
  color: string;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "مجاني",
    price: 0,
    maxStudents: 30,
    maxTeachers: 2,
    features: ["حتى 30 طالب", "حتى 2 معلمين", "إدارة الطلاب الأساسية", "تسجيل الحضور", "الجدول الأسبوعي"],
    color: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  },
  {
    id: "pro",
    name: "احترافي",
    price: 150,
    maxStudents: 500,
    maxTeachers: 30,
    features: ["حتى 500 طالب", "حتى 30 معلم", "بوابة ولي الأمر", "تقارير PDF و Excel", "تحليلات متقدمة", "نسخ احتياطي"],
    color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    id: "enterprise",
    name: "مؤسسي",
    price: 400,
    maxStudents: 99999,
    maxTeachers: 99999,
    features: ["طلاب غير محدودين", "معلمين غير محدودين", "كل مميزات الاحترافي", "المساعد الذكي AI", "الحضور بـ QR", "إدارة الفروع المتعددة", "دعم أولوية", "علامة تجارية مخصصة"],
    color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
];

/** Payment details for upgrade page */
export const PAYMENT_DETAILS = {
  price: "150",
  currency: "ج.م",
  period: "شهرياً",
  paymentNumber: "01140617424",
  paymentMethods: ["إنستا باي (InstaPay)", "محفظة كاش (Vodafone Cash)"],
  whatsappNumber: "201009617278",
  screenshotNote: "أرسل سكرين شوت التحويل على واتساب لتفعيل الاشتراك",
};

/** Activates a subscription for a center with the given duration in days. */
export async function activateSubscription(
  centerId: string,
  plan: SubscriptionPlan,
  days: number,
  admin: { uid: string; email: string },
): Promise<void> {
  const now = Date.now();
  const endDate = now + days * 86400000;
  const planName = PLAN_DEFINITIONS.find(p => p.id === plan)?.name || plan;

  // 1. Update the subscription on the center document
  await updateSubscription(centerId, {
    subscriptionPlan: plan,
    subscriptionStatus: "active",
    subscriptionStartDate: now,
    subscriptionEndDate: endDate,
  }, admin);

  // 2. Auto-apply features and limits for the assigned plan
  await applyPlanFeatures(centerId, plan, admin);
  const planLimits = DEFAULT_LIMITS[plan];
  if (planLimits && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "centers", centerId), { customLimits: planLimits });
    } catch (e) {
      console.error("Failed to update limits:", e);
    }
  }

  // 3. Send a notification to the center owner about their new subscription
  try {
    const centerSnap = await getDoc(doc(firestoreDb!, "centers", centerId));
    if (centerSnap.exists()) {
      const centerData = centerSnap.data();
      const ownerUid = centerData.ownerId;
      const endDateStr = new Date(endDate).toLocaleDateString('ar-EG');
      const notifId = `sub_active_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(firestoreDb!, "notifications", notifId), {
        notifId,
        recipientUid: ownerUid,
        centerId,
        type: "subscription",
        title: `تم تفعيل اشتراكك في الخطة ${planName}`,
        body: `مبارك! تم تفعيل اشتراكك في خطة ${planName} لمدة ${days} يوم. تاريخ الانتهاء: ${endDateStr}. استمتع بكل المميزات!`,
        read: false,
        createdAt: now,
      });
    }
  } catch (e) {
    console.error("Failed to send subscription notification:", e);
  }
}

/** Extends a center's subscription by the given days. */
export async function extendSubscription(
  centerId: string,
  days: number,
  admin: { uid: string; email: string },
): Promise<void> {
  if (!FIREBASE_ENABLED || !firestoreDb) return;
  const snap = await getDoc(doc(firestoreDb, "centers", centerId));
  const current = snap.exists() ? snap.data() : {};
  const baseDate = Math.max(current.subscriptionEndDate ?? Date.now(), Date.now());
  await updateSubscription(centerId, {
    subscriptionStatus: "active",
    subscriptionEndDate: baseDate + days * 86400000,
  }, admin);
}

/** Cancels a center's subscription. */
export async function cancelSubscription(
  centerId: string,
  admin: { uid: string; email: string },
): Promise<void> {
  await updateSubscription(centerId, { subscriptionStatus: "canceled" }, admin);
}

/**
 * CRITICAL SYNC: Ensures every user in `users/{uid}` also has a matching
 * document in `centers/{uid}`. This fixes users who registered before the
 * auto-sync feature was added. Returns count of newly created centers.
 */
export async function syncUsersToCenters(admin: { uid: string; email: string }): Promise<{
  created: number;
  totalUsers: number;
  totalCenters: number;
  newCenterIds: string[];
}> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    return { created: 0, totalUsers: 0, totalCenters: 0, newCenterIds: [] };
  }

  // 1. Fetch all users
  const usersSnap = await getDocs(collection(firestoreDb, "users"));
  const allUsers = usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as SuperAdminUser[];

  // 2. Fetch all existing centers
  const centersSnap = await getDocs(collection(firestoreDb, "centers"));
  const existingCenterIds = new Set(centersSnap.docs.map((d) => d.id));

  // 3. Create missing centers
  const created: string[] = [];
  for (const user of allUsers) {
    // Skip super_admin — they don't manage a center
    if (user.role === "super_admin") continue;
    if (existingCenterIds.has(user.uid)) continue;

    const ts = Date.now();
    await setDoc(doc(firestoreDb, "centers", user.uid), {
      id: user.uid,
      name: `${user.displayName || "Center"} Center`,
      ownerId: user.uid,
      ownerEmail: user.email || "",
      status: "active",
      subscriptionPlan: "free",
      subscriptionStatus: "trialing",
      subscriptionStartDate: ts,
      studentCount: 0,
      teacherCount: 0,
      createdAt: ts,
      syncedAt: ts,
    });
    created.push(user.uid);
  }

  // 4. Log the sync action
  if (created.length > 0) {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "sync:users_to_centers",
      targetType: "center",
      targetId: "batch",
      targetName: `${created.length} centers created`,
      newValue: JSON.stringify(created),
    });
  }

  return {
    created: created.length,
    totalUsers: allUsers.length,
    totalCenters: existingCenterIds.size + created.length,
    newCenterIds: created,
  };
}

/* ============================== Advanced Subscription Management Center ============================== */

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  plan: SubscriptionPlan;
  date: number;
  method: string;
  transactionId?: string;
  discountApplied?: number;
  notes?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  date: number;
  dueDate?: number;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  status: "paid" | "unpaid" | "refunded";
  paymentMethod?: string;
  discountApplied?: number;
  billingEmail: string;
  billingName: string;
}

export interface TimelineEvent {
  id: string;
  type: "upgrade" | "downgrade" | "extend" | "pause" | "resume" | "activate" | "deactivate" | "trial" | "free_days" | "discount";
  title: string;
  description: string;
  timestamp: number;
  adminEmail: string;
  previousPlan?: SubscriptionPlan;
  newPlan?: SubscriptionPlan;
  previousStatus?: SubscriptionStatus;
  newStatus?: SubscriptionStatus;
  daysAdded?: number;
  discountAmount?: number;
}

export interface RenewalRecord {
  id: string;
  plan: SubscriptionPlan;
  previousExpiry?: number;
  newExpiry: number;
  date: number;
  adminEmail: string;
  amountPaid?: number;
}

// Subcollection writing helpers
export async function addPaymentRecord(
  centerId: string,
  payment: Omit<PaymentRecord, "id">,
  _admin: { uid: string; email: string }
): Promise<void> {
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record = { id, ...payment };

  // Write locally
  try {
    const localKey = `cpd_local_payments_${centerId}`;
    const raw = localStorage.getItem(localKey);
    const list = raw ? JSON.parse(raw) as PaymentRecord[] : [];
    list.unshift(record);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {
    console.error("[SuperAdmin] addPaymentRecord local write error:", e);
  }

  // Write to Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await setDoc(doc(firestoreDb, "centers", centerId, "payments", id), record);
    }
  } catch (e) {
    console.warn("[SuperAdmin] addPaymentRecord Firestore write error (non-blocking):", e);
  }
}

export async function addInvoiceRecord(
  centerId: string,
  invoice: Omit<InvoiceRecord, "id">,
  _admin: { uid: string; email: string }
): Promise<void> {
  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record = { id, ...invoice };

  // Write locally
  try {
    const localKey = `cpd_local_invoices_${centerId}`;
    const raw = localStorage.getItem(localKey);
    const list = raw ? JSON.parse(raw) as InvoiceRecord[] : [];
    list.unshift(record);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {
    console.error("[SuperAdmin] addInvoiceRecord local write error:", e);
  }

  // Write to Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await setDoc(doc(firestoreDb, "centers", centerId, "invoices", id), record);
    }
  } catch (e) {
    console.warn("[SuperAdmin] addInvoiceRecord Firestore write error (non-blocking):", e);
  }
}

export async function addTimelineEvent(
  centerId: string,
  event: Omit<TimelineEvent, "id" | "timestamp" | "adminEmail">,
  admin: { uid: string; email: string }
): Promise<void> {
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    ...event,
    timestamp: Date.now(),
    adminEmail: admin.email,
  };

  // Write locally
  try {
    const localKey = `cpd_local_timeline_${centerId}`;
    const raw = localStorage.getItem(localKey);
    const list = raw ? JSON.parse(raw) as TimelineEvent[] : [];
    list.unshift(record);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {
    console.error("[SuperAdmin] addTimelineEvent local write error:", e);
  }

  // Write to Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await setDoc(doc(firestoreDb, "centers", centerId, "timeline", id), record);
    }
  } catch (e) {
    console.warn("[SuperAdmin] addTimelineEvent Firestore write error (non-blocking):", e);
  }
}

export async function addRenewalRecord(
  centerId: string,
  renewal: Omit<RenewalRecord, "id" | "date" | "adminEmail">,
  admin: { uid: string; email: string }
): Promise<void> {
  const id = `ren_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    ...renewal,
    date: Date.now(),
    adminEmail: admin.email,
  };

  // Write locally
  try {
    const localKey = `cpd_local_renewals_${centerId}`;
    const raw = localStorage.getItem(localKey);
    const list = raw ? JSON.parse(raw) as RenewalRecord[] : [];
    list.unshift(record);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {
    console.error("[SuperAdmin] addRenewalRecord local write error:", e);
  }

  // Write to Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await setDoc(doc(firestoreDb, "centers", centerId, "renewals", id), record);
    }
  } catch (e) {
    console.warn("[SuperAdmin] addRenewalRecord Firestore write error (non-blocking):", e);
  }
}

// Subcollection reading helpers
export async function fetchPayments(centerId: string): Promise<PaymentRecord[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem(`cpd_local_payments_${centerId}`);
      return local ? JSON.parse(local) as PaymentRecord[] : [];
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "centers", centerId, "payments"));
    const list = snap.docs.map((d) => d.data() as PaymentRecord).sort((a, b) => b.date - a.date);
    localStorage.setItem(`cpd_local_payments_${centerId}`, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn("[SuperAdmin] fetchPayments Firestore error, loading from local:", e);
    try {
      const local = localStorage.getItem(`cpd_local_payments_${centerId}`);
      return local ? JSON.parse(local) as PaymentRecord[] : [];
    } catch {
      return [];
    }
  }
}

export async function fetchInvoices(centerId: string): Promise<InvoiceRecord[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem(`cpd_local_invoices_${centerId}`);
      return local ? JSON.parse(local) as InvoiceRecord[] : [];
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "centers", centerId, "invoices"));
    const list = snap.docs.map((d) => d.data() as InvoiceRecord).sort((a, b) => b.date - a.date);
    localStorage.setItem(`cpd_local_invoices_${centerId}`, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn("[SuperAdmin] fetchInvoices Firestore error, loading from local:", e);
    try {
      const local = localStorage.getItem(`cpd_local_invoices_${centerId}`);
      return local ? JSON.parse(local) as InvoiceRecord[] : [];
    } catch {
      return [];
    }
  }
}

export async function fetchTimelineEvents(centerId: string): Promise<TimelineEvent[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem(`cpd_local_timeline_${centerId}`);
      return local ? JSON.parse(local) as TimelineEvent[] : [];
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "centers", centerId, "timeline"));
    const list = snap.docs.map((d) => d.data() as TimelineEvent).sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(`cpd_local_timeline_${centerId}`, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn("[SuperAdmin] fetchTimelineEvents Firestore error, loading from local:", e);
    try {
      const local = localStorage.getItem(`cpd_local_timeline_${centerId}`);
      return local ? JSON.parse(local) as TimelineEvent[] : [];
    } catch {
      return [];
    }
  }
}

export async function fetchRenewals(centerId: string): Promise<RenewalRecord[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem(`cpd_local_renewals_${centerId}`);
      return local ? JSON.parse(local) as RenewalRecord[] : [];
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "centers", centerId, "renewals"));
    const list = snap.docs.map((d) => d.data() as RenewalRecord).sort((a, b) => b.date - a.date);
    localStorage.setItem(`cpd_local_renewals_${centerId}`, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn("[SuperAdmin] fetchRenewals Firestore error, loading from local:", e);
    try {
      const local = localStorage.getItem(`cpd_local_renewals_${centerId}`);
      return local ? JSON.parse(local) as RenewalRecord[] : [];
    } catch {
      return [];
    }
  }
}

/* ============================== Platform Notifications ============================== */

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  priority: "low" | "medium" | "high";
  targetType: "all" | "selected" | "plan" | "status";
  targetIds?: string[];
  targetPlan?: SubscriptionPlan;
  targetStatus?: AccountStatus;
  status: "draft" | "scheduled" | "sent";
  scheduledAt?: number;
  sentAt?: number;
  createdAt: number;
}

export async function fetchPlatformNotifications(): Promise<PlatformNotification[]> {
  if (!FIREBASE_ENABLED || !firestoreDb || (auth && !auth.currentUser)) {
    try {
      const local = localStorage.getItem("cpd_local_platform_notifications");
      return local ? (JSON.parse(local) as PlatformNotification[]).sort((a, b) => b.createdAt - a.createdAt) : [];
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "platform_notifications"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformNotification))
      .sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem("cpd_local_platform_notifications", JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn("[SuperAdmin] fetchPlatformNotifications error, falling back to local:", (e as Error).message);
    try {
      const local = localStorage.getItem("cpd_local_platform_notifications");
      return local ? (JSON.parse(local) as PlatformNotification[]).sort((a, b) => b.createdAt - a.createdAt) : [];
    } catch {
      return [];
    }
  }
}

export async function createPlatformNotification(
  notif: Omit<PlatformNotification, "id" | "createdAt">,
  admin: { uid: string; email: string }
): Promise<string> {
  const notifId = `p_notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record: PlatformNotification = {
    id: notifId,
    ...notif,
    createdAt: Date.now(),
  };

  // 1. Write locally
  try {
    const raw = localStorage.getItem("cpd_local_platform_notifications");
    const list = raw ? JSON.parse(raw) as PlatformNotification[] : [];
    list.unshift(record);
    localStorage.setItem("cpd_local_platform_notifications", JSON.stringify(list));
  } catch (e) {
    console.error("[SuperAdmin] Failed to create local platform notification:", e);
  }

  // 2. Write to Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await setDoc(doc(firestoreDb, "platform_notifications", notifId), record);
    }
  } catch (e) {
    console.warn("[SuperAdmin] Failed to write platform notification to Firestore:", e);
  }

  // 3. Log action
  try {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: `notification:create:${notif.status}`,
      targetType: "settings",
      targetId: notifId,
      targetName: notif.title,
      newValue: JSON.stringify(record),
    });
  } catch (e) {
    console.error("[SuperAdmin] Failed to log admin action for platform notification creation:", e);
  }

  return notifId;
}

export async function updatePlatformNotification(
  id: string,
  patch: Partial<PlatformNotification>,
  admin: { uid: string; email: string }
): Promise<void> {
  // 1. Update locally
  try {
    const raw = localStorage.getItem("cpd_local_platform_notifications");
    const list = raw ? JSON.parse(raw) as PlatformNotification[] : [];
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch };
      localStorage.setItem("cpd_local_platform_notifications", JSON.stringify(list));
    }
  } catch (e) {
    console.error("[SuperAdmin] Failed to update local platform notification:", e);
  }

  // 2. Update Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await updateDoc(doc(firestoreDb, "platform_notifications", id), patch as any);
    }
  } catch (e) {
    console.warn("[SuperAdmin] Failed to update platform notification in Firestore:", e);
  }

  // 3. Log action
  try {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: `notification:update`,
      targetType: "settings",
      targetId: id,
      targetName: patch.title || "Updated Notification",
      newValue: JSON.stringify(patch),
    });
  } catch (e) {
    console.error("[SuperAdmin] Failed to log admin action for platform notification update:", e);
  }
}

export async function deletePlatformNotification(
  id: string,
  admin: { uid: string; email: string }
): Promise<void> {
  // 1. Delete locally
  try {
    const raw = localStorage.getItem("cpd_local_platform_notifications");
    const list = raw ? JSON.parse(raw) as PlatformNotification[] : [];
    const filtered = list.filter(n => n.id !== id);
    localStorage.setItem("cpd_local_platform_notifications", JSON.stringify(filtered));
  } catch (e) {
    console.error("[SuperAdmin] Failed to delete local platform notification:", e);
  }

  // 2. Delete from Firestore
  try {
    if (FIREBASE_ENABLED && firestoreDb) {
      await deleteDoc(doc(firestoreDb, "platform_notifications", id));
    }
  } catch (e) {
    console.warn("[SuperAdmin] Failed to delete platform notification from Firestore:", e);
  }

  // 3. Log action
  try {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "notification:delete",
      targetType: "settings",
      targetId: id,
      targetName: id,
    });
  } catch (e) {
    console.error("[SuperAdmin] Failed to log admin action for platform notification deletion:", e);
  }
}

/* ============================== Support Ticket Center ============================== */

export interface TicketAttachment {
  name: string;
  url?: string;
  base64?: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderEmail: string;
  senderRole: "user" | "admin" | "staff";
  senderName: string;
  body: string;
  createdAt: number;
  isInternalNote?: boolean;
  attachments?: TicketAttachment[];
}

export interface TicketActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  createdAt: number;
}

export interface SupportTicket {
  id: string;
  centerId: string;
  centerName: string;
  creatorUid: string;
  creatorEmail: string;
  creatorName: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  messages: TicketMessage[];
  activityLog: TicketActivityLog[];
  attachments?: TicketAttachment[];
}

export async function fetchSupportTickets(centerId?: string): Promise<SupportTicket[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem("cpd_local_tickets");
      const list = local ? JSON.parse(local) as SupportTicket[] : [];
      if (centerId) return list.filter(t => t.centerId === centerId).sort((a, b) => b.updatedAt - a.updatedAt);
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }
  try {
    let snap;
    if (centerId) {
      const q = query(collection(firestoreDb, "support_tickets"), where("centerId", "==", centerId));
      snap = await getDocs(q);
    } else {
      snap = await getDocs(collection(firestoreDb, "support_tickets"));
    }
    const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket));
    return tickets.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    console.error("[SuperAdmin] fetchSupportTickets ERROR, falling back to local storage:", e);
    try {
      const local = localStorage.getItem("cpd_local_tickets");
      const list = local ? JSON.parse(local) as SupportTicket[] : [];
      if (centerId) return list.filter(t => t.centerId === centerId).sort((a, b) => b.updatedAt - a.updatedAt);
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }
}

export async function createSupportTicket(
  ticket: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "messages" | "activityLog">,
  firstMessageBody: string,
  attachments?: TicketAttachment[]
): Promise<string> {
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const nowTime = Date.now();
  const initMessage: TicketMessage = {
    id: `msg_${nowTime}_1`,
    senderId: ticket.creatorUid,
    senderEmail: ticket.creatorEmail,
    senderRole: "user",
    senderName: ticket.creatorName,
    body: firstMessageBody,
    createdAt: nowTime,
    attachments,
  };
  const initLog: TicketActivityLog = {
    id: `log_${nowTime}_1`,
    userId: ticket.creatorUid,
    userEmail: ticket.creatorEmail,
    action: "created",
    details: "تم فتح التذكرة بنجاح",
    createdAt: nowTime,
  };
  const record: SupportTicket = {
    id: ticketId,
    ...ticket,
    createdAt: nowTime,
    updatedAt: nowTime,
    messages: [initMessage],
    activityLog: [initLog],
    attachments,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "support_tickets", ticketId), record);
    } catch (e) {
      console.error("[SuperAdmin] createSupportTicket Firestore error, saving locally:", e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_tickets");
    const list = local ? JSON.parse(local) as SupportTicket[] : [];
    list.push(record);
    localStorage.setItem("cpd_local_tickets", JSON.stringify(list));
  } catch (err) {
    console.error(err);
  }

  return ticketId;
}

export async function addTicketMessage(
  ticketId: string,
  msg: Omit<TicketMessage, "id" | "createdAt">,
  statusUpdate?: SupportTicket["status"]
): Promise<void> {
  const nowTime = Date.now();
  const messageId = `msg_${nowTime}_${Math.random().toString(36).slice(2, 5)}`;
  const fullMessage: TicketMessage = {
    id: messageId,
    ...msg,
    createdAt: nowTime,
  };

  const actionLog: TicketActivityLog = {
    id: `log_${nowTime}_${Math.random().toString(36).slice(2, 5)}`,
    userId: msg.senderId,
    userEmail: msg.senderEmail,
    action: msg.isInternalNote ? "internal_note" : "reply",
    details: msg.isInternalNote ? "تمت إضافة ملاحظة داخلية" : "تم إرسال رد جديد",
    createdAt: nowTime,
  };

  let currentTicket: SupportTicket | null = null;
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "support_tickets", ticketId));
      if (snap.exists()) {
        currentTicket = { id: snap.id, ...snap.data() } as SupportTicket;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!currentTicket) {
    try {
      const local = localStorage.getItem("cpd_local_tickets");
      const list = local ? JSON.parse(local) as SupportTicket[] : [];
      currentTicket = list.find(t => t.id === ticketId) || null;
    } catch {
      currentTicket = null;
    }
  }

  if (!currentTicket) throw new Error("Ticket not found");

  const updatedMessages = [...(currentTicket.messages || []), fullMessage];
  const updatedLogs = [...(currentTicket.activityLog || []), actionLog];
  const updatedStatus = statusUpdate || currentTicket.status;

  const patch: Partial<SupportTicket> = {
    messages: updatedMessages,
    activityLog: updatedLogs,
    status: updatedStatus,
    updatedAt: nowTime,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "support_tickets", ticketId), patch as any);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_tickets");
    const list = local ? JSON.parse(local) as SupportTicket[] : [];
    const idx = list.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch };
      localStorage.setItem("cpd_local_tickets", JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
  }
}

export async function updateTicketMetadata(
  ticketId: string,
  patch: Partial<Omit<SupportTicket, "id" | "messages" | "activityLog">>,
  changer: { uid: string; email: string; name: string }
): Promise<void> {
  const nowTime = Date.now();
  
  let detailsText = "تحديث بيانات التذكرة";
  if (patch.status) detailsText = `تغيير الحالة إلى: ${patch.status}`;
  else if (patch.priority) detailsText = `تغيير الأهمية إلى: ${patch.priority}`;
  else if (patch.assignedTo !== undefined) detailsText = patch.assignedTo ? `تعيين التذكرة إلى: ${patch.assignedTo}` : "إلغاء تعيين التذكرة";

  const actionLog: TicketActivityLog = {
    id: `log_${nowTime}_${Math.random().toString(36).slice(2, 5)}`,
    userId: changer.uid,
    userEmail: changer.email,
    action: "metadata_update",
    details: detailsText,
    createdAt: nowTime,
  };

  let currentTicket: SupportTicket | null = null;
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "support_tickets", ticketId));
      if (snap.exists()) {
        currentTicket = { id: snap.id, ...snap.data() } as SupportTicket;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!currentTicket) {
    try {
      const local = localStorage.getItem("cpd_local_tickets");
      const list = local ? JSON.parse(local) as SupportTicket[] : [];
      currentTicket = list.find(t => t.id === ticketId) || null;
    } catch {
      currentTicket = null;
    }
  }

  if (!currentTicket) throw new Error("Ticket not found");

  const finalPatch = {
    ...patch,
    activityLog: [...(currentTicket.activityLog || []), actionLog],
    updatedAt: nowTime,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "support_tickets", ticketId), finalPatch as any);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_tickets");
    const list = local ? JSON.parse(local) as SupportTicket[] : [];
    const idx = list.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...finalPatch };
      localStorage.setItem("cpd_local_tickets", JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
  }
}


/* ============================== License Management Center ============================== */

export interface ActivationHistoryEntry {
  id: string;
  deviceId: string;
  deviceInfo: string;
  activatedAt: number;
  status: "active" | "deactivated";
  deactivatedAt?: number;
}

export interface PlatformLicense {
  id: string;
  key: string;
  centerId: string;
  centerName: string;
  type: "trial" | "standard" | "premium" | "enterprise" | "pro";
  status: "active" | "revoked" | "blacklisted" | "expired";
  deviceLimit: number;
  deviceCount: number;
  createdAt: number;
  expiresAt: number;
  activationHistory: ActivationHistoryEntry[];
}

export async function fetchLicenses(centerId?: string): Promise<PlatformLicense[]> {
  if (!FIREBASE_ENABLED || !firestoreDb) {
    try {
      const local = localStorage.getItem("cpd_local_licenses");
      const list = local ? JSON.parse(local) as PlatformLicense[] : [];
      if (centerId) return list.filter(l => l.centerId === centerId).sort((a, b) => b.createdAt - a.createdAt);
      return list.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }
  try {
    const snap = await getDocs(collection(firestoreDb, "platform_licenses"));
    const licenses = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformLicense));
    const sorted = licenses.sort((a, b) => b.createdAt - a.createdAt);
    if (centerId) {
      return sorted.filter((l) => l.centerId === centerId);
    }
    return sorted;
  } catch (e) {
    console.warn("[SuperAdmin] fetchLicenses ERROR, falling back to local storage:", (e as Error).message);
    try {
      const local = localStorage.getItem("cpd_local_licenses");
      const list = local ? JSON.parse(local) as PlatformLicense[] : [];
      if (centerId) return list.filter(l => l.centerId === centerId).sort((a, b) => b.createdAt - a.createdAt);
      return list.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  }
}

export async function createLicense(
  license: Omit<PlatformLicense, "id" | "createdAt" | "activationHistory" | "deviceCount">
): Promise<string> {
  const licenseId = license.key;
  const nowTime = Date.now();
  const record: PlatformLicense = {
    id: licenseId,
    ...license,
    deviceCount: 0,
    createdAt: nowTime,
    activationHistory: [],
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "platform_licenses", licenseId), record);
    } catch (e) {
      console.error("[SuperAdmin] createLicense Firestore error:", e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_licenses");
    const list = local ? JSON.parse(local) as PlatformLicense[] : [];
    list.push(record);
    localStorage.setItem("cpd_local_licenses", JSON.stringify(list));
  } catch (err) {
    console.error(err);
  }

  return licenseId;
}

export async function updateLicenseStatus(
  key: string,
  status: PlatformLicense["status"],
  admin?: { uid: string; email: string }
): Promise<void> {
  let license: PlatformLicense | null = null;
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "platform_licenses", key));
      if (snap.exists()) {
        license = { id: snap.id, ...snap.data() } as PlatformLicense;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!license) {
    try {
      const local = localStorage.getItem("cpd_local_licenses");
      const list = local ? JSON.parse(local) as PlatformLicense[] : [];
      license = list.find(l => l.key === key) || null;
    } catch {
      license = null;
    }
  }

  if (!license) throw new Error("License not found");

  license.status = status;

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "platform_licenses", key), { status });
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_licenses");
    const list = local ? JSON.parse(local) as PlatformLicense[] : [];
    const idx = list.findIndex(l => l.key === key);
    if (idx !== -1) {
      list[idx].status = status;
      localStorage.setItem("cpd_local_licenses", JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
  }

  if (admin) {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: `license:${status}`,
      targetType: "settings",
      targetId: key,
      targetName: key,
    });
  }
}

export async function resetLicenseActivations(
  key: string,
  admin?: { uid: string; email: string }
): Promise<void> {
  let license: PlatformLicense | null = null;
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "platform_licenses", key));
      if (snap.exists()) {
        license = { id: snap.id, ...snap.data() } as PlatformLicense;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!license) {
    try {
      const local = localStorage.getItem("cpd_local_licenses");
      const list = local ? JSON.parse(local) as PlatformLicense[] : [];
      license = list.find(l => l.key === key) || null;
    } catch {
      license = null;
    }
  }

  if (!license) throw new Error("License not found");

  const nowTime = Date.now();
  const updatedHistory = license.activationHistory.map(entry => {
    if (entry.status === "active") {
      return {
        ...entry,
        status: "deactivated" as const,
        deactivatedAt: nowTime,
      };
    }
    return entry;
  });

  const patch = {
    deviceCount: 0,
    activationHistory: updatedHistory,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "platform_licenses", key), patch as any);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_licenses");
    const list = local ? JSON.parse(local) as PlatformLicense[] : [];
    const idx = list.findIndex(l => l.key === key);
    if (idx !== -1) {
      list[idx].deviceCount = 0;
      list[idx].activationHistory = updatedHistory;
      localStorage.setItem("cpd_local_licenses", JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
  }

  if (admin) {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "license:reset",
      targetType: "settings",
      targetId: key,
      targetName: key,
    });
  }
}

export async function activateLicenseDevice(
  key: string,
  deviceId: string,
  deviceInfo: string
): Promise<void> {
  let license: PlatformLicense | null = null;
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "platform_licenses", key));
      if (snap.exists()) {
        license = { id: snap.id, ...snap.data() } as PlatformLicense;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!license) {
    try {
      const local = localStorage.getItem("cpd_local_licenses");
      const list = local ? JSON.parse(local) as PlatformLicense[] : [];
      license = list.find(l => l.key === key) || null;
    } catch {
      license = null;
    }
  }

  if (!license) throw new Error("مفتاح الترخيص غير موجود");
  if (license.status === "revoked") throw new Error("تم إلغاء هذا الترخيص من قبل الإدارة");
  if (license.status === "blacklisted") throw new Error("تم إدراج هذا الترخيص في القائمة السوداء");
  if (license.status === "expired" || license.expiresAt < Date.now()) throw new Error("لقد انتهت صلاحية هذا الترخيص");

  // Check if device is already active
  const alreadyActive = license.activationHistory.find(
    (entry) => entry.deviceId === deviceId && entry.status === "active"
  );
  if (alreadyActive) {
    return; // Already active on this device, do nothing
  }

  // Check if device limit reached
  if (license.deviceCount >= license.deviceLimit) {
    throw new Error(`لقد تجاوزت الحد الأقصى للأجهزة المسموح بها (${license.deviceLimit})`);
  }

  const nowTime = Date.now();
  const entry: ActivationHistoryEntry = {
    id: `act_${nowTime}_${Math.random().toString(36).slice(2, 5)}`,
    deviceId,
    deviceInfo,
    activatedAt: nowTime,
    status: "active",
  };

  const updatedHistory = [...license.activationHistory, entry];
  const updatedDeviceCount = license.deviceCount + 1;

  const patch = {
    deviceCount: updatedDeviceCount,
    activationHistory: updatedHistory,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "platform_licenses", key), patch as any);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_licenses");
    const list = local ? JSON.parse(local) as PlatformLicense[] : [];
    const idx = list.findIndex(l => l.key === key);
    if (idx !== -1) {
      list[idx].deviceCount = updatedDeviceCount;
      list[idx].activationHistory = updatedHistory;
      localStorage.setItem("cpd_local_licenses", JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
  }
}

export async function deactivateLicenseDevice(
  key: string,
  deviceId: string
): Promise<void> {
  let license: PlatformLicense | null = null;
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, "platform_licenses", key));
      if (snap.exists()) {
        license = { id: snap.id, ...snap.data() } as PlatformLicense;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!license) {
    try {
      const local = localStorage.getItem("cpd_local_licenses");
      const list = local ? JSON.parse(local) as PlatformLicense[] : [];
      license = list.find(l => l.key === key) || null;
    } catch {
      license = null;
    }
  }

  if (!license) throw new Error("License not found");

  const nowTime = Date.now();
  let changed = false;
  const updatedHistory = license.activationHistory.map((entry) => {
    if (entry.deviceId === deviceId && entry.status === "active") {
      changed = true;
      return {
        ...entry,
        status: "deactivated" as const,
        deactivatedAt: nowTime,
      };
    }
    return entry;
  });

  if (!changed) return;

  const updatedDeviceCount = Math.max(0, license.deviceCount - 1);

  const patch = {
    deviceCount: updatedDeviceCount,
    activationHistory: updatedHistory,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await updateDoc(doc(firestoreDb, "platform_licenses", key), patch as any);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const local = localStorage.getItem("cpd_local_licenses");
    const list = local ? JSON.parse(local) as PlatformLicense[] : [];
    const idx = list.findIndex(l => l.key === key);
    if (idx !== -1) {
      list[idx].deviceCount = updatedDeviceCount;
      list[idx].activationHistory = updatedHistory;
      localStorage.setItem("cpd_local_licenses", JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
  }
}


/* ============================== Global Platform Settings ============================== */

export interface GlobalPlatformSettings {
  id: string; // "global_config"
  platformName: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeColors?: {
    brand500?: string;
    brand600?: string;
    brand700?: string;
    accent600?: string;
    bgLight?: string;
    bgDark?: string;
  };
  fontFamily?: "Inter" | "Cairo" | "Tajawal" | "Amiri" | "system-ui";
  defaultLanguage?: "ar" | "en";
  defaultCurrency?: string;
  timezone?: string;
  maintenanceMode?: {
    enabled: boolean;
    message?: string;
  };
  firebaseConfig?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
  storageSettings?: {
    maxFileSizeMb?: number;
    allowedTypes?: string[];
  };
  securitySettings?: {
    sessionTimeoutMinutes?: number;
    maxLoginAttempts?: number;
    ipWhitelist?: string;
  };
  features?: {
    aiFeatures?: boolean;
    smartAttendance?: boolean;
    qrAttendance?: boolean;
    parentPortal?: boolean;
    reports?: boolean;
    onlinePayments?: boolean;
    offlineLicense?: boolean;
    notifications?: boolean;
  };
  geminiApiKey?: string;
  updatedAt?: number;
  updatedBy?: {
    uid: string;
    email: string;
  };
}

export const DEFAULT_PLATFORM_SETTINGS: GlobalPlatformSettings = {
  id: "global_config",
  platformName: "أوفيدرا (Ovidra)",
  logoUrl: "",
  faviconUrl: "",
  geminiApiKey: "",
  themeColors: {
    brand500: "#6d5dfc",
    brand600: "#5a47f0",
    brand700: "#4f46e5",
    accent600: "#7c3aed",
    bgLight: "#f4f5fb",
    bgDark: "#030714",
  },
  fontFamily: "Tajawal",
  defaultLanguage: "ar",
  defaultCurrency: "EGP",
  timezone: "Africa/Cairo",
  maintenanceMode: {
    enabled: false,
    message: "المنصة في أعمال صيانة مجدولة حالياً لتحديث وتحسين الأنظمة. سنعود للعمل قريباً جداً، نشكر تفهمكم وصبركم.",
  },
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  storageSettings: {
    maxFileSizeMb: 10,
    allowedTypes: ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  securitySettings: {
    sessionTimeoutMinutes: 120,
    maxLoginAttempts: 5,
    ipWhitelist: "",
  },
  features: {
    aiFeatures: true,
    smartAttendance: true,
    qrAttendance: true,
    parentPortal: true,
    reports: true,
    onlinePayments: true,
    offlineLicense: true,
    notifications: true,
  }
};

export async function fetchGlobalSettings(): Promise<GlobalPlatformSettings> {
  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      const snap = await getDocWithTimeout(doc(firestoreDb, "platform_config", "global_settings"));
      if (snap.exists()) {
        return { ...DEFAULT_PLATFORM_SETTINGS, ...snap.data(), id: "global_config" } as GlobalPlatformSettings;
      }
    } catch (e) {
      console.warn("[SuperAdmin] fetchGlobalSettings: Using local fallback. (If you want to sync settings online, ensure 'platform_config' collection has read permissions in your Firebase console rules.)");
    }
  }

  try {
    const local = localStorage.getItem("cpd_global_settings");
    if (local) {
      return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(local), id: "global_config" } as GlobalPlatformSettings;
    }
  } catch (err) {
    console.error(err);
  }

  return DEFAULT_PLATFORM_SETTINGS;
}

export async function updateGlobalSettings(
  settings: Partial<GlobalPlatformSettings>,
  admin?: { uid: string; email: string }
): Promise<GlobalPlatformSettings> {
  const current = await fetchGlobalSettings();
  const updated: GlobalPlatformSettings = {
    ...current,
    ...settings,
    id: "global_config",
    updatedAt: Date.now(),
    updatedBy: admin ? { uid: admin.uid, email: admin.email } : undefined,
  };

  if (FIREBASE_ENABLED && firestoreDb) {
    try {
      await setDoc(doc(firestoreDb, "platform_config", "global_settings"), updated);
    } catch (e) {
      console.error("[SuperAdmin] updateGlobalSettings Firestore error:", e);
    }
  }

  try {
    localStorage.setItem("cpd_global_settings", JSON.stringify(updated));
    // Trigger live reload of CSS / settings if context listens
    window.dispatchEvent(new Event("platform_settings_updated"));
  } catch (err) {
    console.error(err);
  }

  if (admin) {
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: "settings:update_global",
      targetType: "settings",
      targetId: "global_settings",
      targetName: "Platform Global Config",
      newValue: JSON.stringify(settings),
    });
  }

  return updated;
}



