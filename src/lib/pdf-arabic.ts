/**
 * Arabic-Supported PDF Generator
 * ================================
 * Uses standard HTML in a print window (window.print()) to render content,
 * which properly displays Arabic and RTL text natively via the browser.
 * This guarantees perfect Arabic rendering with correct font shaping and RTL.
 */

import type { DatabaseShape, Student, AttendanceStatus } from "./types";
import {
  studentAverage, totalPaidFor, balanceDue,
  currencySymbol, formatMoney, studentMonthAttendance,
} from "./analytics";
import { monthKey, now } from "./db";
import { gradeLabel } from "./constants";
import type { Lang } from "../i18n/translations";
import { pushToast } from "../components/ui";

// @ts-ignore
import _html2pdf from "html2pdf.js";
const html2pdf = (typeof _html2pdf === "function" ? _html2pdf : (_html2pdf as any)?.default) || (window as any).html2pdf;

/**
 * Downloads any styled HTML string directly as a PDF using html2pdf.js
 * Restored for native PDF file downloads with precise width constraints to prevent clipping.
 */
export async function downloadHtmlAsPdf(title: string, htmlContent: string, isAr: boolean = true): Promise<void> {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "0px";
  wrapper.style.top = "0px";
  wrapper.style.width = "1px";
  wrapper.style.height = "1px";
  wrapper.style.overflow = "hidden";
  wrapper.style.zIndex = "99999";
  wrapper.style.pointerEvents = "none";

  const container = document.createElement("div");
  // Set the container to EXACTLY 680px width, which fits perfectly within the A4 printable area (718px at 96dpi)
  container.style.width = "680px";
  container.style.background = "white";
  container.style.padding = "20px";
  container.style.boxSizing = "border-box";
  container.style.direction = isAr ? "rtl" : "ltr";
  
  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
      * { 
        font-family: ${isAr ? "'Cairo', 'Tahoma', sans-serif" : "'Inter', sans-serif"} !important; 
        box-sizing: border-box; 
      }
      body { 
        background: white; 
        margin: 0; 
        padding: 0; 
        color: #0f172a; 
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 15px; 
        margin-bottom: 25px; 
        border: 1px solid #e2e8f0; 
        border-radius: 8px; 
        overflow: hidden; 
        background: white; 
      }
      th { 
        background-color: #f8fafc; 
        color: #475569; 
        font-weight: 700; 
        font-size: 12px; 
        border-bottom: 2px solid #e2e8f0; 
        text-transform: uppercase; 
      }
      th, td { 
        padding: 12px 14px; 
        text-align: ${isAr ? "right" : "left"}; 
        border-bottom: 1px solid #e2e8f0; 
      }
      tr:nth-child(even) { 
        background-color: #f8fafc; 
      }
      tr:last-child td { 
        border-bottom: none; 
      }
      
      /* Alignment & Wrapping Utilities to prevent clipped text/numbers */
      .text-right { text-align: right !important; }
      .text-center { text-align: center !important; }
      .text-left { text-align: left !important; }
      .no-wrap { white-space: nowrap !important; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 11px; white-space: nowrap; }
      
      /* Beautiful custom styling elements for report sections */
      .section-title { 
        font-size: 16px; 
        font-weight: 800; 
        margin-bottom: 14px; 
        color: #4f46e5; 
        border-bottom: 2px solid #e2e8f0; 
        padding-bottom: 8px; 
      }
      
      /* Header Banner Design */
      .header-banner {
        background: linear-gradient(135deg, #6D5DFC, #4F46E5);
        color: white;
        padding: 22px 25px;
        border-radius: 12px;
        margin-bottom: 25px;
        width: 100%;
        box-sizing: border-box;
      }
      .header-banner-table {
        width: 100%;
        border-collapse: collapse;
        border: none;
        background: transparent;
        margin: 0;
        padding: 0;
      }
      .header-banner-row {
        background: transparent !important;
      }
      .header-banner-td {
        padding: 0;
        border: none !important;
        vertical-align: middle;
      }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
    </style>
    ${htmlContent}
  `;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  const opt = {
    margin: [10, 10, 10, 10], // Safe A4 Margins
    filename: `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { 
      scale: 2.5, // High resolution crisp output
      useCORS: true, 
      letterRendering: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowScrollX: 0,
      windowScrollY: 0
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  try {
    // Wait for fonts & rendering to stabilize
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (!html2pdf) {
      throw new Error("html2pdf library is not loaded");
    }
    await html2pdf().from(container).set(opt).save();
    pushToast(isAr ? "✅ تم تحميل ملف الـ PDF بنجاح!" : "✅ PDF downloaded successfully!", "success");
  } catch (error) {
    console.error("Error generating PDF:", error);
    pushToast(isAr ? "❌ فشل تحميل ملف الـ PDF." : "❌ PDF generation failed.", "error");
  } finally {
    document.body.removeChild(wrapper);
  }
}

/**
 * Generates a student PDF report.
 * Accepts the current language to render in Arabic or English.
 */
export async function generateStudentPdf(db: DatabaseShape, student: Student, lang: Lang = "ar"): Promise<void> {
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const fontFamily = isAr ? "'Cairo', 'Tahoma', sans-serif" : "'Inter', sans-serif";

  // Build the report HTML
  const html = buildStudentReportHtml(db, student, isAr, sym, fontFamily);
  await downloadHtmlAsPdf(`${student.name}_Report`, html, isAr);
}

export interface AbsentStudentResult {
  student: Student;
  consecutiveAbsences: number;
  lastAttendedDate: number | null;
  totalAbsences: number;
}

export function getAbsentStudents(db: DatabaseShape, mode: string): AbsentStudentResult[] {
  const nowMs = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  return db.students
    .filter(s => !s.isArchived)
    .map(s => {
      const atts = db.attendance
        .filter(a => a.studentId === s.id)
        .sort((a, b) => b.date - a.date);
        
      const totalAbsences = atts.filter(a => a.status === "ABSENT").length;
      const lastActiveRecord = atts.find(a => a.status === "PRESENT" || a.status === "LATE");
      const lastAttendedDate = lastActiveRecord ? lastActiveRecord.date : null;
      
      let consecutiveAbsences = 0;
      for (const a of atts) {
        if (a.status === "ABSENT") {
          consecutiveAbsences++;
        } else if (a.status === "PRESENT" || a.status === "LATE") {
          break;
        }
      }
      
      return {
        student: s,
        consecutiveAbsences,
        lastAttendedDate,
        totalAbsences
      };
    }).filter(res => {
      if (mode === "1") return res.consecutiveAbsences >= 1;
      if (mode === "2") return res.consecutiveAbsences >= 2;
      if (mode === "3") return res.consecutiveAbsences >= 3;
      if (mode === "4") return res.consecutiveAbsences >= 4;
      if (mode === "5") return res.consecutiveAbsences >= 5;
      if (mode === "6") return res.consecutiveAbsences >= 6;
      
      if (mode === "month") {
        if (res.lastAttendedDate === null) {
          const regDate = res.student.registrationDate || 0;
          return (nowMs - regDate) > 30 * oneDay;
        }
        return (nowMs - res.lastAttendedDate) > 30 * oneDay;
      }
      
      if (mode === "long_time") {
        if (res.lastAttendedDate === null) {
          const regDate = res.student.registrationDate || 0;
          return (nowMs - regDate) > 60 * oneDay;
        }
        return (nowMs - res.lastAttendedDate) > 60 * oneDay;
      }
      
      return false;
    });
}

export async function exportAbsenceReportPdf(db: DatabaseShape, mode: string, lang: Lang = "ar"): Promise<void> {
  const isAr = lang === "ar";
  const results = getAbsentStudents(db, mode);

  const modeLabels: Record<string, string> = {
    "1": isAr ? "حصة واحدة غياب أو أكثر" : "1+ Session Absence",
    "2": isAr ? "غياب حصتين متتاليتين أو أكثر" : "2+ Consecutive Absences",
    "3": isAr ? "غياب ثلاث حصص متتالية أو أكثر" : "3+ Consecutive Absences",
    "4": isAr ? "غياب أربع حصص متتالية أو أكثر" : "4+ Consecutive Absences",
    "5": isAr ? "غياب خمس حصص متتالية أو أكثر" : "5+ Consecutive Absences",
    "6": isAr ? "غياب ست حصص متتالية أو أكثر" : "6+ Consecutive Absences",
    "month": isAr ? "شهر كامل" : "Full Month Absence",
    "long_time": isAr ? "منذ مدة" : "Prolonged Inactivity",
  };

  const titleAr = `تقرير الانقطاع والغياب المتكرر (${modeLabels[mode] || mode})`;
  const titleEn = `Absence & Non-Attendance Report (${modeLabels[mode] || mode})`;
  const title = isAr ? titleAr : titleEn;

  let html = `
    <div class="header-banner" style="background: linear-gradient(135deg, #F59E0B, #D97706);">
      <table class="header-banner-table" dir="rtl">
        <tr class="header-banner-row">
          <td class="header-banner-td" style="text-align: right;">
            <div style="font-size: 24px; font-weight: 800;">${db.profile.name || "Center Plus"}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 6px; font-weight: 600;">${titleAr}</div>
            <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${titleEn}</div>
          </td>
          <td class="header-banner-td" style="text-align: left; opacity: 0.85; font-size: 11px; line-height: 1.5;">
            تاريخ الإصدار / Issued:<br/>
            <strong>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}</strong>
          </td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;" dir="${isAr ? "rtl" : "ltr"}">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 15%;" class="${isAr ? "text-right" : "text-left"}">الكود / Code</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 35%;" class="${isAr ? "text-right" : "text-left"}">الاسم / Name</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 20%;" class="${isAr ? "text-right" : "text-left"}">الصف / Grade</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: center; font-weight: 700; width: 15%;" class="text-center">الغياب المتتالي / Consec. Abs.</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "left" : "right"}; font-weight: 700; width: 15%;" class="${isAr ? "text-left" : "text-right"}">آخر حضور / Last Attendance</th>
        </tr>
      </thead>
      <tbody>
        ${results.length === 0 ? `
          <tr>
            <td colspan="5" style="padding: 25px; text-align: center; color: #64748b; font-weight: 500;" class="text-center">
              ${isAr ? "لا توجد حالات غياب متطابقة مع هذا الاختيار حالياً!" : "No absence cases match this selection currently!"}
            </td>
          </tr>
        ` : results.map(r => {
          const gradeBilingual = `${gradeLabel(r.student.grade, "ar")} · ${gradeLabel(r.student.grade, "en")}`;
          const lastAttText = r.lastAttendedDate 
            ? new Date(r.lastAttendedDate).toLocaleDateString(isAr ? "ar-EG" : "en-US")
            : (isAr ? "لم يحضر مطلقاً" : "Never attended");
          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;" class="no-wrap">${r.student.id}</td>
              <td style="font-weight: 700; padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${r.student.name}</td>
              <td style="color: #64748b; padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${gradeBilingual}</td>
              <td style="text-align: center; font-weight: 800; padding: 10px; border-bottom: 1px solid #e2e8f0; color: #d97706; font-size: 14px;" class="text-center">${r.consecutiveAbsences}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;" class="${isAr ? "text-left" : "text-right"} no-wrap">${lastAttText}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
      Center Plus Desktop · /centers/${db.profile.centerId} · إجمالي الحالات المستخرجة: ${results.length} طالب
    </div>
  `;

  await downloadHtmlAsPdf(title, html, isAr);
}

export async function exportLateStudentsPdf(db: DatabaseShape, lang: Lang = "ar"): Promise<void> {
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const lateStudents = db.students.filter(s => !s.isArchived && balanceDue(db, s) > 0);

  const titleAr = "تقرير المديونيات والمتأخرين عن السداد";
  const titleEn = "Outstanding Balances & Unpaid Students Report";
  const title = isAr ? titleAr : titleEn;

  let html = `
    <div class="header-banner" style="background: linear-gradient(135deg, #EF4444, #B91C1C);">
      <table class="header-banner-table" dir="rtl">
        <tr class="header-banner-row">
          <td class="header-banner-td" style="text-align: right;">
            <div style="font-size: 24px; font-weight: 800;">${db.profile.name || "Center Plus"}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 6px; font-weight: 600;">${titleAr}</div>
            <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${titleEn}</div>
          </td>
          <td class="header-banner-td" style="text-align: left; opacity: 0.85; font-size: 11px; line-height: 1.5;">
            تاريخ الإصدار / Issued:<br/>
            <strong>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}</strong>
          </td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;" dir="${isAr ? "rtl" : "ltr"}">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 15%;" class="${isAr ? "text-right" : "text-left"}">الكود / Code</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 30%;" class="${isAr ? "text-right" : "text-left"}">الاسم / Name</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 20%;" class="${isAr ? "text-right" : "text-left"}">الهاتف / Parent Phone</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 20%;" class="${isAr ? "text-right" : "text-left"}">الصف / Grade</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "left" : "right"}; font-weight: 700; width: 15%;" class="${isAr ? "text-left" : "text-right"}">المديونية المستحقة / Balance Due</th>
        </tr>
      </thead>
      <tbody>
        ${lateStudents.length === 0 ? `
          <tr>
            <td colspan="5" style="padding: 25px; text-align: center; color: #64748b; font-weight: 500;" class="text-center">
              ${isAr ? "لا يوجد طلاب متأخرون في الدفع حالياً. كل الحسابات مسددة!" : "No late paying students. All balances are fully settled!"}
            </td>
          </tr>
        ` : lateStudents.map(s => {
          const dueAmt = balanceDue(db, s);
          const gradeBilingual = `${gradeLabel(s.grade, "ar")} · ${gradeLabel(s.grade, "en")}`;
          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;" class="no-wrap">${s.id}</td>
              <td style="font-weight: 700; padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${s.name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 600; color: #475569;" class="no-wrap">${s.parentPhone || "—"}</td>
              <td style="color: #64748b; padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${gradeBilingual}</td>
              <td style="color: #dc2626; font-weight: 800; padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px;" class="${isAr ? "text-left" : "text-right"} no-wrap">${formatMoney(dueAmt, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 13px; color: #dc2626; font-weight: 800;" class="text-center">
      Center Plus Desktop · /centers/${db.profile.centerId} · إجمالي المديونيات المتأخرة: <span style="background: #fee2e2; padding: 4px 12px; border-radius: 6px; border: 1px solid #fecaca;">${formatMoney(lateStudents.reduce((acc, s) => acc + balanceDue(db, s), 0), sym)}</span>
    </div>
  `;

  await downloadHtmlAsPdf(title, html, isAr);
}

export async function exportUnpaidCenterSubPdf(db: DatabaseShape, lang: Lang = "ar"): Promise<void> {
  const isAr = lang === "ar";
  const curMonth = monthKey(now());
  
  const unpaidStudents = db.students.filter(s => {
    if (s.isArchived) return false;
    const paid = db.payments.some(
      (p) => p.studentId === s.id && p.month === curMonth && (p.forCenter === true || p.type === "CENTER_SUBSCRIPTION")
    );
    return !paid;
  });

  const titleAr = "تقرير غير مسددي اشتراك السنتر";
  const titleEn = "Unpaid Center Subscription Report";
  const title = isAr ? titleAr : titleEn;

  let html = `
    <div class="header-banner" style="background: linear-gradient(135deg, #F59E0B, #D97706);">
      <table class="header-banner-table" dir="rtl">
        <tr class="header-banner-row">
          <td class="header-banner-td" style="text-align: right;">
            <div style="font-size: 24px; font-weight: 800;">${db.profile.name || "Center Plus"}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 6px; font-weight: 600;">${titleAr}</div>
            <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">الشهر الحالي / Month: ${curMonth} · ${titleEn}</div>
          </td>
          <td class="header-banner-td" style="text-align: left; opacity: 0.85; font-size: 11px; line-height: 1.5;">
            تاريخ الإصدار / Issued:<br/>
            <strong>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}</strong>
          </td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;" dir="${isAr ? "rtl" : "ltr"}">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 15%;" class="${isAr ? "text-right" : "text-left"}">الكود / Code</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 35%;" class="${isAr ? "text-right" : "text-left"}">الاسم / Name</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 25%;" class="${isAr ? "text-right" : "text-left"}">الهاتف / Parent Phone</th>
          <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; text-align: ${isAr ? "right" : "left"}; font-weight: 700; width: 25%;" class="${isAr ? "text-right" : "text-left"}">الصف / Grade</th>
        </tr>
      </thead>
      <tbody>
        ${unpaidStudents.length === 0 ? `
          <tr>
            <td colspan="4" style="padding: 25px; text-align: center; color: #64748b; font-weight: 500;" class="text-center">
              ${isAr ? "كل الطلاب سددوا اشتراك السنتر لهذا الشهر!" : "All students have paid their center subscription for this month!"}
            </td>
          </tr>
        ` : unpaidStudents.map(s => {
          const gradeBilingual = `${gradeLabel(s.grade, "ar")} · ${gradeLabel(s.grade, "en")}`;
          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;" class="no-wrap">${s.id}</td>
              <td style="font-weight: 700; padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${s.name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 600; color: #475569;" class="no-wrap">${s.parentPhone || "—"}</td>
              <td style="color: #64748b; padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${gradeBilingual}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 13px; color: #d97706; font-weight: 800;" class="text-center">
      Center Plus Desktop · /centers/${db.profile.centerId} · إجمالي غير المسددين لاشتراك السنتر للشهر الحالي: <span style="background: #fef3c7; padding: 4px 12px; border-radius: 6px; border: 1px solid #fde68a;">${unpaidStudents.length} طالب</span>
    </div>
  `;

  await downloadHtmlAsPdf(title, html, isAr);
}

function buildStudentReportHtml(db: DatabaseShape, student: Student, _isAr: boolean, sym: string, fontFamily: string): string {
  const studentAtt = studentMonthAttendance(db, student.id, monthKey(now()));
  const attRate = Math.round(studentAtt.rate);
  const avg = studentAverage(db, student.id);
  const paid = totalPaidFor(db, student.id);
  const due = balanceDue(db, student);
  const group = db.groups.find((g) => student.groupIds?.includes(g.id));

  const grades = db.examGrades
    .filter((g) => g.studentId === student.id)
    .map((g) => ({ g, exam: db.exams.find((e) => e.id === g.examId) }))
    .filter((x) => x.exam)
    .slice(-8)
    .reverse();

  const payments = db.payments
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => b.date - a.date)
    .slice(0, 10);

  // Attendance history for this student (most recent first)
  const attendance = db.attendance
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => b.date - a.date)
    .slice(0, 30);

  // Always bilingual labels
  const L = {
    title: "تقرير الطالب الشامل / Student Comprehensive Report",
    name: "الاسم / Name",
    code: "الكود / Code",
    grade: "الصف الدراسي / Academic Grade",
    group: "المجموعة / Group",
    attendance: "نسبة الحضور / Attendance Rate",
    avgGrade: "متوسط الدرجات / Average Grade",
    totalPaid: "إجمالي المدفوع / Total Paid",
    balanceDue: "الرصيد المستحق / Balance Due",
    liability: "الالتزام / Liability",
    paid: "مدفوع / Paid",
    due: "مستحق / Due",
    transactions: "سجل المدفوعات / Payment Transactions",
    date: "التاريخ / Date",
    type: "النوع / Type",
    amount: "المبلغ / Amount",
    month: "الشهر / Month",
    recentGrades: "أحدث الدرجات / Recent Grades",
    exam: "الامتحان / Exam",
    gradeCol: "الدرجة / Grade",
    attendanceHistory: "سجل الحضور والغياب / Attendance History",
    status: "الحالة / Status",
    noData: "لا توجد بيانات / No data available",
  };

  const paymentTypeLabels: Record<string, string> = {
    REGISTRATION: "تسجيل / Registration",
    MONTHLY_FEE: "اشتراك شهري / Monthly Fee",
    EXAM_FEE: "رسوم امتحان / Exam Fee",
    BOOK_FEE: "ثمن كتب / Books Fee",
    OTHER: "أخرى / Other",
  };

  const studentGradeBilingual = `${gradeLabel(student.grade, "ar")} · ${gradeLabel(student.grade, "en")}`;

  return `
  <div style="width: 100%; box-sizing: border-box; background: white; color: #0f172a; font-family: ${fontFamily};" dir="rtl">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6D5DFC, #4F46E5); color: white; padding: 25px 30px; border-radius: 12px; margin-bottom: 25px;">
      <div style="display: table; width: 100%;">
        <div style="display: table-row;">
          <div style="display: table-cell; text-align: right; vertical-align: middle;">
            <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${db.profile.name || "Center Plus"}</div>
            <div style="font-size: 13px; opacity: 0.85; margin-top: 6px; font-weight: 500;">${L.title}</div>
          </div>
          <div style="display: table-cell; text-align: left; vertical-align: middle; opacity: 0.85; font-size: 11px; line-height: 1.5;">
            تاريخ الإصدار / Issued:<br/>
            <strong>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Student Info Bento Card -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: right; box-sizing: border-box;">
      <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        👤 ${student.name}
      </div>
      <table style="width: 100%; border: none; background: transparent; margin: 0; padding: 0;" dir="rtl">
        <tr style="background: transparent;">
          <td style="width: 33.3%; padding: 4px 8px; border: none; font-size: 13px; color: #475569;">
            <strong style="color: #64748b;">${L.code}:</strong> 
            <span style="font-family: monospace; font-weight: 700; background: #e2e8f0; padding: 3px 8px; border-radius: 6px; color: #0f172a; font-size: 12px; border: 1px solid #cbd5e1;">${student.id}</span>
          </td>
          <td style="width: 33.3%; padding: 4px 8px; border: none; font-size: 13px; color: #475569;">
            <strong style="color: #64748b;">${L.grade}:</strong> 
            <span style="font-weight: 700; color: #0f172a;">${studentGradeBilingual}</span>
          </td>
          <td style="width: 33.3%; padding: 4px 8px; border: none; font-size: 13px; color: #475569;">
            <strong style="color: #64748b;">${L.group}:</strong> 
            <span style="font-weight: 700; color: #0f172a;">${group?.name ?? "—"}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- KPI Summary Cards Grid -->
    <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; border: none; margin: 15px 0 25px 0; background: transparent;" dir="rtl">
      <tr style="background: transparent;">
        ${buildKpi(L.attendance, `${attRate}%`, "#10b981")}
        ${buildKpi(L.avgGrade, avg != null ? `${Math.round(avg)}%` : "—", "#6d5dfc")}
        ${buildKpi(L.totalPaid, formatMoney(paid, sym), "#059669")}
        ${buildKpi(L.balanceDue, formatMoney(due, sym), "#dc2626")}
      </tr>
    </table>

    <!-- Attendance History -->
    <div style="margin-bottom: 30px; text-align: right; page-break-inside: avoid;">
      <div style="font-size: 16px; font-weight: 800; margin-bottom: 14px; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
        📅 ${L.attendanceHistory}
      </div>
      ${attendance.length === 0 ? `<div style="color: #94a3b8; text-align: center; padding: 25px; border: 1px dashed #e2e8f0; border-radius: 8px;">${L.noData}</div>` : `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;" dir="rtl">
          <thead>
            <tr>
              <th style="width: 35%;">${L.date}</th>
              <th style="width: 35%;">${L.group}</th>
              <th style="width: 30%; text-align: center;">${L.status}</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.map((r) => {
              const si = statusInfo(r.status);
              const grp = db.groups.find((g) => g.id === r.groupId);
              return `
              <tr>
                <td style="padding: 12px 14px; font-weight: 600;">${new Date(r.date).toLocaleDateString("en-GB")} (${new Date(r.date).toLocaleDateString("ar-EG")})</td>
                <td style="padding: 12px 14px; font-weight: 500; color: #334155;">${grp?.name ?? "—"}</td>
                <td style="padding: 12px 14px; text-align: center;">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: ${si.color}15; color: ${si.color}; font-weight: 700; font-size: 11px; border: 1px solid ${si.color}30; white-space: nowrap;">${si.label}</span>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      `}
    </div>

    <!-- Grades Table -->
    <div style="margin-bottom: 30px; text-align: right; page-break-inside: avoid;">
      <div style="font-size: 16px; font-weight: 800; margin-bottom: 14px; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
        📝 ${L.recentGrades}
      </div>
      ${grades.length === 0 ? `<div style="color: #94a3b8; text-align: center; padding: 25px; border: 1px dashed #e2e8f0; border-radius: 8px;">${L.noData}</div>` : `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;" dir="rtl">
          <thead>
            <tr>
              <th style="width: 50%;">${L.exam}</th>
              <th style="width: 25%; text-align: center;">${L.gradeCol}</th>
              <th style="width: 25%; text-align: center;">%</th>
            </tr>
          </thead>
          <tbody>
            ${grades.map(({ g, exam }) => {
              const pct = exam!.maxGrade > 0 ? Math.round((g.obtainedGrade / exam!.maxGrade) * 100) : 0;
              const pctColor = pct >= 85 ? "#059669" : pct >= 50 ? "#4f46e5" : "#dc2626";
              return `
              <tr>
                <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">📝 ${exam!.name}</td>
                <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #334155;">${g.obtainedGrade} / ${exam!.maxGrade}</td>
                <td style="padding: 12px 14px; text-align: center;">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: ${pctColor}10; color: ${pctColor}; font-weight: 800; font-size: 12px; border: 1px solid ${pctColor}25;">${pct}%</span>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      `}
    </div>

    <!-- Payment Transactions -->
    <div style="margin-bottom: 30px; text-align: right; page-break-inside: avoid;">
      <div style="font-size: 16px; font-weight: 800; margin-bottom: 14px; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
        💳 ${L.transactions}
      </div>
      ${payments.length === 0 ? `<div style="color: #94a3b8; text-align: center; padding: 25px; border: 1px dashed #e2e8f0; border-radius: 8px;">${L.noData}</div>` : `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;" dir="rtl">
          <thead>
            <tr>
              <th style="width: 25%;">${L.date}</th>
              <th style="width: 35%;">${L.type}</th>
              <th style="width: 20%; text-align: center;" class="text-center">${L.month}</th>
              <th style="width: 20%; text-align: left;" class="text-left">${L.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((p) => {
              const label = paymentTypeLabels[p.type] || p.type.replace(/_/g, " ");
              return `
              <tr>
                <td style="padding: 12px 14px; font-weight: 500; color: #64748b;">${new Date(p.date).toLocaleDateString("en-GB")}</td>
                <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">💰 ${label}</td>
                <td style="padding: 12px 14px; text-align: center; font-weight: 600; color: #475569;" class="text-center">${p.month || monthKey(p.date)}</td>
                <td style="padding: 12px 14px; color: #059669; font-weight: 700; font-size: 14px;" class="text-left no-wrap">${formatMoney(p.amount, sym)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      `}
    </div>

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
      Center Plus Desktop · /centers/${db.profile.centerId}/students/${student.id}
    </div>
  </div>`;
}

function buildKpi(label: string, value: string, color: string): string {
  const fontSize = value.length > 12 ? "13px" : value.length > 9 ? "16px" : "20px";
  return `
    <td style="width: 25%; background: ${color}0d; border: 1px solid ${color}25; border-radius: 12px; padding: 16px 12px; text-align: center; vertical-align: middle; box-sizing: border-box;">
      <div style="font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap;">${label}</div>
      <div class="no-wrap" style="font-size: ${fontSize}; font-weight: 800; color: ${color}; font-family: 'Cairo', sans-serif; white-space: nowrap;">${value}</div>
    </td>
  `;
}

function statusInfo(status: AttendanceStatus): { label: string; color: string } {
  switch (status) {
    case "PRESENT": return { label: "حاضر / Present", color: "#059669" };
    case "LATE": return { label: "متأخر / Late", color: "#d97706" };
    case "ABSENT": return { label: "غائب / Absent", color: "#dc2626" };
    case "EXCUSED": return { label: "بعذر / Excused", color: "#4b5563" };
    default: return { label: status, color: "#6b7280" };
  }
}

/** Backward-compatible export */
export { generateStudentPdf as default };
