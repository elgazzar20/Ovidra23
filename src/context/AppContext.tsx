import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DatabaseShape,
  UserRbac,
  Role,
  SyncStatus,
  SyncLogEntry,
  Student,
  Teacher,
  Group,
  Classroom,
  ScheduleEvent,
  AttendanceRecord,
  Payment,
  Expense,
  Exam,
  ExamGrade,
  Assignment,
  StudentNote,
  Branch,
  CardTheme,
} from "../lib/types";
import { translate, type Lang } from "../i18n/translations";
import {
  loadDb,
  persistDb,
  seedDb,
  emptyDb,
  now,
  uid,
  saveBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  downloadBackupFile,
  parseBackupFile,
  restoreFromFile,
  dbKeyFor,
  migrateOldIds,
  type BackupMeta,
  type BackupFile,
} from "../lib/db";
import { nextGrade, obfuscate } from "../lib/constants";
import { auth, db as firestoreDb, FIREBASE_ENABLED, pushRecord, deleteRecord } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User as FbUser,
  signInAnonymously,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { verifyLicenseKey } from "../lib/license";
import { fetchGlobalSettings, checkSuperAdminRole, type GlobalPlatformSettings } from "../lib/superadmin";
import { pushToast } from "../components/ui";

/* collections that are arrays of stamped records */
type Collections = {
  students: Student;
  teachers: Teacher;
  groups: Group;
  classrooms: Classroom;
  scheduleEvents: ScheduleEvent;
  attendance: AttendanceRecord;
  payments: Payment;
  expenses: Expense;
  exams: Exam;
  examGrades: ExamGrade;
  assignments: Assignment;
  studentNotes: StudentNote;
  branches: Branch;
  cardThemes: CardTheme;
};
type CollKey = keyof Collections;

export const ALL_PERMS = [
  "students.manage",
  "teachers.manage",
  "classes.manage",
  "schedule.manage",
  "attendance.manage",
  "finance.manage",
  "exams.manage",
  "staff.manage",
  "settings.manage",
  "reports.view",
  "reports.send",
  "revenue.teachers",
  "revenue.center",
  "data.add",
  "data.delete",
  "ai.use",
] as const;
export type Permission = (typeof ALL_PERMS)[number];

export const ROLE_PERMS: Record<Role, Permission[]> = {
  OWNER: [...ALL_PERMS],
  ADMIN: [...ALL_PERMS],
  SECRETARY: [
    "students.manage",
    "attendance.manage",
    "finance.manage",
    "classes.manage",
    "schedule.manage",
    "reports.view",
    "reports.send",
    "revenue.center",
    "data.add",
    "data.delete",
    "ai.use",
  ],
  TEACHER: ["attendance.manage", "exams.manage", "reports.view", "ai.use"],
  PARENT: [],
  STUDENT: [],
  super_admin: [], // super admin has its own dashboard, no regular permissions
};

export interface StaffLogItem {
  op: string; // e.g. "students:create"
  label: string; // human readable target, e.g. a student name
  at: number;
}
export interface StaffStat {
  count: number;
  lastAt: number;
  lastOp: string;
  log: StaffLogItem[];
}

const DEMO_CENTER = "demo-center-futureminds";

/* --------------------------- staff activity log ------------------------- */
const ACTIVITY_KEY = (cid: string) => `cpd_activity_${cid}`;
function loadActivity(cid: string): Record<string, StaffStat> {
  const raw = loadPref<Record<string, Omit<StaffStat, "log"> & { log?: StaffLogItem[] }>>(ACTIVITY_KEY(cid), {});
  // backfill log for older saved data
  const out: Record<string, StaffStat> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = { ...v, log: v.log ?? [] };
  return out;
}
function saveActivity(cid: string, data: Record<string, StaffStat>) {
  try {
    localStorage.setItem(ACTIVITY_KEY(cid), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

interface AppContextValue {
  // i18n
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  // theme
  theme: "light" | "dark";
  toggleTheme: () => void;
  // font scale (accessibility)
  fontScale: "small" | "medium" | "large";
  setFontScale: (s: "small" | "medium" | "large") => void;
  // auth
  user: UserRbac | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
  demoAccess: (as: "owner" | "secretary" | "parent") => void;
  inviteStaff: (email: string, name: string, password: string, role: Role, perms: Permission[], opts?: { salary?: number; title?: string }) => { ok: boolean; error?: string; uid?: string };
  updateStaff: (uid: string, patch: Partial<UserRbac>) => void;
  staff: UserRbac[];
  staffActivity: Record<string, StaffStat>;
  deleteStaff: (uid: string) => void;
  sendStaffMessage: (toUid: string, text: string) => void;
  can: (perm: Permission) => boolean;
  canAdd: () => boolean;
  canDelete: () => boolean;
  canAddStudent: () => boolean;
  canAddTeacher: () => boolean;
  // subscription gating
  subscriptionPlan: "free" | "pro" | "enterprise";
  subscriptionEndDate?: number;
  discountAmount?: number;
  discountReason?: string;
  subscriptionStatus?: string;
  centerStatus?: string;
  isSubscriptionExpired?: boolean;
  clockTampered?: boolean;
  refreshSubscriptionPlan: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
  activateLicenseKey?: (key: string) => { ok: boolean; error?: string };
  globalSettings?: GlobalPlatformSettings | null;
  // branches
  currentBranchId: string;
  switchBranch: (branchId: string) => void;
  // portals
  centerId: string;
  DEMO_CENTER: string;
  portalCenterId: string | null;
  loginAsStudent: (code: string) => Promise<Student | null>;
  loginAsTeacher: (code: string) => Promise<Teacher | null>;
  resetPortalSession: () => void;
  // data
  db: DatabaseShape;
  upsert: <K extends CollKey>(coll: K, item: Collections[K]) => void;
  remove: <K extends CollKey>(coll: K, id: string) => void;
  updateProfile: (patch: Partial<DatabaseShape["profile"]>) => void;
  resetData: () => void;
  replaceDb: (db: DatabaseShape) => void;
  // ID card templates
  cardThemes: CardTheme[];
  activeCardTheme: string;
  setActiveCardTheme: (id: string) => void;
  restoreBackupFromFile: (file: File) => Promise<boolean>;
  // academic year
  promoteYear: () => { promoted: number; skipped: number; backupTs: number };
  // backup
  backups: BackupMeta[];
  createBackup: (label?: string) => void;
  restoreFromBackup: (ts: number) => void;
  removeBackup: (ts: number) => void;
  exportBackup: () => void;
  // sync
  syncStatus: SyncStatus;
  online: boolean;
  setOnline: (b: boolean) => void;
  lastSync: number;
  syncLog: SyncLogEntry[];
  pendingCount: number;
  flushNow: () => void;
}

const Ctx = createContext<AppContextValue | null>(null);

/* ----------------------------- preferences ------------------------------ */
function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------ user store ------------------------------ */
const USERS_KEY = "cpd_users";
const SESSION_KEY = "cpd_session";

function loadUsers(): UserRbac[] {
  return loadPref<UserRbac[]>(USERS_KEY, []);
}
function saveUsers(u: UserRbac[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => loadPref("cpd_lang", "ar"));
  const [theme, setTheme] = useState<"light" | "dark">(() => loadPref("cpd_theme", "light"));
  const [fontScale, setFontScaleState] = useState<"small" | "medium" | "large">(() => loadPref("cpd_font", "medium"));
  const [user, setUser] = useState<UserRbac | null>(() => {
    const uidSession = loadPref<string | null>(SESSION_KEY, null);
    const users = loadUsers();
    return uidSession ? users.find((u) => u.uid === uidSession) ?? null : null;
  });
  const [users, setUsers] = useState<UserRbac[]>(() => loadUsers());

  const [fbUser, setFbUser] = useState<FbUser | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
    });
    return unsub;
  }, []);

  const [portalCenterId, setPortalCenterId] = useState<string | null>(null);
  const centerId = user?.centerId ?? portalCenterId ?? DEMO_CENTER;
  const [currentBranchId, setCurrentBranchId] = useState<string>(() => loadPref("cpd_branch", "main"));
  const [subscriptionPlan, setSubscriptionPlanState] = useState<"free" | "pro" | "enterprise">(() => loadPref(`cpd_plan_${centerId}`, "free"));
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<number | undefined>(() => {
    const val = localStorage.getItem(`cpd_plan_end_${centerId}`);
    return val ? Number(val) : undefined;
  });
  const [discountAmount, setDiscountAmount] = useState<number | undefined>(() => {
    const val = localStorage.getItem(`cpd_plan_discount_${centerId}`);
    return val ? Number(val) : undefined;
  });
  const [discountReason, setDiscountReason] = useState<string | undefined>(() => {
    const val = localStorage.getItem(`cpd_plan_discount_reason_${centerId}`);
    return val ?? undefined;
  });
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>(() => {
    const val = localStorage.getItem(`cpd_plan_status_${centerId}`);
    return val ? JSON.parse(val) : "trialing";
  });
  const [centerStatus, setCenterStatus] = useState<string>(() => {
    const val = localStorage.getItem(`cpd_center_status_${centerId}`);
    return val ? JSON.parse(val) : "active";
  });

  const [customFeatures, setCustomFeatures] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`cpd_features_${centerId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [customLimits, setCustomLimits] = useState<{ maxStudents: number; maxTeachers: number; maxStaff: number } | undefined>(() => {
    try {
      const val = localStorage.getItem(`cpd_custom_limits_${centerId}`);
      return val ? JSON.parse(val) : undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    try {
      const savedFeat = localStorage.getItem(`cpd_features_${centerId}`);
      setCustomFeatures(savedFeat ? JSON.parse(savedFeat) : {});
    } catch {
      setCustomFeatures({});
    }
    try {
      const savedLim = localStorage.getItem(`cpd_custom_limits_${centerId}`);
      setCustomLimits(savedLim ? JSON.parse(savedLim) : undefined);
    } catch {
      setCustomLimits(undefined);
    }
  }, [centerId]);

  const [secureTimeWatermark, setSecureTimeWatermark] = useState<number>(() => {
    if (centerId === DEMO_CENTER) return Date.now();
    const key = `cpd_secure_time_watermark_${centerId}`;
    const stored = localStorage.getItem(key);
    const storedTime = stored ? Number(stored) : 0;
    const currentTime = Date.now();
    const watermark = Math.max(currentTime, storedTime);
    if (watermark > storedTime) {
      localStorage.setItem(key, String(watermark));
    }
    return watermark;
  });

  const clockTampered = false;

  const isSubscriptionExpired = useMemo(() => {
    if (centerId === DEMO_CENTER) return false;
    if (!subscriptionEndDate) return false;
    return secureTimeWatermark > subscriptionEndDate;
  }, [subscriptionEndDate, centerId, secureTimeWatermark]);

  useEffect(() => {
    if (centerId === DEMO_CENTER) return;
    const key = `cpd_secure_time_watermark_${centerId}`;
    const updateWatermark = () => {
      const stored = localStorage.getItem(key);
      const storedTime = stored ? Number(stored) : 0;
      const currentTime = Date.now();
      const nextWatermark = Math.max(currentTime, storedTime);
      if (nextWatermark > storedTime) {
        localStorage.setItem(key, String(nextWatermark));
        setSecureTimeWatermark(nextWatermark);
      }
    };
    updateWatermark();
    const interval = setInterval(updateWatermark, 10000);
    return () => clearInterval(interval);
  }, [centerId]);
  const effectiveDbKey = dbKeyFor(centerId, currentBranchId);
  const [db, setDb] = useState<DatabaseShape>(() => {
    const existing = loadDb(centerId);
    if (centerId === DEMO_CENTER) {
      return existing ?? seedDb(DEMO_CENTER);
    }
    return existing ?? emptyDb(centerId, "My Center");
  });

  const [online, setOnlineState] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<GlobalPlatformSettings | null>(null);

  const loadGlobalSettings = useCallback(() => {
    fetchGlobalSettings().then((settings) => {
      setGlobalSettings(settings);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadGlobalSettings();
    window.addEventListener("platform_settings_updated", loadGlobalSettings);
    return () => window.removeEventListener("platform_settings_updated", loadGlobalSettings);
  }, [loadGlobalSettings]);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
  const [lastSync, setLastSync] = useState<number>(() => now());
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [staffActivity, setStaffActivity] = useState<Record<string, StaffStat>>(() => loadActivity(centerId));
  const flushTimer = useRef<number | null>(null);

  /** Log a detailed audit event to the platform audit log */
  const logPlatformEvent = useCallback(async (
    action: string,
    targetType: "center" | "user" | "teacher" | "student" | "subscription" | "payment" | "settings" | "feature" | "auth",
    targetId: string,
    targetName: string,
    previousValue?: any,
    newValue?: any,
    overrideUser?: { uid: string; email: string; role: string }
  ) => {
    try {
      const { logAdminAction } = await import("../lib/superadmin");
      await logAdminAction({
        adminUid: overrideUser?.uid || user?.uid || "anonymous",
        adminEmail: overrideUser?.email || user?.email || "anonymous@ovidra.com",
        action,
        targetType,
        targetId,
        targetName,
        previousValue: previousValue ? (typeof previousValue === "string" ? previousValue : JSON.stringify(previousValue)) : undefined,
        newValue: newValue ? (typeof newValue === "string" ? newValue : JSON.stringify(newValue)) : undefined,
        userRole: overrideUser?.role || user?.role || "anonymous",
      });
    } catch (err) {
      console.error("logPlatformEvent failed", err);
    }
  }, [user]);

  const syncLocalDbToCloud = useCallback(async (cId: string, currentDb: DatabaseShape) => {
    if (!FIREBASE_ENABLED || !firestoreDb || cId === DEMO_CENTER) return;
    console.log(`[syncLocalDbToCloud] Starting full sync for center ${cId}`);
    try {
      const collectionsToSync = [
        { localKey: "students", path: "students" },
        { localKey: "teachers", path: "teachers" },
        { localKey: "groups", path: "groups" },
        { localKey: "classrooms", path: "classrooms" },
        { localKey: "scheduleEvents", path: "schedule_events" },
        { localKey: "attendance", path: "attendance" },
        { localKey: "payments", path: "payments" },
        { localKey: "expenses", path: "expenses" },
        { localKey: "exams", path: "exams" },
        { localKey: "examGrades", path: "exam_grades" },
        { localKey: "assignments", path: "assignments" },
        { localKey: "studentNotes", path: "student_notes" },
        { localKey: "branches", path: "branches" },
        { localKey: "cardThemes", path: "card_themes" },
      ];

      const centerRef = doc(firestoreDb, "centers", cId);
      await setDoc(centerRef, {
        id: cId,
        name: currentDb.profile.name || "My Center",
        currency: currentDb.profile.currency || "EGP",
        ownerId: cId,
        ownerEmail: auth?.currentUser?.email || "",
        status: "active",
        studentCount: currentDb.students.length,
        teacherCount: currentDb.teachers.length,
        updatedAt: Date.now(),
      }, { merge: true });

      for (const col of collectionsToSync) {
        const list = (currentDb as any)[col.localKey] || [];
        for (const item of list) {
          if (item.id) {
            const itemPath = `centers/${cId}/${col.path}/${item.id}`;
            await pushRecord(itemPath, item);

            if (col.localKey === "students") {
              const globalPath = `students/${item.id}`;
              const unifiedStudent = {
                studentCode: item.id,
                fullName: item.name || "",
                grade: item.grade || "",
                phone: item.studentPhone || "",
                parentPhone: item.parentPhone || "",
                parentUid: item.parentUid || null,
                parentName: item.parentName || "",
                centerId: cId,
                branchId: currentBranchId || "main",
                teacherIds: item.teachers?.map((t: any) => t.teacherId) || [],
                groupIds: item.groupIds || [],
                createdAt: item.registrationDate || Date.now(),
                updatedAt: Date.now(),
              };
              await pushRecord(globalPath, unifiedStudent);
            }

            if (col.localKey === "teachers") {
              const globalPath = `teachers/${item.id}`;
              const unifiedTeacher = {
                id: item.id,
                name: item.name || "",
                email: item.email || "",
                phone: item.phone || "",
                subjects: item.subjects || [],
                centerId: cId,
                updatedAt: Date.now(),
              };
              await pushRecord(globalPath, unifiedTeacher);
            }
          }
        }
      }
      console.log(`[syncLocalDbToCloud] Completed full database sync to cloud for center: ${cId}`);
    } catch (error) {
      console.error("[syncLocalDbToCloud] Failed database sync:", error);
    }
  }, [currentBranchId]);

  useEffect(() => {
    if (fbUser && user && user.role === "OWNER" && centerId === fbUser.uid) {
      void syncLocalDbToCloud(centerId, db);
    }
  }, [fbUser?.uid, user?.uid, centerId, db, syncLocalDbToCloud]);

  /** Bump the acting user's activity stat and append a readable log item. */
  const recordActivity = useCallback(
    (op: string, label = "") => {
      if (!user) return;
      setStaffActivity((prev) => {
        const cur = prev[user.uid] ?? { count: 0, lastAt: 0, lastOp: "", log: [] as StaffLogItem[] };
        const item: StaffLogItem = { op, label, at: now() };
        const next = {
          ...prev,
          [user.uid]: {
            count: cur.count + 1,
            lastAt: item.at,
            lastOp: op,
            log: [item, ...(cur.log ?? [])].slice(0, 50),
          },
        };
        saveActivity(centerId, next);
        return next;
      });
    },
    [user, centerId],
  );

  // ONE-TIME MIGRATION: Migrate any old student and teacher IDs to 6-character alphanumeric ones
  useEffect(() => {
    setDb(prev => {
      const migrated = migrateOldIds(prev);
      if (migrated !== prev) {
        persistDb(centerId, migrated);
        return migrated;
      }
      return prev;
    });
  }, [centerId]);

  /* --------------------------- effects: prefs --------------------------- */
  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = lang === "ar" 
      ? "اوفيدرا - نظام إدارة السنتر المتكامل" 
      : "Ovidra - Integrated Center Management System";
    localStorage.setItem("cpd_lang", JSON.stringify(lang));
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("cpd_theme", JSON.stringify(theme));
  }, [theme]);

  // font scale — applies a root font-size multiplier for accessibility
  useEffect(() => {
    const scale = fontScale === "small" ? "0.9" : fontScale === "large" ? "1.12" : "1";
    document.documentElement.style.fontSize = `${parseFloat(scale) * 100}%`;
    localStorage.setItem("cpd_font", JSON.stringify(fontScale));
  }, [fontScale]);

  const setFontScale = useCallback((s: "small" | "medium" | "large") => setFontScaleState(s), []);

  /* load the right database whenever center or branch changes */
  useEffect(() => {
    let existing = loadDb(effectiveDbKey);

    // Self-healing: if this is a real user center (not demo-center), but it contains mock seed data, reset it to empty
    if (centerId !== DEMO_CENTER && existing && (
      existing.profile.name === "Future Minds Center" ||
      existing.teachers.some(t => t.email && t.email.includes("futureminds.edu"))
    )) {
      console.warn(`[Self-Healing] Detected mock seed data in real center ${centerId}. Resetting to empty database...`);
      existing = emptyDb(effectiveDbKey, user?.displayName || "My Center");
      persistDb(effectiveDbKey, existing);
    }

    // migration: backfill branches for older datasets
    if (existing && (!existing.branches || existing.branches.length === 0)) {
      existing = {
        ...existing,
        branches: [{ id: "main", name: existing.profile.name || "Main Branch", isMain: true, lastUpdated: now() }],
      };
    }
    if (centerId === DEMO_CENTER) {
      setDb(existing ?? seedDb(effectiveDbKey));
    } else {
      setDb(existing ?? emptyDb(effectiveDbKey, user?.displayName || "My Center"));
    }
    setBackups(listBackups(effectiveDbKey));
    setSyncLog([]);
    setStaffActivity(loadActivity(centerId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDbKey]);

  /** Switch to a different branch — loads its isolated dataset. */
  const switchBranch = useCallback((branchId: string) => {
    localStorage.setItem("cpd_branch", JSON.stringify(branchId));
    setCurrentBranchId(branchId);
  }, []);

  /* persist db whenever it changes (fast, debounced) */
  const persistTimer = useRef<number | null>(null);
  useEffect(() => {
    // Only persist if the database profile center ID matches the active center ID.
    // This prevents race conditions during login/logout from writing demo data to a new user's space.
    if (db.profile.centerId !== centerId) {
      return;
    }
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => persistDb(effectiveDbKey, db), 120);
  }, [db, effectiveDbKey, centerId]);

  /* ------------------------------ sync engine --------------------------- */
  const flush = useCallback(() => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    setSyncStatus("syncing");
    flushTimer.current = window.setTimeout(() => {
      setSyncLog((prev) => prev.map((e) => (e.status === "queued" ? { ...e, status: "pushed" } : e)));
      setLastSync(now());
      setSyncStatus(online ? "online" : "offline");
    }, 300);
  }, [online]);

  // when coming back online, flush queued writes
  useEffect(() => {
    if (online) {
      const hasQueued = syncLog.some((e) => e.status === "queued");
      if (hasQueued) flush();
      else setSyncStatus("online");
    } else {
      setSyncStatus("offline");
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const queueSync = useCallback(
    (path: string, op: SyncLogEntry["op"]) => {
      const entry: SyncLogEntry = { id: uid("sync"), path, op, at: now(), status: "queued" };
      setSyncLog((prev) => [entry, ...prev].slice(0, 60));
      if (online) flush();
    },
    [flush, online],
  );

  /* ------------------------------- i18n -------------------------------- */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((p) => (p === "en" ? "ar" : "en")), []);

  /* ------------------------------- theme ------------------------------- */
  const toggleTheme = useCallback(() => setTheme((p) => (p === "light" ? "dark" : "light")), []);

  /* -------------------------------- auth ------------------------------- */
  const beginSession = useCallback((u: UserRbac) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(u.uid));
    setUser(u);
    
    // Synchronously set subscription plan state to avoid transition lag or demo leaks
    const cid = u.centerId || u.uid;
    if (cid && cid !== DEMO_CENTER) {
      const storedPlan = loadPref(`cpd_plan_${cid}`, "free") as "free" | "pro" | "enterprise";
      setSubscriptionPlanState(storedPlan);
      
      const storedEndDate = localStorage.getItem(`cpd_plan_end_${cid}`);
      setSubscriptionEndDate(storedEndDate ? Number(storedEndDate) : undefined);
      
      const storedStatus = localStorage.getItem(`cpd_plan_status_${cid}`);
      setSubscriptionStatus(storedStatus ? JSON.parse(storedStatus) : "trialing");
    }
  }, []);

  const ensureSeeded = useCallback((cId: string) => {
    if (!loadDb(cId)) persistDb(cId, seedDb(cId));
  }, []);

  /** Maps a Firebase Auth error code to our local error keys. */
  const mapFbError = (code: string, rawError?: any): string => {
    console.error("[Firebase Auth Error Details]:", { code, rawError });
    if (code.includes("email-already-in-use")) return "email-exists";
    if (code.includes("user-not-found")) return "no-account";
    if (code.includes("wrong-password") || code.includes("invalid-credential")) return "wrong-password";
    if (code.includes("popup-closed") || code.includes("cancelled")) return "cancelled";
    if (code.includes("unauthorized-domain")) return "unauthorized-domain";
    return "network-error";
  };

  /** Ensures a centers/{uid} document exists in Firestore for a new user.
   *  This makes the user appear in the Super Admin dashboard as a "center". */
  const ensureCenterDocument = useCallback(
    async (uid: string, email: string, displayName: string): Promise<void> => {
      if (!FIREBASE_ENABLED || !firestoreDb) {
        console.warn("[ensureCenterDocument] Firebase not enabled, skipping");
        return;
      }
      try {
        const centerRef = doc(firestoreDb, "centers", uid);
        const centerSnap = await getDoc(centerRef);
        if (!centerSnap.exists()) {
          console.log("[ensureCenterDocument] Creating centers/" + uid + " for " + email);
          await setDoc(centerRef, {
            id: uid,
            name: `${displayName}'s Center`,
            ownerId: uid,
            ownerEmail: email,
            status: "active",
            subscriptionPlan: "free",
            subscriptionStatus: "trialing",
            subscriptionStartDate: Date.now(),
            studentCount: 0,
            teacherCount: 0,
            createdAt: Date.now(),
          });
          console.log("[ensureCenterDocument] SUCCESS: centers/" + uid + " created");
        } else {
          console.log("[ensureCenterDocument] centers/" + uid + " already exists");
        }
      } catch (err) {
        console.error("[ensureCenterDocument] FAILED:", err);
      }
    },
    [],
  );

  /** Creates or retrieves the local RBAC user for a Firebase user.
   *  Seeds an EMPTY database (not demo data) so each account is truly isolated. */
  const upsertLocalRbacFromFirebase = useCallback(
    (fb: FbUser): UserRbac => {
      const list = loadUsers();
      const normEmail = fb.email?.trim().toLowerCase();
      const existing = list.find((u) => u.uid === fb.uid || (normEmail && u.email.trim().toLowerCase() === normEmail));
      if (existing) {
        if (existing.uid !== fb.uid) {
          existing.uid = fb.uid;
          existing.centerId = existing.centerId === existing.uid ? fb.uid : existing.centerId;
          existing.ownerId = existing.ownerId === existing.uid ? fb.uid : existing.ownerId;
          saveUsers(list);
        }
        return existing;
      }

      const ts = now();
      const displayName = fb.displayName ?? fb.email?.split("@")[0] ?? "User";
      const newOwner: UserRbac = {
        uid: fb.uid,
        email: fb.email ?? "",
        displayName,
        role: "OWNER",
        centerId: fb.uid,
        ownerId: fb.uid,
        permissions: ROLE_PERMS.OWNER,
        photoUrl: fb.photoURL ?? undefined,
        active: true,
        createdAt: ts,
        lastUpdated: ts,
      };
      // Seed an EMPTY database — each real account starts fresh, not with demo data
      persistDb(fb.uid, emptyDb(fb.uid, displayName));
      const next = [...list, newOwner];
      saveUsers(next);
      setUsers(next);
      // Also create the centers/{uid} document in Firestore
      void ensureCenterDocument(fb.uid, fb.email ?? "", displayName);
      return newOwner;
    },
    [ensureCenterDocument],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const normEmail = email.trim().toLowerCase();
        const list = loadUsers();
        if (list.some((u) => u.email.trim().toLowerCase() === normEmail)) {
          return { ok: false, error: "email-exists" };
        }
        if (!auth) {
          return { ok: false, error: "firebase-not-configured" };
        }
        // 1. Firebase Auth: create the account (this is the critical step)
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const fb = cred.user;

        // 2. Firestore: create users/{uid} document — NON-BLOCKING
        //    If this fails (security rules, network), the account is still valid.
        if (FIREBASE_ENABLED && firestoreDb) {
          try {
            await setDoc(doc(firestoreDb, "users", fb.uid), {
              uid: fb.uid,
              email,
              displayName: name,
              role: "center_owner",
              createdAt: Date.now(),
            });
          } catch {
            // Firestore write failed (rules?) — continue with local account
          }
        }

        // 3. Local-first: create isolated RBAC + empty database
        const ts = now();
        const owner: UserRbac = {
          uid: fb.uid,
          email,
          displayName: name,
          role: "OWNER",
          centerId: fb.uid,
          ownerId: fb.uid,
          permissions: ROLE_PERMS.OWNER,
          active: true,
          createdAt: ts,
          lastUpdated: ts,
        };
        // EMPTY database — not demo data — so each user's data is truly their own
        persistDb(fb.uid, emptyDb(fb.uid, name));
        const next = [...list, owner];
        saveUsers(next);
        setUsers(next);
        // 4. Create centers/{uid} document so this user appears in Super Admin
        await ensureCenterDocument(fb.uid, email, name);
        beginSession(owner);
        logPlatformEvent("signup", "auth", owner.uid, owner.email, undefined, undefined, { uid: owner.uid, email: owner.email, role: owner.role });
        return { ok: true };
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? "";
        return { ok: false, error: mapFbError(code, err) };
      }
    },
    [beginSession, ensureCenterDocument],
  );

  /** Checks Firestore for super_admin role, then signs in normally. */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        // First check if this is a sub-account (invited staff) saved in the local users list
        const list = loadUsers();
        const localMatch = list.find((u) => u.email.toLowerCase() === email.toLowerCase());

        if (localMatch && localMatch.password) {
          // Verify against obfuscated password or plain password (with trim as safety)
          const trimmedPass = password.trim();
          if (
            localMatch.password === obfuscate(password) || 
            localMatch.password === obfuscate(trimmedPass) ||
            localMatch.password === password ||
            localMatch.password === trimmedPass
          ) {
            if (!localMatch.active) return { ok: false, error: "inactive" };
            beginSession(localMatch);
            return { ok: true };
          } else {
            return { ok: false, error: "wrong-password" };
          }
        }

        if (!auth) {
          return { ok: false, error: "firebase-not-configured" };
        }
        // 1. Firebase: authenticate with email + password
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const fb = cred.user;

        // 2. Check if this is a Super Admin or Platform Staff
        const isSuperAdminUser = fb.email ? await checkSuperAdminRole(fb.email) : false;

        // 3. If super_admin, create RBAC with that role
        if (isSuperAdminUser) {
          const list = loadUsers();
          const ts = now();
          const adminUser: UserRbac = {
            uid: fb.uid,
            email: fb.email ?? "",
            displayName: fb.displayName ?? "Super Admin",
            role: "super_admin" as Role,
            centerId: "super_admin",
            ownerId: fb.uid,
            permissions: [],
            active: true,
            createdAt: ts,
            lastUpdated: ts,
          };
          const next = [...list.filter((u) => u.uid !== fb.uid), adminUser];
          saveUsers(next);
          setUsers(next);
          beginSession(adminUser);
          logPlatformEvent("login", "auth", adminUser.uid, adminUser.email, undefined, undefined, { uid: adminUser.uid, email: adminUser.email, role: adminUser.role });
          return { ok: true };
        }

        // 4. Normal flow: look up or create the RBAC user
        const rbacUser = upsertLocalRbacFromFirebase(fb);
        // Ensure centers/{uid} document exists
        ensureCenterDocument(fb.uid, fb.email ?? "", fb.displayName ?? rbacUser.displayName);
        if (!rbacUser.active) return { ok: false, error: "inactive" };
        beginSession(rbacUser);
        logPlatformEvent("login", "auth", rbacUser.uid, rbacUser.email, undefined, undefined, { uid: rbacUser.uid, email: rbacUser.email, role: rbacUser.role });
        return { ok: true };
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? "";
        return { ok: false, error: mapFbError(code, err) };
      }
    },
    [beginSession, upsertLocalRbacFromFirebase, ensureCenterDocument],
  );

  const signInWithGoogle = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (!auth) {
        return { ok: false, error: "firebase-not-configured" };
      }
      
      let fb;
      // If we are running in Electron, use the external browser loopback flow
      if (window.navigator.userAgent.includes("Electron")) {
        await fetch("http://127.0.0.1:3000/auth/google-clear", { method: "POST" });
        window.open("http://127.0.0.1:3000/auth/google", "_blank");

        // Show a temporary visual indication
        pushToast(lang === "ar" ? "يرجى إتمام تسجيل الدخول في متصفح كروم المفتوح..." : "Please complete the login in your open browser...", "info");

        // Poll for callback result
        const credentialResult = await new Promise<any>((resolve, reject) => {
          let tries = 0;
          const poll = setInterval(async () => {
            tries++;
            if (tries > 120) { // 2 minutes timeout
              clearInterval(poll);
              reject(new Error(lang === "ar" ? "انتهت مهلة تسجيل الدخول. يرجى المحاولة مجدداً." : "Sign-in timed out. Please try again."));
            }
             try {
              const res = await fetch("http://127.0.0.1:3000/auth/google-status");
              const data = await res.json();
              if (data.error) {
                clearInterval(poll);
                reject(new Error(data.error));
              } else if (data.result) {
                clearInterval(poll);
                resolve(data.result);
              }
            } catch (e) {
              // Ignore network errors during polling
            }
          }, 1000);
        });

        // Sign in using the received token
        const credential = GoogleAuthProvider.credential(credentialResult.idToken);
        const cred = await signInWithCredential(auth, credential);
        fb = cred.user;
      } else {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        fb = cred.user;
      }

      // Create Firestore users/{uid} document if it doesn't exist — NON-BLOCKING
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          const userDocRef = doc(firestoreDb, "users", fb.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: fb.uid,
              email: fb.email ?? "",
              displayName: fb.displayName ?? "Google User",
              photoURL: fb.photoURL ?? "",
              role: "center_owner",
              createdAt: Date.now(),
            });
          }
        } catch {
          // Firestore write failed — continue with local account
        }
      }

      // Check if this is a Super Admin or Platform Staff
      const isSuperAdminUser = fb.email ? await checkSuperAdminRole(fb.email) : false;
      if (isSuperAdminUser) {
        const list = loadUsers();
        const ts = now();
        const adminUser: UserRbac = {
          uid: fb.uid,
          email: fb.email ?? "",
          displayName: fb.displayName ?? "Super Admin",
          role: "super_admin" as Role,
          centerId: "super_admin",
          ownerId: fb.uid,
          permissions: [],
          active: true,
          createdAt: ts,
          lastUpdated: ts,
        };
        const next = [...list.filter((u) => u.uid !== fb.uid), adminUser];
        saveUsers(next);
        setUsers(next);
        beginSession(adminUser);
        logPlatformEvent("login_google", "auth", adminUser.uid, adminUser.email, undefined, undefined, { uid: adminUser.uid, email: adminUser.email, role: adminUser.role });
        return { ok: true };
      }

      // Local-first: look up or create the RBAC user (empty db, not demo)
      const rbacUser = upsertLocalRbacFromFirebase(fb);
      // Ensure centers/{uid} document exists (in case it wasn't created at signup)
      ensureCenterDocument(fb.uid, fb.email ?? "", fb.displayName ?? "User");
      beginSession(rbacUser);
      logPlatformEvent("login_google", "auth", rbacUser.uid, rbacUser.email, undefined, undefined, { uid: rbacUser.uid, email: rbacUser.email, role: rbacUser.role });
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      return { ok: false, error: mapFbError(code, err) };
    }
  }, [beginSession, upsertLocalRbacFromFirebase, ensureCenterDocument]);

  const demoAccess = useCallback(
    (as: "owner" | "secretary" | "parent") => {
      ensureSeeded(DEMO_CENTER);
      const list = loadUsers();
      let owner = list.find((u) => u.centerId === DEMO_CENTER && u.role === "OWNER");
      const ts = now();
      const next = [...list];
      if (!owner) {
        owner = {
          uid: DEMO_CENTER,
          email: "owner@demo.center",
          displayName: "Dr. Mona Adel",
          role: "OWNER",
          centerId: DEMO_CENTER,
          ownerId: DEMO_CENTER,
          permissions: ROLE_PERMS.OWNER,
          active: true,
          createdAt: ts,
          lastUpdated: ts,
        };
        next.push(owner);
      }
      let sessionUser = owner;
      if (as === "secretary") {
        let sec = list.find((u) => u.centerId === DEMO_CENTER && u.role === "SECRETARY");
        if (!sec) {
          sec = {
            uid: uid("staff"),
            email: "secretary@demo.center",
            displayName: "Sara Tarek",
            role: "SECRETARY",
            centerId: DEMO_CENTER,
            ownerId: DEMO_CENTER,
            permissions: ROLE_PERMS.SECRETARY,
            active: true,
            createdAt: ts,
            lastUpdated: ts,
          };
          next.push(sec);
        }
        sessionUser = sec;
      }
      saveUsers(next);
      setUsers(next);
      if (as === "parent") {
        beginSession({
          uid: "parent-guest",
          email: "",
          displayName: "Parent",
          role: "PARENT",
          centerId: DEMO_CENTER,
          ownerId: DEMO_CENTER,
          permissions: [],
          active: true,
          createdAt: ts,
          lastUpdated: ts,
        });
      } else {
        beginSession(sessionUser!);
      }
    },
    [beginSession, ensureSeeded],
  );

  /** Owner creates a sub-account (staff) tied to their centerId, with a password,
   *  custom permissions, optional salary and position. Returns the new uid. */
  const inviteStaff = useCallback(
    (email: string, name: string, password: string, role: Role, perms: Permission[], opts?: { salary?: number; title?: string }): { ok: boolean; error?: string; uid?: string } => {
      if (!user) return { ok: false, error: "no-session" };
      if (!email.trim() || !password.trim()) return { ok: false, error: "required" };
      const list = loadUsers();
      if (list.some((u) => u.email.toLowerCase() === email.toLowerCase()))
        return { ok: false, error: "email-exists" };
      const ts = now();
      const staffMember: UserRbac = {
        uid: uid("staff"),
        email,
        displayName: name || email.split("@")[0],
        role,
        centerId: user.centerId, // shared tenant
        ownerId: user.uid, // links back to the owner
        permissions: role === "OWNER" || role === "ADMIN" ? ROLE_PERMS[role] : perms,
        password: obfuscate(password),
        active: true,
        salary: opts?.salary ?? 0,
        title: opts?.title,
        createdAt: ts,
        lastUpdated: ts,
      };
      const next = [...list, staffMember];
      saveUsers(next);
      setUsers(next);
      queueSync(`/user_rbac/${staffMember.uid}`, "create");
      return { ok: true, uid: staffMember.uid };
    },
    [user, queueSync],
  );

  const updateStaff = useCallback((suid: string, patch: Partial<UserRbac>) => {
    const next = loadUsers().map((u) =>
      u.uid === suid ? { ...u, ...patch, password: patch.password ? obfuscate(patch.password) : u.password, lastUpdated: now() } : u,
    );
    saveUsers(next);
    setUsers(next);
    // sync the logged-in user if they edited themselves
    setUser((cur) => (cur && cur.uid === suid ? { ...cur, ...patch, lastUpdated: now() } : cur));
  }, []);

  const signOut = useCallback(() => {
    if (user) {
      logPlatformEvent("logout", "auth", user.uid, user.email);
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setPortalCenterId(null);
    setSubscriptionPlanState("free");
    setSubscriptionEndDate(undefined);
    setDiscountAmount(undefined);
    setDiscountReason(undefined);
  }, [user, logPlatformEvent]);

  const pullCenterDatabase = useCallback(async (cid: string): Promise<DatabaseShape | null> => {
    if (!FIREBASE_ENABLED || !firestoreDb) return null;
    const dbInstance = firestoreDb;
    try {
      const profileRef = doc(dbInstance, "centers", cid);
      const profileSnap = await getDoc(profileRef);
      const profileData = profileSnap.exists() ? profileSnap.data() : {};
      
      const ts = Date.now();
      const freshDb: DatabaseShape = {
        version: 2,
        profile: {
          centerId: cid,
          name: profileData.name || "Center Portal",
          currency: profileData.currency || "EGP",
          locale: "ar",
          logoText: (profileData.name || "C").slice(0, 2),
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

      const collectionsToPull = [
        { localKey: "students", path: "students" },
        { localKey: "teachers", path: "teachers" },
        { localKey: "groups", path: "groups" },
        { localKey: "classrooms", path: "classrooms" },
        { localKey: "scheduleEvents", path: "schedule_events" },
        { localKey: "attendance", path: "attendance" },
        { localKey: "payments", path: "payments" },
        { localKey: "expenses", path: "expenses" },
        { localKey: "exams", path: "exams" },
        { localKey: "examGrades", path: "exam_grades" },
        { localKey: "assignments", path: "assignments" },
        { localKey: "studentNotes", path: "student_notes" },
        { localKey: "branches", path: "branches" },
        { localKey: "cardThemes", path: "card_themes" },
      ];

      await Promise.all(
        collectionsToPull.map(async (col) => {
          try {
            const snap = await getDocs(collection(dbInstance, `centers/${cid}/${col.path}`));
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            (freshDb as any)[col.localKey] = list;
          } catch (e) {
            console.warn(`[pullCenterDatabase] Failed to pull ${col.path}:`, e);
          }
        })
      );

      try {
        localStorage.setItem(`cpd_db_${cid}`, JSON.stringify(freshDb));
      } catch (err) {
        console.error("[pullCenterDatabase] Save to localStorage failed:", err);
      }

      return freshDb;
    } catch (error) {
      console.error("[pullCenterDatabase] Failed to pull center database:", error);
      return null;
    }
  }, []);

  const loginAsStudent = useCallback(async (studentCode: string): Promise<Student | null> => {
    const cleanQuery = studentCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleanQuery) return null;

    // 1. Check Firestore first (if online) to get the authoritative centerId
    if (FIREBASE_ENABLED && firestoreDb) {
      try {
        if (auth && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (authErr) {
            console.warn("[loginAsStudent] Anonymous sign-in failed, proceeding anyway:", authErr);
          }
        }

        const inputCode = studentCode.trim();
        const upperCode = inputCode.toUpperCase();
        const lowerCode = inputCode.toLowerCase();

        let studentSnap = await getDoc(doc(firestoreDb, "students", inputCode));
        if (!studentSnap.exists() && upperCode !== inputCode) {
          studentSnap = await getDoc(doc(firestoreDb, "students", upperCode));
        }
        if (!studentSnap.exists() && lowerCode !== inputCode && lowerCode !== upperCode) {
          studentSnap = await getDoc(doc(firestoreDb, "students", lowerCode));
        }
        
        let targetCid: string | null = null;
        let studentId = inputCode;

        if (studentSnap.exists()) {
          const sData = studentSnap.data();
          targetCid = sData.centerId;
          studentId = sData.studentCode || sData.id || studentSnap.id;
        } else {
          // Search by parent or student phone in Firestore
          const qParent = query(collection(firestoreDb, "students"), where("parentPhone", "==", inputCode));
          const snapParent = await getDocs(qParent);
          if (!snapParent.empty) {
            const first = snapParent.docs[0];
            targetCid = first.data().centerId;
            studentId = first.id;
          } else {
            const qPhone = query(collection(firestoreDb, "students"), where("phone", "==", inputCode));
            const snapPhone = await getDocs(qPhone);
            if (!snapPhone.empty) {
              const first = snapPhone.docs[0];
              targetCid = first.data().centerId;
              studentId = first.id;
            }
          }
        }

        if (targetCid) {
          setPortalCenterId(targetCid);
          const pulledDb = await pullCenterDatabase(targetCid);
          if (pulledDb) {
            setDb(pulledDb);
            const foundInPulled = pulledDb.students.find(s => 
              s.id.toLowerCase() === studentId.toLowerCase() ||
              (s.qrCode || "").toLowerCase() === studentId.toLowerCase()
            );
            if (foundInPulled) return foundInPulled;
          }
        }
      } catch (err) {
        console.error("[loginAsStudent] Cloud lookup failed:", err);
      }
    }

    // 2. Fallback: Check local storage (prioritizing real databases over the demo database)
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("cpd_db_")) {
        keys.push(key);
      }
    }
    // Sort keys so that non-demo databases are checked first
    keys.sort((a, b) => {
      if (a.includes("demo") && !b.includes("demo")) return 1;
      if (!a.includes("demo") && b.includes("demo")) return -1;
      return 0;
    });

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as DatabaseShape;
          const found = parsed.students.find(s => {
            const cleanId = s.id.toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanQr = (s.qrCode || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanParentPhone = (s.parentPhone || "").replace(/[^0-9]/g, "");
            const queryPhoneCleaned = cleanQuery.replace(/[^0-9]/g, "");
            
            return (
              cleanId === cleanQuery ||
              (cleanQr && cleanQr === cleanQuery) ||
              (cleanParentPhone && queryPhoneCleaned && cleanParentPhone.endsWith(queryPhoneCleaned))
            );
          });

          if (found) {
            const cid = key.replace("cpd_db_", "");
            setPortalCenterId(cid);
            return found;
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    return null;
  }, [pullCenterDatabase]);

  const loginAsTeacher = useCallback(async (teacherCode: string): Promise<Teacher | null> => {
    const cleanQuery = teacherCode.trim().toLowerCase();
    if (!cleanQuery) return null;

    // 1. Check Firestore first (if online) to get the authoritative centerId
    if (FIREBASE_ENABLED && firestoreDb) {
      try {
        if (auth && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (authErr) {
            console.warn("[loginAsTeacher] Anonymous sign-in failed, proceeding anyway:", authErr);
          }
        }

        const inputCode = teacherCode.trim();
        const upperCode = inputCode.toUpperCase();
        const lowerCode = inputCode.toLowerCase();

        let teacherSnap = await getDoc(doc(firestoreDb, "teachers", inputCode));
        if (!teacherSnap.exists() && upperCode !== inputCode) {
          teacherSnap = await getDoc(doc(firestoreDb, "teachers", upperCode));
        }
        if (!teacherSnap.exists() && lowerCode !== inputCode && lowerCode !== upperCode) {
          teacherSnap = await getDoc(doc(firestoreDb, "teachers", lowerCode));
        }

        if (teacherSnap.exists()) {
          const tData = teacherSnap.data();
          const cid = tData.centerId;
          if (cid) {
            setPortalCenterId(cid);
            const pulledDb = await pullCenterDatabase(cid);
            if (pulledDb) {
              setDb(pulledDb);
              const foundInPulled = pulledDb.teachers.find(t => 
                t.id.toLowerCase() === teacherSnap.id.toLowerCase() ||
                t.id.toLowerCase() === inputCode.toLowerCase()
              );
              if (foundInPulled) return foundInPulled;
            }
          }
        }
      } catch (err) {
        console.error("[loginAsTeacher] Cloud lookup failed:", err);
      }
    }

    // 2. Fallback: Check local storage (prioritizing real databases over the demo database)
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("cpd_db_")) {
        keys.push(key);
      }
    }
    // Sort keys so that non-demo databases are checked first
    keys.sort((a, b) => {
      if (a.includes("demo") && !b.includes("demo")) return 1;
      if (!a.includes("demo") && b.includes("demo")) return -1;
      return 0;
    });

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as DatabaseShape;
          const found = parsed.teachers.find(t => t.id.toLowerCase() === cleanQuery);
          if (found) {
            const cid = key.replace("cpd_db_", "");
            setPortalCenterId(cid);
            return found;
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    return null;
  }, [pullCenterDatabase]);

  const resetPortalSession = useCallback(() => {
    setPortalCenterId(null);
  }, []);

  const staff = useMemo(
    () => (user ? users.filter((u) => u.centerId === user.centerId) : []),
    [users, user],
  );

  const can = useCallback(
    (perm: Permission) => {
      if (!user) return false;
      if (user.role === "OWNER" || user.role === "ADMIN") return true;
      return user.permissions.includes(perm);
    },
    [user],
  );

  const canAdd = useCallback(() => {
    if (!user) return false;
    if (user.role === "OWNER" || user.role === "ADMIN") return true;
    return user.permissions.includes("data.add");
  }, [user]);

  /** Checks if the center has reached its student limit for the current plan. */
  const canAddStudent = useCallback((): boolean => {
    const limit = customLimits?.maxStudents ?? PLAN_LIMITS[subscriptionPlan]?.maxStudents;
    if (limit === undefined) return true;
    return db.students.length < limit;
  }, [db.students.length, subscriptionPlan, customLimits]);

  /** Checks if the center has reached its teacher limit for the current plan. */
  const canAddTeacher = useCallback((): boolean => {
    const limit = customLimits?.maxTeachers ?? PLAN_LIMITS[subscriptionPlan]?.maxTeachers;
    if (limit === undefined) return true;
    return db.teachers.length < limit;
  }, [db.teachers.length, subscriptionPlan, customLimits]);

  const canDelete = useCallback(() => {
    if (!user) return false;
    if (user.role === "OWNER" || user.role === "ADMIN") return true;
    return user.permissions.includes("data.delete");
  }, [user]);

  // Plan limits constants (local mirror of superadmin DEFAULT_LIMITS)
  const PLAN_LIMITS: Record<string, { maxStudents: number; maxTeachers: number; maxStaff: number }> = {
    free: { maxStudents: 30, maxTeachers: 2, maxStaff: 0 },
    pro: { maxStudents: 500, maxTeachers: 30, maxStaff: 10 },
    enterprise: { maxStudents: 99999, maxTeachers: 99999, maxStaff: 99999 },
  };

  // Feature gating based on subscription plan
  const FEATURE_REQUIREMENTS: Record<string, "free" | "pro" | "enterprise"> = {
    ai_assistant: "enterprise",
    smart_attendance: "enterprise",
    qr_scanner: "enterprise",
    multi_branch: "enterprise",
    advanced_reports: "pro",
    staff_management: "enterprise",
    excel_import: "pro",
    parent_portal: "pro",
    financial_reports: "pro",
  };

  const canUseFeature = useCallback(
    (feature: string): boolean => {
      // 1. Check Global Platform Settings first
      if (globalSettings?.features) {
        // Map feature gates to platform settings features
        const FEATURE_MAP: Record<string, keyof NonNullable<GlobalPlatformSettings["features"]>> = {
          ai_assistant: "aiFeatures",
          smart_attendance: "smartAttendance",
          qr_scanner: "qrAttendance",
          parent_portal: "parentPortal",
          advanced_reports: "reports",
          financial_reports: "reports",
          offline_licensing: "offlineLicense",
          messaging: "notifications"
        };
        const mappedKey = FEATURE_MAP[feature];
        if (mappedKey && globalSettings.features[mappedKey] === false) {
          return false; // disabled globally by Super Admin
        }
      }

      // 2. Check Custom Center Feature Overrides from Super Admin
      // Map client feature keys to Super Admin FEATURE_FLAGS keys if they differ
      const clientToAdminMap: Record<string, string> = {
        ai_assistant: "ai_assistant",
        smart_attendance: "attendance_ai",
        qr_scanner: "qr_scanner",
        multi_branch: "multi_branch",
        advanced_reports: "advanced_analytics",
        excel_import: "excel_import",
        parent_portal: "parent_portal",
        financial_reports: "financial_reports"
      };

      const adminKey = clientToAdminMap[feature] || feature;
      if (customFeatures && customFeatures[adminKey] !== undefined) {
        return customFeatures[adminKey]; // Explicit override by Super Admin!
      }

      // Demo users always get enterprise for testing
      if (centerId === DEMO_CENTER) return true;
      const required = FEATURE_REQUIREMENTS[feature];
      if (!required) return true;
      if (required === "free") return true;
      if (required === "pro") return subscriptionPlan === "pro" || subscriptionPlan === "enterprise";
      return subscriptionPlan === "enterprise";
    },
    [centerId, subscriptionPlan, globalSettings, customFeatures],
  );

  /* ----------------------------- data mutations ------------------------ */
  const upsert = useCallback(
    <K extends CollKey>(coll: K, item: Collections[K]) => {
      const itemId = item.id || `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const existed = item.id ? (db[coll] as unknown as Array<{ id: string }>).some((x) => x.id === item.id) : false;
      if (isSubscriptionExpired) {
        alert(lang === "ar" ? "انتهى اشتراكك! تم تفعيل وضع القراءة فقط. يرجى تجديد الاشتراك لتتمكن من إضافة أو تعديل البيانات." : "Your subscription has expired! Read-only mode is active. Please renew to add or modify data.");
        return;
      }
      const stamped = { ...item, id: itemId, lastUpdated: now() } as Collections[K] & { id: string };
      setDb((prev) => {
        const arr = prev[coll] as unknown as Array<{ id: string }>;
        const exists = arr.some((x) => x.id === stamped.id);

        let finalStamped = { ...stamped };
        if (!exists && (coll === "payments" || coll === "expenses")) {
          const totalP = (prev.payments || []).reduce((sum, p) => sum + p.amount, 0);
          const totalE = (prev.expenses || []).reduce((sum, e) => sum + e.amount, 0);
          const currentSafe = totalP - totalE;
          const itemAmount = (finalStamped as any).amount || 0;
          (finalStamped as any).safeBalance = coll === "payments" ? currentSafe + itemAmount : currentSafe - itemAmount;
          (finalStamped as any).recordedBy = user?.displayName || (lang === "ar" ? "المالك" : "OWNER");
        }

        let auditLogs = prev.auditLogs ? [...prev.auditLogs] : [];
        if (coll === "payments" || coll === "expenses") {
          const oldAmount = exists ? (arr.find((x) => x.id === finalStamped.id) as any)?.amount : undefined;
          const newAmount = (finalStamped as any).amount;
          if (!exists || oldAmount !== newAmount) {
            const alId = `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const log = {
              id: alId,
              table: coll,
              recordId: finalStamped.id,
              action: exists ? "UPDATE" : "CREATE",
              oldAmount,
              newAmount,
              timestamp: Date.now(),
              userId: user?.uid || "unknown",
              userName: user?.displayName || (lang === "ar" ? "المالك" : "OWNER"),
            };
            auditLogs.push(log as any);
            const cid = prev?.profile?.centerId;
            if (cid && cid !== DEMO_CENTER) {
              pushRecord(`centers/${cid}/auditLogs/${alId}`, log).catch(console.error);
            }
          }
        }

        const nextArr = exists ? arr.map((x) => (x.id === finalStamped.id ? finalStamped : x)) : [...arr, finalStamped];
        const cid = prev?.profile?.centerId;
        if (cid && cid !== DEMO_CENTER && coll && finalStamped.id) {
          const path = `centers/${cid}/${coll}/${finalStamped.id}`;
          queueSync(path, exists ? "update" : "create");
          pushRecord(path, finalStamped).catch(console.error);

          if (coll === "students") {
            const globalPath = `students/${finalStamped.id}`;
            const unifiedStudent = {
              studentCode: finalStamped.id,
              fullName: (finalStamped as any).name || "",
              grade: (finalStamped as any).grade || "",
              phone: (finalStamped as any).studentPhone || "",
              parentPhone: (finalStamped as any).parentPhone || "",
              parentUid: (finalStamped as any).parentUid || null,
              parentName: (finalStamped as any).parentName || "",
              centerId: cid,
              branchId: currentBranchId || "main",
              teacherIds: (finalStamped as any).teachers?.map((t: any) => t.teacherId) || [],
              groupIds: (finalStamped as any).groupIds || [],
              createdAt: (finalStamped as any).registrationDate || Date.now(),
              updatedAt: Date.now(),
            };
            pushRecord(globalPath, unifiedStudent).catch(console.error);
          }

          if (coll === "teachers") {
            const globalPath = `teachers/${finalStamped.id}`;
            const unifiedTeacher = {
              id: finalStamped.id,
              name: (finalStamped as any).name || "",
              email: (finalStamped as any).email || "",
              phone: (finalStamped as any).phone || "",
              subjects: (finalStamped as any).subjects || [],
              centerId: cid,
              updatedAt: Date.now(),
            };
            pushRecord(globalPath, unifiedTeacher).catch(console.error);
          }
        } else {
          console.log("[upsert] Local only or demo center, skipping pushRecord:", { cid, coll, id: finalStamped.id });
        }
        return { ...prev, [coll]: nextArr, auditLogs } as DatabaseShape;
      });
      // human-readable label for the staff activity log
      const labelFor = (r: Collections[K]) => {
        const any = r as unknown as Record<string, unknown>;
        return String(any.name ?? any.title ?? any.id ?? "");
      };
      recordActivity(`${coll}:${existed ? "update" : "create"}`, labelFor(item));

      // Global platform audit logs
      const targetTypeMapped = (coll === "students" ? "student" : coll === "teachers" ? "teacher" : coll === "payments" ? "payment" : "settings") as any;
      const prevItem = existed ? (db[coll] as any[]).find((x) => x.id === item.id) : undefined;
      logPlatformEvent(
        existed ? `تعديل سجل في ${coll}` : `إنشاء سجل في ${coll}`,
        targetTypeMapped,
        itemId,
        labelFor(item),
        prevItem,
        stamped
      );
    },
    [queueSync, recordActivity, db, isSubscriptionExpired, lang, online, logPlatformEvent],
  );

  const remove = useCallback(
    <K extends CollKey>(coll: K, id: string) => {
      if (isSubscriptionExpired) {
        alert(lang === "ar" ? "انتهى اشتراكك! تم تفعيل وضع القراءة فقط. يرجى تجديد الاشتراك لتتمكن من حذف البيانات." : "Your subscription has expired! Read-only mode is active. Please renew to delete data.");
        return;
      }
      const target = (db[coll] as unknown as Array<{ id: string; name?: string; title?: string }>).find((x) => x.id === id);
      setDb((prev) => {
        const arr = prev[coll] as unknown as Array<{ id: string }>;
        let auditLogs = prev.auditLogs ? [...prev.auditLogs] : [];
        if (coll === "payments" || coll === "expenses") {
          const targetItem = arr.find((x) => x.id === id);
          if (targetItem) {
            const alId = `al_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const log = {
              id: alId,
              table: coll,
              recordId: id,
              action: "DELETE",
              oldAmount: (targetItem as any).amount,
              timestamp: Date.now(),
              userId: user?.uid || "unknown",
              userName: user?.displayName || (lang === "ar" ? "المالك" : "OWNER"),
            };
            auditLogs.push(log as any);
            const cid = prev?.profile?.centerId;
            if (cid && cid !== DEMO_CENTER) {
              pushRecord(`centers/${cid}/auditLogs/${alId}`, log).catch(console.error);
            }
          }
        }

        const cid = prev?.profile?.centerId;
        if (cid && cid !== DEMO_CENTER && coll && id) {
          const path = `centers/${cid}/${coll}/${id}`;
          queueSync(path, "delete");
          deleteRecord(path).catch(console.error);

          if (coll === "students") {
            deleteRecord(`students/${id}`).catch(console.error);
          }
          if (coll === "teachers") {
            deleteRecord(`teachers/${id}`).catch(console.error);
          }
        } else {
          console.log("[remove] Local only or demo center, skipping deleteRecord:", { cid, coll, id });
        }
        return { ...prev, [coll]: arr.filter((x) => x.id !== id), auditLogs } as DatabaseShape;
      });
      recordActivity(`${coll}:delete`, target?.name ?? target?.title ?? id);

      // Global platform audit logs
      const targetTypeMapped = (coll === "students" ? "student" : coll === "teachers" ? "teacher" : coll === "payments" ? "payment" : "settings") as any;
      logPlatformEvent(
        `حذف سجل من ${coll}`,
        targetTypeMapped,
        id,
        target?.name ?? target?.title ?? id,
        target,
        undefined
      );
    },
    [queueSync, recordActivity, db, isSubscriptionExpired, lang, logPlatformEvent],
  );

  /** Permanently remove a staff account (cannot remove the owner). */
  const deleteStaff = useCallback(
    (suid: string) => {
      const next = loadUsers().filter((u) => !(u.uid === suid && u.role !== "OWNER"));
      saveUsers(next);
      setUsers(next);
    },
    [],
  );

  /** Append a message to the thread between owner ↔ staff (stored on both). */
  const sendStaffMessage = useCallback(
    (toUid: string, text: string) => {
      if (!user || !text.trim()) return;
      const ts = now();
      const list = loadUsers();
      const msg = { id: uid("msg"), fromUid: user.uid, fromName: user.displayName, toUid, text: text.trim(), at: ts };
      const next = list.map((u) => {
        if (u.uid === toUid || u.uid === user.uid) {
          return { ...u, messages: [...(u.messages ?? []), msg], lastUpdated: ts };
        }
        return u;
      });
      saveUsers(next);
      setUsers(next);
      // keep the logged-in (sender) user object in sync so its chat updates instantly
      setUser((cur) => (cur ? { ...cur, messages: [...(cur.messages ?? []), msg], lastUpdated: ts } : cur));
    },
    [user],
  );

  const updateProfile = useCallback(
    (patch: Partial<DatabaseShape["profile"]>) => {
      if (isSubscriptionExpired) {
        alert(lang === "ar" ? "انتهى اشتراكك! تم تفعيل وضع القراءة فقط." : "Your subscription has expired! Read-only mode is active.");
        return;
      }
      setDb((prev) => ({ ...prev, profile: { ...prev.profile, ...patch, lastUpdated: now() } }));
      queueSync(`/centers/${centerId}/profile/settings`, "update");
    },
    [queueSync, centerId, isSubscriptionExpired, lang],
  );

  const resetData = useCallback(() => {
    const fresh = centerId === DEMO_CENTER ? seedDb(centerId) : emptyDb(centerId, user?.displayName || "My Center");
    setDb(fresh);
  }, [centerId, user]);

  const replaceDb = useCallback((next: DatabaseShape) => setDb(next), []);

  /* ID card templates — stored in the database (synced) */
  const setActiveCardTheme = useCallback(
    (id: string) => setDb((prev) => ({ ...prev, activeCardTheme: id })),
    [],
  );

  /* --------------------------- academic year --------------------------- */
  /** Promote all graded students to the next grade (course students are
   *  skipped). Automatically takes a backup first. */
  const promoteYear = useCallback(() => {
    if (isSubscriptionExpired) {
      alert(lang === "ar" ? "انتهى اشتراكك! تم تفعيل وضع القراءة فقط." : "Your subscription has expired! Read-only mode is active.");
      return { promoted: 0, skipped: 0, backupTs: 0 };
    }
    const backupTs = saveBackup(centerId, "before-promotion");
    setBackups(listBackups(centerId));
    // Count from the current db (closure) so counts stay correct even under
    // StrictMode double-invocation of the state updater.
    let promoted = 0;
    let skipped = 0;
    for (const s of db.students) {
      if (nextGrade(s.grade)) promoted++;
      else skipped++;
    }
    setDb((prev) => ({
      ...prev,
      students: prev.students.map((s) => {
        const ng = nextGrade(s.grade);
        return ng ? { ...s, grade: ng, lastUpdated: now() } : s;
      }),
    }));
    queueSync(`/centers/${centerId}/profile/settings`, "update");
    return { promoted, skipped, backupTs };
  }, [centerId, db, queueSync, isSubscriptionExpired, lang]);

  /* ------------------------------ backup ------------------------------- */
  const createBackup = useCallback(
    (label = "manual") => {
      saveBackup(centerId, label);
      setBackups(listBackups(centerId));
    },
    [centerId],
  );

  /** Fetches the subscription plan from Firestore and updates local state. */
  const refreshSubscriptionPlan = useCallback(async (): Promise<void> => {
    if (!FIREBASE_ENABLED || !firestoreDb || !centerId || centerId === DEMO_CENTER) {
      if (centerId === DEMO_CENTER) {
        setSubscriptionPlanState("enterprise");
        setSubscriptionEndDate(undefined);
      }
      return;
    }
    // Safety guard to avoid permission denied errors when user is not logged in to Firebase
    if (auth && !auth.currentUser) {
      console.log("[refreshSubscriptionPlan] No authenticated user yet, skipping Firestore fetch");
      return;
    }
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 8000);
      });
      const snap = await Promise.race([
        getDoc(doc(firestoreDb, "centers", centerId)),
        timeoutPromise
      ]);
      if (snap.exists()) {
        const data = snap.data();
        const plan = (data.subscriptionPlan as "free" | "pro" | "enterprise") || "free";
        const endDate = data.subscriptionEndDate as number | undefined;
        const discAmt = data.discountAmount as number | undefined;
        const discReason = data.discountReason as string | undefined;
        const subStatus = data.subscriptionStatus || "trialing";
        const cStatus = data.status || "active";
        const cLimits = data.customLimits as { maxStudents: number; maxTeachers: number; maxStaff: number } | undefined;
        
        setSubscriptionPlanState(plan);
        localStorage.setItem(`cpd_plan_${centerId}`, JSON.stringify(plan));
        
        setSubscriptionStatus(subStatus);
        localStorage.setItem(`cpd_plan_status_${centerId}`, JSON.stringify(subStatus));
        
        setCenterStatus(cStatus);
        localStorage.setItem(`cpd_center_status_${centerId}`, JSON.stringify(cStatus));

        if (cLimits) {
          setCustomLimits(cLimits);
          localStorage.setItem(`cpd_custom_limits_${centerId}`, JSON.stringify(cLimits));
        } else {
          setCustomLimits(undefined);
          localStorage.removeItem(`cpd_custom_limits_${centerId}`);
        }

        if (endDate) {
          setSubscriptionEndDate(endDate);
          localStorage.setItem(`cpd_plan_end_${centerId}`, String(endDate));
        } else {
          setSubscriptionEndDate(undefined);
          localStorage.removeItem(`cpd_plan_end_${centerId}`);
        }

        if (discAmt) {
          setDiscountAmount(discAmt);
          localStorage.setItem(`cpd_plan_discount_${centerId}`, String(discAmt));
        } else {
          setDiscountAmount(undefined);
          localStorage.removeItem(`cpd_plan_discount_${centerId}`);
        }

        if (discReason) {
          setDiscountReason(discReason);
          localStorage.setItem(`cpd_plan_discount_reason_${centerId}`, discReason);
        } else {
          setDiscountReason(undefined);
          localStorage.removeItem(`cpd_plan_discount_reason_${centerId}`);
        }

        // Fetch custom features overrides
        try {
          const featSnap = await Promise.race([
            getDoc(doc(firestoreDb, "centers", centerId, "config", "features")),
            timeoutPromise
          ]);
          if (featSnap.exists()) {
            const featData = featSnap.data() as Record<string, boolean>;
            setCustomFeatures(featData);
            localStorage.setItem(`cpd_features_${centerId}`, JSON.stringify(featData));
          } else {
            setCustomFeatures({});
            localStorage.removeItem(`cpd_features_${centerId}`);
          }
        } catch (featErr) {
          console.warn("[AppContext] Failed to fetch custom features from Firestore:", featErr);
        }
      } else {
        // Document does not exist in Firestore yet — let's upload our current local plan status to Firestore instead of overwriting it
        const localPlan = loadPref(`cpd_plan_${centerId}`, "free") as "free" | "pro" | "enterprise";
        const localEndDate = localStorage.getItem(`cpd_plan_end_${centerId}`);
        const localStatus = localStorage.getItem(`cpd_plan_status_${centerId}`);
        const localCenterStatus = localStorage.getItem(`cpd_center_status_${centerId}`);
        
        await setDoc(doc(firestoreDb, "centers", centerId), {
          id: centerId,
          name: user?.displayName ? `${user.displayName}'s Center` : "My Center",
          ownerId: centerId,
          ownerEmail: user?.email || "",
          status: localCenterStatus ? JSON.parse(localCenterStatus) : "active",
          subscriptionPlan: localPlan,
          subscriptionStatus: localStatus ? JSON.parse(localStatus) : "trialing",
          subscriptionStartDate: Date.now(),
          subscriptionEndDate: localEndDate ? Number(localEndDate) : null,
          createdAt: Date.now(),
        }, { merge: true }).catch(() => {});
      }
    } catch {
      // non-blocking
    }
  }, [centerId, user]);

  // Refresh subscription plan when user logs in or center changes
  useEffect(() => {
    if (user && centerId !== DEMO_CENTER) {
      setSubscriptionPlanState(loadPref(`cpd_plan_${centerId}`, "free"));
      const val = localStorage.getItem(`cpd_plan_end_${centerId}`);
      setSubscriptionEndDate(val ? Number(val) : undefined);

      const dAmt = localStorage.getItem(`cpd_plan_discount_${centerId}`);
      setDiscountAmount(dAmt ? Number(dAmt) : undefined);
      const dReason = localStorage.getItem(`cpd_plan_discount_reason_${centerId}`);
      setDiscountReason(dReason ?? undefined);

      const subStatVal = localStorage.getItem(`cpd_plan_status_${centerId}`);
      setSubscriptionStatus(subStatVal ? JSON.parse(subStatVal) : "trialing");
      const cStatVal = localStorage.getItem(`cpd_center_status_${centerId}`);
      setCenterStatus(cStatVal ? JSON.parse(cStatVal) : "active");

      refreshSubscriptionPlan();
      // Also refresh every 5 minutes to catch admin changes
      const interval = setInterval(refreshSubscriptionPlan, 5 * 60 * 1000);
      return () => clearInterval(interval);
    } else if (centerId === DEMO_CENTER) {
      setSubscriptionPlanState("enterprise");
      setSubscriptionEndDate(undefined);
      setDiscountAmount(undefined);
      setDiscountReason(undefined);
    }
  }, [user, centerId, refreshSubscriptionPlan, fbUser]);

  const restoreFromBackup = useCallback(
    (ts: number) => {
      restoreBackup(centerId, ts);
      if (centerId === DEMO_CENTER) {
        setDb(loadDb(centerId) ?? seedDb(centerId));
      } else {
        setDb(loadDb(centerId) ?? emptyDb(centerId, user?.displayName || "My Center"));
      }
      setBackups(listBackups(centerId));
    },
    [centerId],
  );

  const removeBackup = useCallback(
    (ts: number) => {
      deleteBackup(centerId, ts);
      setBackups(listBackups(centerId));
    },
    [centerId],
  );

  const exportBackup = useCallback(() => {
    downloadBackupFile(db, centerId);
  }, [db, centerId]);

  /** Restore a dataset uploaded from the user's device (JSON backup file). */
  const restoreBackupFromFile = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseBackupFile(file);
        const backupFile: BackupFile = { ...parsed, centerId };
        restoreFromFile(centerId, backupFile);
        if (centerId === DEMO_CENTER) {
          setDb(loadDb(centerId) ?? seedDb(centerId));
        } else {
          setDb(loadDb(centerId) ?? emptyDb(centerId, user?.displayName || "My Center"));
        }
        setBackups(listBackups(centerId));
        return true;
      } catch {
        return false;
      }
    },
    [centerId],
  );

  const activateLicenseKey = useCallback((key: string) => {
    const res = verifyLicenseKey(key, centerId);
    if (!res.valid || !res.plan || !res.endDate) {
      return { ok: false, error: res.error || "مفتاح ترخيص غير صالح" };
    }

    const prevPlan = subscriptionPlan;
    setSubscriptionPlanState(res.plan);
    localStorage.setItem(`cpd_plan_${centerId}`, JSON.stringify(res.plan));
    setSubscriptionEndDate(res.endDate);
    localStorage.setItem(`cpd_plan_end_${centerId}`, String(res.endDate));

    const subStatus = res.purpose === "trial" ? "trialing" : "active";
    setSubscriptionStatus(subStatus);
    localStorage.setItem(`cpd_plan_status_${centerId}`, JSON.stringify(subStatus));

    if (res.purpose === "discount" && res.discountAmount !== undefined) {
      setDiscountAmount(res.discountAmount);
      localStorage.setItem(`cpd_plan_discount_${centerId}`, String(res.discountAmount));
      setDiscountReason(res.discountReason);
      localStorage.setItem(`cpd_plan_discount_reason_${centerId}`, res.discountReason || "");
    } else {
      setDiscountAmount(undefined);
      localStorage.removeItem(`cpd_plan_discount_${centerId}`);
      setDiscountReason(undefined);
      localStorage.removeItem(`cpd_plan_discount_reason_${centerId}`);
    }

    if (FIREBASE_ENABLED && firestoreDb) {
      void setDoc(doc(firestoreDb, "centers", centerId), {
        subscriptionPlan: res.plan,
        subscriptionStatus: subStatus,
        subscriptionStartDate: res.startDate || Date.now(),
        subscriptionEndDate: res.endDate,
        discountAmount: res.purpose === "discount" ? res.discountAmount : null,
        discountReason: res.purpose === "discount" ? res.discountReason : null,
      }, { merge: true }).catch(() => {});
    }

    logPlatformEvent(
      "تنشيط ترخيص خطة الاشتراك",
      "subscription",
      centerId,
      `خطة: ${res.plan} (${res.purpose})`,
      { plan: prevPlan },
      { plan: res.plan, endDate: res.endDate, purpose: res.purpose, discount: res.discountAmount }
    );

    return { ok: true };
  }, [centerId, subscriptionPlan, logPlatformEvent]);

  const value: AppContextValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t,
    setLang,
    toggleLang,
    theme,
    toggleTheme,
    fontScale,
    setFontScale,
    currentBranchId,
    switchBranch,
    user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    demoAccess,
    inviteStaff,
    updateStaff,
    deleteStaff,
    sendStaffMessage,
    staff,
    staffActivity,
    can,
    canAdd,
    canAddStudent,
    canAddTeacher,
    canDelete,
    subscriptionPlan,
    subscriptionEndDate,
    discountAmount,
    discountReason,
    subscriptionStatus,
    centerStatus,
    isSubscriptionExpired,
    clockTampered,
    refreshSubscriptionPlan,
    canUseFeature,
    activateLicenseKey,
    globalSettings,
    portalCenterId,
    centerId,
    DEMO_CENTER,
    loginAsStudent,
    loginAsTeacher,
    resetPortalSession,
    db,
    upsert,
    remove,
    updateProfile,
    resetData,
    replaceDb,
    cardThemes: db.cardThemes ?? [],
    activeCardTheme: db.activeCardTheme ?? "",
    setActiveCardTheme,
    restoreBackupFromFile,
    promoteYear,
    backups,
    createBackup,
    restoreFromBackup,
    removeBackup,
    exportBackup,
    syncStatus,
    online,
    setOnline: setOnlineState,
    lastSync,
    syncLog,
    pendingCount: syncLog.filter((e) => e.status === "queued").length,
    flushNow: flush,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { emptyDb };
