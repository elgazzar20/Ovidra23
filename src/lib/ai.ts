import type { DatabaseShape, Student } from "./types";
import type { Lang } from "../i18n/translations";
import {
  attendanceRate,
  studentAverage,
  balanceDue,
  totalPaidFor,
  liabilityMonths,
  currencySymbol,
  formatMoney,
} from "./analytics";

/* ----------------------------- Gemini config ---------------------------- */
export const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AQ.Ab8RN6Jbp8Au2T6bBGUKd1gT3g16pGnkYfOiR_dmOuMozQM_dA";

export function getEffectiveApiKey(centerKey?: string, globalKey?: string): string {
  const oldBadKey = "AQ.Ab8RN6Jbp8Au2T6bBGUKd1gT3g16pGnkYfOiR_dmOuMozQM_dA";
  
  const cleanCenter = (centerKey || "").trim();
  if (cleanCenter && cleanCenter !== oldBadKey) {
    return cleanCenter;
  }
  
  const cleanGlobal = (globalKey || "").trim();
  if (cleanGlobal && cleanGlobal !== oldBadKey) {
    return cleanGlobal;
  }
  
  const cleanDefault = (DEFAULT_GEMINI_KEY || "").trim();
  if (cleanDefault && cleanDefault !== oldBadKey) {
    return cleanDefault;
  }
  
  return "";
}

interface GeminiOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Low-level Gemini call. Uses the passed key, falling back to the built-in
 *  default key from the environment. Returns generated text, or throws. */
async function callGemini(prompt: string, opts: GeminiOptions = {}, apiKey?: string): Promise<string> {
  const key = (apiKey && apiKey.trim()) || DEFAULT_GEMINI_KEY;
  if (!key) throw new Error("Gemini API key not configured");

  // A resilient list of models to try in sequence — updated for best compatibility in 2026
  const models = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const body: Record<string, unknown> = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxOutputTokens ?? 800,
        },
      };
      if (opts.systemInstruction) {
        body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
      }

      // Support custom proxy base URL from environment (e.g. Cloudflare AI Gateway)
      const proxyUrl = import.meta.env.VITE_AI_PROXY_URL || "";
      const baseUrl = proxyUrl ? proxyUrl.replace(/\/$/, "") : "https://generativelanguage.googleapis.com";
      const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${key.trim()}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": key.trim()
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
      }

      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty Gemini response");
      return text;
    } catch (e) {
      console.warn(`Gemini model ${model} failed, trying next fallback...`, e);
      lastError = e as Error;
    }
  }

  throw lastError || new Error("All Gemini models in fallback chain failed.");
}

/** Free-form chat with Gemini for advanced/general questions. */
export async function geminiChat(prompt: string, systemInstruction: string, apiKey?: string): Promise<string> {
  return callGemini(prompt, { systemInstruction, temperature: 0.7, maxOutputTokens: 4000 }, apiKey);
}

/* --------------------------- Student analysis --------------------------- */
/** Constructs the structured prompt for a per-student analysis. */
export function buildPrompt(db: DatabaseShape, student: Student, lang: Lang = "ar"): string {
  const sym = currencySymbol(db);
  const attRate = Math.round(attendanceRate(db, {}));
  const avg = studentAverage(db, student.id);
  const due = balanceDue(db, student);
  const paid = totalPaidFor(db, student.id);
  const months = liabilityMonths(student);

  const grades = db.examGrades
    .filter((g) => g.studentId === student.id)
    .map((g) => {
      const exam = db.exams.find((e) => e.id === g.examId);
      return exam
        ? `- ${exam.name}: ${g.obtainedGrade}/${exam.maxGrade} (${Math.round(
            (g.obtainedGrade / exam.maxGrade) * 100,
          )}%)`
        : "";
    })
    .filter(Boolean)
    .join("\n");

  const homework = db.assignments
    .filter((a) => student.groupIds?.includes(a.groupId))
    .map((a) => `- ${a.title} (due ${new Date(a.dueDate).toLocaleDateString()})`)
    .join("\n");

  const respondIn = lang === "ar" ? "Arabic" : "English";

  return `You are an expert academic advisor for an educational center.
Analyze the following student and provide:
1. A concise performance summary
2. Key strengths
3. Areas needing improvement
4. Three actionable recommendations for the teacher and parent

STUDENT:
- Name: ${student.name}
- Code: ${student.id}
- Grade level: ${student.grade}

METRICS:
- Attendance rate: ${attRate}%
- Average exam grade: ${avg != null ? Math.round(avg) + "%" : "no data"}
- Fee liability: ${months} months, total paid ${formatMoney(paid, sym)}, balance due ${formatMoney(due, sym)}

EXAM GRADES:
${grades || "- none"}

ACTIVE HOMEWORK:
${homework || "- none"}

Respond in ${respondIn}. Provide a warm, encouraging, and specific analysis.`;
}

export interface AiResult {
  text: string;
  usedApi: boolean;
}

/** Calls Gemini (if a key is available) for a per-student analysis, otherwise
 *  returns a fully local analysis that needs no internet. */
export async function generateInsight(
  db: DatabaseShape,
  student: Student,
  apiKey?: string,
  lang: Lang = "ar",
): Promise<AiResult> {
  const effectiveKey = (apiKey && apiKey.trim()) || DEFAULT_GEMINI_KEY;
  if (effectiveKey) {
    try {
      const text = await callGemini(buildPrompt(db, student, lang), { temperature: 0.7, maxOutputTokens: 800 }, effectiveKey);
      return { text, usedApi: true };
    } catch (e) {
      const reason = (e as Error).message;
      return {
        text: mockAnalysis(db, student, lang) + `\n\n⚠️ ${lang === "ar" ? `تعذّر الاتصال بـ Gemini (${reason}). يتم عرض التحليل المحلي.` : `Gemini call failed (${reason}). Showing local analysis.`}`,
        usedApi: false,
      };
    }
  }
  return { text: mockAnalysis(db, student, lang), usedApi: false };
}

/** Local, offline analysis — bilingual. Used when no Gemini key is configured
 *  or the Gemini call fails. */
function mockAnalysis(db: DatabaseShape, student: Student, lang: Lang = "ar"): string {
  const isAr = lang === "ar";
  const attRate = Math.round(attendanceRate(db, {}));
  const avg = studentAverage(db, student.id);
  const due = balanceDue(db, student);
  const paid = totalPaidFor(db, student.id);
  const sym = currencySymbol(db);

  const L = isAr ? {
    summary: "ملخص الأداء",
    strengths: "نقاط القوة",
    improve: "مجالات التحسين",
    recs: "توصيات",
    attLine: `${student.name} (${student.id}) نسبة حضوره ${attRate}%`,
    avgLine: avg != null ? `، متوسط الدرجات ${Math.round(avg)}%` : "، لا توجد درجات امتحانات بعد",
    payLine: `المدفوع ${formatMoney(paid, sym)}، المتبقي ${formatMoney(due, sym)}`,
    excellent: "التزام ممتاز — الحضور أعلى من متوسط الفصل.",
    consistent: "حضور منتظم في الحصص.",
    strong: "فهم أكاديمي قوي، يتفوق على 75% في المتوسط.",
    attLow: "الحضور يحتاج اهتمامًا؛ غياب الحصص يؤثر على الاستمرارية.",
    concepts: "المفاهيم الأساسية تحتاج تعزيزًا — يُنصح بتمارين إضافية.",
    fees: "وجود رسوم متأخرة قد يشكل ضغطًا؛ يُفضل التنسيق مع الأسرة.",
    r1: "تخصيص تمارين مستهدفة على أضعف المواضيع في أقرب امتحان.",
    r2: "متابعة أسبوعية قصيرة للحفاظ على الدافعية.",
    r3: "مشاركة هذا التقرير مع ولي الأمر والاتفاق على هدف واحد للشهر القادم.",
  } : {
    summary: "Performance Summary",
    strengths: "Key Strengths",
    improve: "Areas for Improvement",
    recs: "Recommendations",
    attLine: `${student.name} (${student.id}) shows an attendance rate of ${attRate}%`,
    avgLine: avg != null ? ` with an average exam grade of ${Math.round(avg)}%` : " with no graded exams yet",
    payLine: `total paid ${formatMoney(paid, sym)}, balance due ${formatMoney(due, sym)}`,
    excellent: "Excellent commitment — attendance is well above the class average.",
    consistent: "Consistent presence in sessions.",
    strong: "Strong academic grasp, scoring above 75% on average.",
    attLow: "Attendance needs attention; missing sessions affects continuity.",
    concepts: "Core concepts need reinforcement — consider extra practice.",
    fees: "Outstanding fees may be a stressor; coordinate with the family.",
    r1: "Assign targeted practice on the weakest recent exam topics.",
    r2: "Set a short weekly check-in to keep motivation high.",
    r3: "Share this report with the parent and agree on one shared goal for next month.",
  };

  const lines: string[] = [];
  lines.push(`**${L.summary}**`);
  lines.push(`${L.attLine}${L.avgLine}. ${L.payLine}.`);

  lines.push(`\n**${L.strengths}**`);
  if (attRate >= 85) lines.push(`• ${L.excellent}`);
  else lines.push(`• ${L.consistent}`);
  if (avg != null && avg >= 75) lines.push(`• ${L.strong}`);

  lines.push(`\n**${L.improve}**`);
  if (attRate < 80) lines.push(`• ${L.attLow}`);
  if (avg != null && avg < 60) lines.push(`• ${L.concepts}`);
  if (due > 0) lines.push(`• ${L.fees}`);

  lines.push(`\n**${L.recs}**`);
  lines.push(`1. ${L.r1}`);
  lines.push(`2. ${L.r2}`);
  lines.push(`3. ${L.r3}`);

  return lines.join("\n");
}
