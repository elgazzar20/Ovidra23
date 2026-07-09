import type { Lang } from "../i18n/translations";

/* ----------------------------- School grades ---------------------------- */
/** Full Egyptian-style ladder: Pre-primary → KG → Primary → Prep → Secondary */
export interface Grade {
  id: string;
  en: string;
  ar: string;
  stage: "pre" | "primary" | "prep" | "secondary";
}
export const GRADES: Grade[] = [
  { id: "PRE", en: "Pre-Primary (Nursery)", ar: "التمهيدي (حضانة)", stage: "pre" },
  { id: "KG1", en: "Kindergarten 1", ar: "التمهيدي KG1", stage: "pre" },
  { id: "KG2", en: "Kindergarten 2", ar: "التمهيدي KG2", stage: "pre" },
  { id: "G1", en: "Grade 1 Primary", ar: "الصف الأول الابتدائي", stage: "primary" },
  { id: "G2", en: "Grade 2 Primary", ar: "الصف الثاني الابتدائي", stage: "primary" },
  { id: "G3", en: "Grade 3 Primary", ar: "الصف الثالث الابتدائي", stage: "primary" },
  { id: "G4", en: "Grade 4 Primary", ar: "الصف الرابع الابتدائي", stage: "primary" },
  { id: "G5", en: "Grade 5 Primary", ar: "الصف الخامس الابتدائي", stage: "primary" },
  { id: "G6", en: "Grade 6 Primary", ar: "الصف السادس الابتدائي", stage: "primary" },
  { id: "P1", en: "Grade 1 Preparatory", ar: "الصف الأول الإعدادي", stage: "prep" },
  { id: "P2", en: "Grade 2 Preparatory", ar: "الصف الثاني الإعدادي", stage: "prep" },
  { id: "P3", en: "Grade 3 Preparatory", ar: "الصف الثالث الإعدادي", stage: "prep" },
  { id: "S1", en: "Grade 1 Secondary", ar: "الصف الأول الثانوي", stage: "secondary" },
  { id: "S2", en: "Grade 2 Secondary", ar: "الصف الثاني الثانوي", stage: "secondary" },
  { id: "S3", en: "Grade 3 Secondary", ar: "الصف الثالث الثانوي", stage: "secondary" },
];

export function gradeLabel(id: string | undefined, lang: Lang): string {
  if (!id) return "—";
  const g = GRADES.find((x) => x.id === id || x.en === id);
  if (g) return lang === "ar" ? g.ar : g.en;
  return id; // allow custom grades too
}

export const STAGE_TONE: Record<Grade["stage"], string> = {
  pre: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  primary: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  prep: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  secondary: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

/* ------------------------------- Subjects ------------------------------- */
export const SUBJECTS = [
  "Mathematics", "Arabic", "English", "French", "German",
  "Science", "Physics", "Chemistry", "Biology", "Geology",
  "History", "Geography", "Philosophy", "Religion", "Computer",
  "Quran", "Psychology", "Statistics", "Algebra", "Geometry",
  "Course",
];

/** Localized subject labels. Falls back to the English key. */
export const SUBJECT_LABELS: Record<string, { en: string; ar: string }> = {
  Mathematics: { en: "Mathematics", ar: "رياضيات" },
  Arabic: { en: "Arabic", ar: "لغة عربية" },
  English: { en: "English", ar: "لغة إنجليزية" },
  French: { en: "French", ar: "لغة فرنسية" },
  German: { en: "German", ar: "لغة ألمانية" },
  Science: { en: "Science", ar: "علوم" },
  Physics: { en: "Physics", ar: "فيزياء" },
  Chemistry: { en: "Chemistry", ar: "كيمياء" },
  Biology: { en: "Biology", ar: "أحياء" },
  Geology: { en: "Geology", ar: "جيولوجيا" },
  History: { en: "History", ar: "تاريخ" },
  Geography: { en: "Geography", ar: "جغرافيا" },
  Philosophy: { en: "Philosophy", ar: "فلسفة ومنطق" },
  Religion: { en: "Religion", ar: "تربية دينية" },
  Computer: { en: "Computer", ar: "حاسب آلي" },
  Quran: { en: "Quran", ar: "قرآن كريم" },
  Psychology: { en: "Psychology", ar: "علم نفس واجتماع" },
  Statistics: { en: "Statistics", ar: "إحصاء" },
  Algebra: { en: "Algebra", ar: "جبر" },
  Geometry: { en: "Geometry", ar: "هندسة" },
  Course: { en: "Course", ar: "كورس" },
};

export function subjectLabel(subject: string | undefined, lang: Lang): string {
  if (!subject) return "—";
  const m = SUBJECT_LABELS[subject];
  if (m) return lang === "ar" ? m.ar : m.en;
  return subject; // custom subject kept verbatim
}

/* ----------------------- Academic-year promotion ----------------------- */
/**
 * Returns the next grade id along the Egyptian ladder, or null if the student
 * has already graduated (Grade 3 Secondary) or the grade is custom/unknown
 * (course students are left untouched).
 */
export function nextGrade(gradeId: string | undefined): string | null {
  if (!gradeId) return null;
  const idx = GRADES.findIndex((g) => g.id === gradeId);
  if (idx === -1) return null; // custom grade → skip (course student)
  if (idx >= GRADES.length - 1) return null; // already at S3 → graduated
  return GRADES[idx + 1].id;
}

/* ------------------------- Password obfuscation ------------------------ */
/** Lightweight reversible obfuscation (local-first demo, NOT real security). */
export function obfuscate(text: string): string {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return text;
  }
}
export function deobfuscate(cipher: string): string {
  try {
    return decodeURIComponent(escape(atob(cipher)));
  } catch {
    return "";
  }
}

/* ------------------------------ Currencies ------------------------------ */
export interface Currency {
  code: string;
  symbol: string;
  en: string;
  ar: string;
}
export const CURRENCIES: Currency[] = [
  { code: "EGP", symbol: "ج.م", en: "Egyptian Pound", ar: "جنيه مصري" },
  { code: "SAR", symbol: "ر.س", en: "Saudi Riyal", ar: "ريال سعودي" },
  { code: "AED", symbol: "د.إ", en: "UAE Dirham", ar: "درهم إماراتي" },
  { code: "USD", symbol: "$", en: "US Dollar", ar: "دولار أمريكي" },
  { code: "EUR", symbol: "€", en: "Euro", ar: "يورو" },
  { code: "GBP", symbol: "£", en: "British Pound", ar: "جنيه إسترليني" },
  { code: "KWD", symbol: "د.ك", en: "Kuwaiti Dinar", ar: "دينار كويتي" },
  { code: "QAR", symbol: "ر.ق", en: "Qatari Riyal", ar: "ريال قطري" },
  { code: "BHD", symbol: "د.ب", en: "Bahraini Dinar", ar: "دينار بحريني" },
  { code: "OMR", symbol: "ر.ع", en: "Omani Rial", ar: "ريال عماني" },
  { code: "JOD", symbol: "د.أ", en: "Jordanian Dinar", ar: "دينار أردني" },
  { code: "MAD", symbol: "د.م", en: "Moroccan Dirham", ar: "درهم مغربي" },
  { code: "DZD", symbol: "د.ج", en: "Algerian Dinar", ar: "دينار جزائري" },
  { code: "TND", symbol: "د.ت", en: "Tunisian Dinar", ar: "دينار تونسي" },
  { code: "LYD", symbol: "د.ل", en: "Libyan Dinar", ar: "دينار ليبي" },
  { code: "IQD", symbol: "ع.د", en: "Iraqi Dinar", ar: "دينار عراقي" },
  { code: "SYP", symbol: "ل.س", en: "Syrian Pound", ar: "ليرة سورية" },
  { code: "LBP", symbol: "ل.ل", en: "Lebanese Pound", ar: "ليرة لبنانية" },
  { code: "TRY", symbol: "₺", en: "Turkish Lira", ar: "ليرة تركية" },
  { code: "SDG", symbol: "ج.س", en: "Sudanese Pound", ar: "جنيه سوداني" },
  { code: "YER", symbol: "ر.ي", en: "Yemeni Rial", ar: "ريال يمني" },
  { code: "ETB", symbol: "Br", en: "Ethiopian Birr", ar: "بير إثيوبي" },
];

export const DEFAULT_CURRENCY = "EGP";

export function currencyOf(code: string | undefined): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
export function currencySymbolOf(code: string | undefined): string {
  return currencyOf(code).symbol;
}

/* --------------------------- 12-hour time fmt --------------------------- */
/** "HH:mm" (24h) -> { h, m, period } where period is AM/PM */
export function splitTime(t: string): { h: number; m: number; period: "AM" | "PM" } {
  const [hh, mm] = t.split(":").map(Number);
  const period: "AM" | "PM" = hh < 12 ? "AM" : "PM";
  let h = hh % 12;
  if (h === 0) h = 12;
  return { h, m: mm ?? 0, period };
}

/** "16:00" -> "4:00 م" (ar) or "4:00 PM" (en) */
export function formatTime12(t: string, lang: Lang): string {
  if (!t) return "—";
  const { h, m, period } = splitTime(t);
  const mm = String(m).padStart(2, "0");
  if (lang === "ar") return `${h}:${mm} ${period === "AM" ? "ص" : "م"}`;
  return `${h}:${mm} ${period}`;
}

/** build "HH:mm" from 12h parts */
export function buildTime(h: number, m: number, period: "AM" | "PM"): string {
  let hh = h % 12;
  if (period === "PM") hh += 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const TIME_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const TIME_MINUTES = [0, 5, 10, 15, 20, 30, 45];
