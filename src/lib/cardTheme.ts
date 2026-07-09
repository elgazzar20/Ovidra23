import type { CardTheme } from "./types";
import { uid } from "./db";

export const FIELD_KEYS = [
  "code", "stage", "grade", "section", "teachers", "fee", "issueDate", "validUntil", "status",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const DEFAULT_LABELS: Record<string, string> = {
  cardTitle: "ID CARD",
  academyRole: "Academic Management System",
  stage: "المرحلة",
  grade: "الصف",
  section: "القسم",
  teachers: "المعلم",
  fee: "الرسوم",
  start: "تاريخ البداية",
  validUntil: "تاريخ النهاية",
  scanHint: "امسح للحضور",
  instructions0: "هذه البطاقة خاصة بالطالب المسجل فقط.",
  instructions1: "تُستخدم لإثبات الحضور والانصراف.",
  instructions2: "يتم تسجيل الحضور بمجرد مسح رمز QR.",
  instructions3: "يمنع مشاركة البطاقة مع شخص آخر.",
  instructions4: "في حالة الفقدان أبلغ الإدارة فورًا.",
  caption: "امسح للحضور",
  extraText: "",
  footer: "© {year} — جميع الحقوق محفوظة",
  supportPhone: "",
  website: "",
  address: "",
  social: "",
};

/** Format a "yyyy-MM-dd" string (or epoch) into a localized short date. */
export function fmtCardDate(value: string | number | undefined, lang: "ar" | "en" = "ar"): string {
  if (!value) return "—";
  const ts = typeof value === "number" ? value : (() => {
    const [y, m, d] = String(value).split("-").map(Number);
    return y && m ? new Date(y, (m || 1) - 1, d || 1).getTime() : NaN;
  })();
  if (isNaN(ts)) return String(value);
  return new Date(ts).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export const FONT_OPTIONS: { key: "cairo" | "tajawal" | "naskh"; ar: string; css: string }[] = [
  { key: "cairo", ar: "Cairo — حديث", css: "'Cairo',sans-serif" },
  { key: "tajawal", ar: "Tajawal — أنيق", css: "'Tajawal',sans-serif" },
  { key: "naskh", ar: "نسخ كلاسيكي", css: "'Amiri','Cairo',serif" },
];
export function fontOf(key?: string) {
  return FONT_OPTIONS.find((f) => f.key === key)?.css ?? FONT_OPTIONS[0].css;
}

export function defaultFields(): Record<string, boolean> {
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, true]));
}

export function defaultLabels(): Record<string, string> {
  return { ...DEFAULT_LABELS };
}

/** The canonical premium navy + gold luxury PVC template (Apple/Stripe grade). */
export function defaultTheme(name = "الفاخر"): CardTheme {
  return {
    id: uid("theme"),
    name,
    headerFrom: "#0B1023",
    headerTo: "#1E2742",
    accent: "#F59E0B",
    bodyBg: "#FFFFFF",
    bodyText: "#1F2937",
    labelText: "#9CA3AF",
    chipBg: "#F3F4F6",
    backFrom: "#0B1023",
    backTo: "#1E2742",
    backText: "#E5E7EB",
    logoText: "",
    logoImage: undefined,
    showLogo: true,
    logoSize: 8,
    logoPosition: "top",
    logoAlign: "start",
    showAcademyName: true,
    fontKey: "cairo",
    borderWidth: 0,
    borderColor: "#E5E7EB",
    bgImage: undefined,
    qrSize: 13,
    showBarcode: true,
    frontImage: undefined,
    backImage: undefined,
    imageFit: "cover",
    customStart: undefined,
    customEnd: undefined,
    extraText: "",
    showCardTitle: true,
    customCenterName: undefined,
    watermarkOpacity: 4,
    instructions: undefined,
    fields: defaultFields(),
    fieldOrder: ["stage", "grade", "section", "teachers", "fee"],
    labels: defaultLabels(),
    cornerRadius: 3,
    scope: { type: "all" },
    lastUpdated: Date.now(),
  };
}

/**
 * Cohesive "style" presets — each carries a complete premium palette so a single
 * click gives a fully balanced luxury look (inspired by Apple / Stripe cards).
 * The user's chosen accent color is then layered on top for branding.
 */
export const STYLE_PRESETS: { key: string; name: string; accent: string; patch: Partial<CardTheme> }[] = [
  { key: "light", name: "أبيض فاخر", accent: "#4f46e5",
    patch: { bodyBg: "#ffffff", bodyText: "#0f172a", labelText: "#64748b", accent: "#4f46e5", backFrom: "#0f172a", backTo: "#1e293b", backText: "#e2e8f0" } },
  { key: "ivory", name: "عاجي ناعم", accent: "#b45309",
    patch: { bodyBg: "#fbf8f1", bodyText: "#1c1917", labelText: "#78716c", accent: "#b45309", backFrom: "#1c1917", backTo: "#292524", backText: "#f5f5f4" } },
  { key: "navy", name: "كحلي ملكي", accent: "#d4af37",
    patch: { bodyBg: "#f6f7fb", bodyText: "#0b1f44", labelText: "#5b6b8c", accent: "#b8902e", backFrom: "#0b1f44", backTo: "#16315c", backText: "#eef2fa" } },
  { key: "dark", name: "أسود فاحم", accent: "#8b5cf6",
    patch: { bodyBg: "#0f172a", bodyText: "#f1f5f9", labelText: "#94a3b8", accent: "#8b5cf6", backFrom: "#020617", backTo: "#0f172a", backText: "#e2e8f0" } },
  { key: "slate", name: "رمادي هادئ", accent: "#0ea5e9",
    patch: { bodyBg: "#ffffff", bodyText: "#0f172a", labelText: "#64748b", accent: "#0ea5e9", backFrom: "#1e293b", backTo: "#334155", backText: "#e2e8f0" } },
  { key: "emerald", name: "زمردي", accent: "#059669",
    patch: { bodyBg: "#f7fdf9", bodyText: "#064e3b", labelText: "#5b7d70", accent: "#059669", backFrom: "#053b36", backTo: "#0b5345", backText: "#e7f6f0" } },
];

/** Back-compat alias. */
export const THEME_PRESETS = STYLE_PRESETS;

/** Resolves the active theme, falling back to a default one if none is set. */
export function resolveTheme(db: { cardThemes?: CardTheme[]; activeCardTheme?: string }): CardTheme {
  const list = db.cardThemes ?? [];
  const active = db.activeCardTheme ? list.find((t) => t.id === db.activeCardTheme) : undefined;
  return active ?? list[0] ?? defaultTheme();
}

const STAGE_OF: Record<string, string> = {
  PRE: "pre", KG1: "pre", KG2: "pre",
  G1: "primary", G2: "primary", G3: "primary", G4: "primary", G5: "primary", G6: "primary",
  P1: "prep", P2: "prep", P3: "prep",
  S1: "secondary", S2: "secondary", S3: "secondary",
};

/**
 * Picks the best-matching template for a student. Specificity wins:
 * student > teacher > grade > stage > all. This lets the user give a whole
 * grade, stage, teacher or even a single student a distinct card design.
 */
export function resolveThemeForStudent(
  db: { cardThemes?: CardTheme[]; activeCardTheme?: string },
  student: { id: string; grade?: string; teachers?: { teacherId: string }[] },
): CardTheme {
  const list = db.cardThemes ?? [];
  const fallback = list.find((t) => t.id === db.activeCardTheme) ?? list[0] ?? defaultTheme();
  const stage = STAGE_OF[student.grade ?? ""] ?? "primary";
  const teacherIds = new Set((student.teachers ?? []).map((t) => t.teacherId));
  const order = ["student", "teacher", "grade", "stage", "all"] as const;
  for (const type of order) {
    const match = list.find((t) => {
      const sc = t.scope; if (!sc || sc.type !== type) return false;
      if (type === "all") return true;
      if (type === "stage") return sc.value === stage;
      if (type === "grade") return sc.value === student.grade;
      if (type === "teacher") return sc.value && teacherIds.has(sc.value);
      if (type === "student") return sc.value === student.id;
      return false;
    });
    if (match) return match;
  }
  return fallback;
}

export function applyPreset(base: CardTheme, patch: Partial<CardTheme>): CardTheme {
  return { ...base, ...patch, lastUpdated: Date.now() };
}

/** Deep-merge a partial patch into a theme (fields/labels merge at key level). */
export function mergeTheme(theme: CardTheme, patch: Partial<CardTheme>): CardTheme {
  return {
    ...theme,
    ...patch,
    fields: { ...theme.fields, ...(patch.fields ?? {}) },
    labels: { ...theme.labels, ...(patch.labels ?? {}) },
    lastUpdated: Date.now(),
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
