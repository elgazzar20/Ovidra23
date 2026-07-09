import * as XLSX from "xlsx";
import type { DatabaseShape, Teacher, Student } from "./types";
import {
  totalRevenue,
  totalExpenses,
  totalCenterIncome,
  teacherRevenue,
  teacherCenterShare,
  studentNetFee,
  balanceDue,
  totalPaidFor,
  currencySymbol,
  formatMoney,
  studentsOfTeacher,
  groupsOfTeacher,
  studentMonthAttendance,
  studentAverage,
} from "./analytics";
import { gradeLabel, subjectLabel, formatTime12 } from "./constants";
import type { Lang } from "../i18n/translations";
import { downloadHtmlAsPdf } from "./pdf-arabic";
import { monthKey, now } from "./db";

async function printHtml(title: string, html: string, isAr: boolean) {
  await downloadHtmlAsPdf(title, html, isAr);
}

/* --------------------------- full center report ------------------------- */
export function exportCenterPdf(db: DatabaseShape, _lang: Lang) {
  const sym = currencySymbol(db);
  const rev = totalRevenue(db);
  const exp = totalExpenses(db);
  const centerInc = totalCenterIncome(db);

  let html = `
    <div class="header-banner" style="background: linear-gradient(135deg, #4f46e5, #3b82f6);">
      <table class="header-banner-table" dir="rtl">
        <tr class="header-banner-row">
          <td class="header-banner-td" style="text-align: right;">
            <div style="font-size: 24px; font-weight: 800;">${db.profile.name || "Center Plus"}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 6px; font-weight: 600;">تقرير المركز الشامل</div>
            <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">Full Center Comprehensive Report</div>
          </td>
          <td class="header-banner-td" style="text-align: left; opacity: 0.85; font-size: 11px; line-height: 1.5;">
            تاريخ الإصدار / Issued:<br/>
            <strong>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}</strong>
          </td>
        </tr>
      </table>
    </div>
  `;

  // Overview
  html += `<h2 style="text-align: right; font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📊 نظرة عامة / Overview</h2>`;
  const overviewRows = [
    ["إجمالي الطلاب / Total Students", String(db.students.length)],
    ["المعلمون / Teachers", String(db.teachers.length)],
    ["المجموعات / Groups", String(db.groups.length)],
    ["القاعات / Classrooms", String(db.classrooms.length)],
    ["الإيرادات الشهرية / Monthly Revenue", formatMoney(rev, sym)],
    ["المصروفات الشهرية / Monthly Expenses", formatMoney(exp, sym)],
    ["صافي الربح / Net Profit", formatMoney(rev - exp, sym)],
    ["دخل المركز (هذا الشهر) / Center Income", formatMoney(centerInc, sym)],
  ];
  html += `
    <table style="width: 100%; margin-bottom: 30px;" dir="rtl">
      <tbody>
        ${overviewRows.map(([k, v]) => {
          const isNet = k.includes("الربح") || k.includes("Profit");
          return `
          <tr>
            <td style="color: #475569; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 500;">${k}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; text-align: left; font-weight: 800; font-size: ${isNet ? '15px' : '13px'}; color: ${isNet ? '#10b981' : '#0f172a'};" class="text-left no-wrap">${v}</td>
          </tr>
        `;}).join("")}
      </tbody>
    </table>
  `;

  // Teachers
  html += `<h2 style="text-align: right; font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">👨‍🏫 المعلمون / Teachers</h2>`;
  html += `
    <table style="width: 100%; margin-bottom: 30px;" dir="rtl">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 12px 14px; text-align: right;" class="text-right">الاسم / Name</th>
          <th style="padding: 12px 14px; text-align: right;" class="text-right">المواد / Subjects</th>
          <th style="padding: 12px 14px; text-align: center;" class="text-center">الطلاب / Students</th>
          <th style="padding: 12px 14px; text-align: left;" class="text-left">الصافي / Net</th>
        </tr>
      </thead>
      <tbody>
        ${db.teachers.map(tc => {
          const stud = db.students.filter((s) => s.teachers.some((t) => t.teacherId === tc.id)).length;
          const net = teacherRevenue(db, tc.id) - teacherCenterShare(db, tc);
          const subjectsBilingual = tc.subjects.map((s) => `${subjectLabel(s, "ar")} (${subjectLabel(s, "en")})`).join(", ");
          return `
            <tr>
              <td style="font-weight: bold; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${tc.name}</td>
              <td style="color: #64748b; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">${subjectsBilingual}</td>
              <td style="text-align: center; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-weight: 700;" class="text-center">${stud}</td>
              <td style="color: #059669; font-weight: 800; padding: 12px 14px; border-bottom: 1px solid #f1f5f9;" class="text-left no-wrap">${formatMoney(net, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  // Students
  html += `<div class="page-break"></div>`;
  html += `<h2 style="text-align: right; font-size: 18px; font-weight: 800; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">🎓 الطلاب / Students</h2>`;
  html += `
    <table style="width: 100%; margin-bottom: 30px;" dir="rtl">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 12px 14px; text-align: right;" class="text-right">الكود / Code</th>
          <th style="padding: 12px 14px; text-align: right;" class="text-right">الاسم / Name</th>
          <th style="padding: 12px 14px; text-align: right;" class="text-right">المرحلة أو الصف / Grade</th>
          <th style="padding: 12px 14px; text-align: left;" class="text-left">الرسوم / Fee</th>
          <th style="padding: 12px 14px; text-align: left;" class="text-left">الرصيد / Balance</th>
        </tr>
      </thead>
      <tbody>
        ${db.students.map(s => {
          const gradeBilingual = `${gradeLabel(s.grade, "ar")} · ${gradeLabel(s.grade, "en")}`;
          const isLate = balanceDue(db, s) > 0;
          return `
            <tr>
              <td style="font-family: monospace; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-weight: bold;" class="no-wrap">${s.id}</td>
              <td style="font-weight: bold; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${s.name}</td>
              <td style="color: #64748b; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">${gradeBilingual}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-weight: 600;" class="text-left no-wrap">${formatMoney(studentNetFee(s), sym)}</td>
              <td style="color: ${isLate ? '#dc2626' : '#64748b'}; font-weight: 800; padding: 12px 14px; border-bottom: 1px solid #f1f5f9;" class="text-left no-wrap">${formatMoney(balanceDue(db, s), sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  // Recent Payments
  html += `<div class="page-break"></div>`;
  html += `<h2 style="text-align: right; font-size: 18px; font-weight: 800; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">💳 أحدث المدفوعات / Recent Payments</h2>`;
  const payments = [...db.payments].sort((a, b) => b.date - a.date).slice(0, 30);
  const paymentTypeLabels: Record<string, string> = {
    REGISTRATION: "تسجيل / Registration",
    MONTHLY_FEE: "اشتراك شهري / Monthly Fee",
    EXAM_FEE: "رسوم امتحان / Exam Fee",
    BOOK_FEE: "ثمن كتب / Books Fee",
    OTHER: "أخرى / Other",
  };
  html += `
    <table style="width: 100%;" dir="rtl">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 12px 14px; text-align: right;" class="text-right">التاريخ / Date</th>
          <th style="padding: 12px 14px; text-align: right;" class="text-right">الطالب / Student</th>
          <th style="padding: 12px 14px; text-align: right;" class="text-right">النوع / Type</th>
          <th style="padding: 12px 14px; text-align: center;" class="text-center">الشهر / Month</th>
          <th style="padding: 12px 14px; text-align: left;" class="text-left">المبلغ / Amount</th>
        </tr>
      </thead>
      <tbody>
        ${payments.map(p => {
          const st = db.students.find((s) => s.id === p.studentId);
          const typeLabel = paymentTypeLabels[p.type] || p.type.replace(/_/g, " ");
          return `
            <tr>
              <td style="padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #64748b;" class="no-wrap">${new Date(p.date).toLocaleDateString("en-GB")}</td>
              <td style="font-weight: bold; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${st?.name ?? "—"}</td>
              <td style="color: #475569; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">${typeLabel}</td>
              <td style="text-align: center; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-weight: 600;" class="text-center">${p.month || "—"}</td>
              <td style="color: #059669; font-weight: 800; padding: 12px 14px; border-bottom: 1px solid #f1f5f9;" class="text-left no-wrap">+${formatMoney(p.amount, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  html += `<div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">Center Plus Desktop · /centers/${db.profile.centerId}</div>`;

  printHtml(`Full_Report_${db.profile.name}`, html, true);
}

/* --------------------------------- Excel -------------------------------- */
/** Builds a CSV (Excel-compatible) string and triggers a download. */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  // BOM so Excel reads UTF-8 (Arabic) correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCenterExcel(db: DatabaseShape, lang: Lang) {
  const wb = XLSX.utils.book_new();

  // Overview Sheet
  const overviewRows = [
    ["Center Plus — Full Export"],
    ["Center", db.profile.name, "Currency", db.profile.currency, "Generated", new Date().toLocaleDateString()]
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  XLSX.utils.book_append_sheet(wb, wsOverview, "Overview");

  // Students Sheet
  const studentsRows: any[][] = [
    ["Code", "Name", "Grade", "Groups", "Teachers", "Net Fee", "Paid", "Balance", "Exempt"],
  ];
  for (const s of db.students) {
    studentsRows.push([
      s.id, s.name, gradeLabel(s.grade, lang),
      db.groups.filter((g) => s.groupIds.includes(g.id)).map((g) => g.name).join(" | "),
      s.teachers.map((t) => db.teachers.find((x) => x.id === t.teacherId)?.name ?? "—").join(" | "),
      studentNetFee(s), totalPaidFor(db, s.id), balanceDue(db, s), s.isExempt ? "Yes" : "No",
    ]);
  }
  const wsStudents = XLSX.utils.aoa_to_sheet(studentsRows);
  XLSX.utils.book_append_sheet(wb, wsStudents, "Students");

  // Teachers Sheet
  const teachersRows: any[][] = [
    ["Name", "Subjects", "Pay Type", "Rate/Fixed", "Revenue", "Center Share", "Net"]
  ];
  for (const tc of db.teachers) {
    const rev = teacherRevenue(db, tc.id);
    const share = teacherCenterShare(db, tc);
    teachersRows.push([
      tc.name, tc.subjects.map((s) => subjectLabel(s, lang)).join(" | "),
      tc.payType === "percentage" ? `% ${tc.commissionRate}` : `Fixed ${tc.fixedAmount}`,
      rev, share, rev - share,
    ]);
  }
  const wsTeachers = XLSX.utils.aoa_to_sheet(teachersRows);
  XLSX.utils.book_append_sheet(wb, wsTeachers, "Teachers");

  // Payments Sheet
  const paymentsRows: any[][] = [
    ["Date", "Student", "Code", "Type", "Month", "Amount", "Teacher/Center"]
  ];
  for (const p of [...db.payments].sort((a, b) => b.date - a.date)) {
    const st = db.students.find((s) => s.id === p.studentId);
    paymentsRows.push([
      new Date(p.date).toLocaleDateString(), st?.name ?? "—", p.studentId, p.type, p.month,
      p.amount, p.forCenter || !p.teacherId ? "Center" : db.teachers.find((t) => t.id === p.teacherId)?.name ?? "—",
    ]);
  }
  const wsPayments = XLSX.utils.aoa_to_sheet(paymentsRows);
  XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");

  // Expenses Sheet
  const expensesRows: any[][] = [
    ["Date", "Title", "Category", "Amount"]
  ];
  for (const e of [...db.expenses].sort((a, b) => b.date - a.date)) {
    expensesRows.push([new Date(e.date).toLocaleDateString(), e.title, e.category, e.amount]);
  }
  const wsExpenses = XLSX.utils.aoa_to_sheet(expensesRows);
  XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

  XLSX.writeFile(wb, `center-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportStudentsExcel(db: DatabaseShape, lang: Lang) {
  const rows: any[][] = [
    ["Code", "Name", "Grade", "Parent", "Parent Phone", "Net Fee", "Paid", "Balance", "Exempt", "Registered"],
  ];
  for (const s of db.students) {
    rows.push([
      s.id, s.name, gradeLabel(s.grade, lang), s.parentName ?? "", s.parentPhone ?? "",
      studentNetFee(s), totalPaidFor(db, s.id), balanceDue(db, s), s.isExempt ? "Yes" : "No",
      new Date(s.registrationDate).toLocaleDateString(),
    ]);
  }
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Format parent phone column to text
  const range = XLSX.utils.decode_range(ws['!ref'] || "A1:J1");
  for(let R = range.s.r; R <= range.e.r; ++R) {
    const cellRef = XLSX.utils.encode_cell({c: 4, r: R});
    if(!ws[cellRef]) continue;
    ws[cellRef].z = '@'; // Set type to text
  }

  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "Students.xlsx");
}

export function exportFinanceExcel(db: DatabaseShape) {
  const rows: (string | number)[][] = [
    ["INCOME — Payments"],
    ["Date", "Student", "Type", "Month", "Amount"],
  ];
  for (const p of [...db.payments].sort((a, b) => a.date - b.date)) {
    const st = db.students.find((s) => s.id === p.studentId);
    rows.push([new Date(p.date).toLocaleDateString(), st?.name ?? "—", p.type, p.month, p.amount]);
  }
  rows.push([], ["EXPENSES"], ["Date", "Title", "Category", "Amount"]);
  for (const e of [...db.expenses].sort((a, b) => a.date - b.date)) {
    rows.push([new Date(e.date).toLocaleDateString(), e.title, e.category, e.amount]);
  }
  const income = db.payments.reduce((s, p) => s + p.amount, 0);
  const outcome = db.expenses.reduce((s, e) => s + e.amount, 0);
  rows.push([], ["Total Income", income], ["Total Expenses", outcome], ["Net", income - outcome]);
  downloadCsv("finance", rows);
}

export function exportFinancePdf(db: DatabaseShape, lang: Lang) {
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const income = db.payments.reduce((s, p) => s + p.amount, 0);
  const outcome = db.expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - outcome;

  let html = `
    <div class="header-banner" style="background: linear-gradient(135deg, #059669, #047857);">
      <table class="header-banner-table" dir="rtl">
        <tr class="header-banner-row">
          <td class="header-banner-td" style="text-align: right;">
            <div style="font-size: 24px; font-weight: 800;">${db.profile.name || "Center Plus"}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 6px; font-weight: 600;">${isAr ? "التقرير المالي التفصيلي" : "Detailed Financial Report"}</div>
          </td>
          <td class="header-banner-td" style="text-align: left; opacity: 0.85; font-size: 11px; line-height: 1.5;">
            ${isAr ? "تاريخ الإصدار:" : "Generated:"}<br/>
            <strong>${new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US")}</strong>
          </td>
        </tr>
      </table>
    </div>
  `;

  // Financial summary
  html += `<h2 style="text-align: ${isAr ? "right" : "left"}; font-size: 16px; font-weight: 800; color: #059669; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">💵 ${isAr ? "الملخص المالي" : "Financial Summary"}</h2>`;
  const summaryRows = [
    [isAr ? "إجمالي المقبوضات (المدفوعات)" : "Total Receipts (Payments)", formatMoney(income, sym)],
    [isAr ? "إجمالي المصروفات" : "Total Expenses", formatMoney(outcome, sym)],
    [isAr ? "صافي الربح" : "Net Profit", formatMoney(net, sym)],
  ];
  html += `
    <table style="width: 100%; margin-bottom: 30px;">
      <tbody>
        ${summaryRows.map(([k, v], idx) => `
          <tr style="${idx === 2 ? 'font-weight: bold; background: #f0fdf4;' : ''}">
            <td style="color: #475569; padding: 10px 14px; text-align: ${isAr ? "right" : "left"};">${k}</td>
            <td class="${isAr ? "text-left" : "text-right"} no-wrap" style="padding: 10px 14px; font-weight: 800; color: ${idx === 2 ? (net >= 0 ? '#059669' : '#dc2626') : '#0f172a'};">${v}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  // Payments Table
  html += `<h2 style="text-align: ${isAr ? "right" : "left"}; font-size: 16px; font-weight: 800; color: #059669; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📥 ${isAr ? "كشف المقبوضات والمدفوعات" : "Receipts & Payments"}</h2>`;
  html += `
    <table style="width: 100%; margin-bottom: 35px;" dir="${isAr ? "rtl" : "ltr"}">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 12px 14px; text-align: ${isAr ? "right" : "left"};" class="${isAr ? "text-right" : "text-left"}">${isAr ? "التاريخ" : "Date"}</th>
          <th style="padding: 12px 14px; text-align: ${isAr ? "right" : "left"};" class="${isAr ? "text-right" : "text-left"}">${isAr ? "الطالب" : "Student"}</th>
          <th style="padding: 12px 14px; text-align: ${isAr ? "right" : "left"};" class="${isAr ? "text-right" : "text-left"}">${isAr ? "النوع" : "Type"}</th>
          <th style="padding: 12px 14px; text-align: center;" class="text-center">${isAr ? "الشهر" : "Month"}</th>
          <th style="padding: 12px 14px; text-align: ${isAr ? "left" : "right"};" class="${isAr ? "text-left" : "text-right"}">${isAr ? "المبلغ" : "Amount"}</th>
        </tr>
      </thead>
      <tbody>
        ${[...db.payments].sort((a, b) => b.date - a.date).map(p => {
          const st = db.students.find((s) => s.id === p.studentId);
          const typeLabel = isAr ? (
            p.type === "MONTHLY_FEE" ? "اشتراك شهري" :
            p.type === "EXAM_FEE" ? "رسوم امتحان" :
            p.type === "BOOKS" ? "كتب وملازم" :
            p.type === "CENTER_SUBSCRIPTION" ? "اشتراك سنتر" : "أخرى"
          ) : p.type.replace(/_/g, " ");
          return `
            <tr>
              <td style="padding: 12px 14px; color: #64748b;" class="no-wrap">${new Date(p.date).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</td>
              <td style="font-weight: bold; padding: 12px 14px; color: #0f172a;">${st?.name ?? "—"}</td>
              <td style="color: #475569; padding: 12px 14px; font-size: 12px;">${typeLabel}</td>
              <td class="text-center" style="padding: 12px 14px; font-weight: 600;">${p.month || "—"}</td>
              <td class="${isAr ? "text-left" : "text-right"} no-wrap" style="color: #059669; font-weight: 800; padding: 12px 14px;">+${formatMoney(p.amount, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  // Expenses Table
  html += `<div class="page-break"></div>`;
  html += `<h2 style="text-align: ${isAr ? "right" : "left"}; font-size: 16px; font-weight: 800; color: #dc2626; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📤 ${isAr ? "كشف المصروفات" : "Expenses"}</h2>`;
  html += `
    <table style="width: 100%;" dir="${isAr ? "rtl" : "ltr"}">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 12px 14px; text-align: ${isAr ? "right" : "left"};" class="${isAr ? "text-right" : "text-left"}">${isAr ? "التاريخ" : "Date"}</th>
          <th style="padding: 12px 14px; text-align: ${isAr ? "right" : "left"};" class="${isAr ? "text-right" : "text-left"}">${isAr ? "البند" : "Title"}</th>
          <th style="padding: 12px 14px; text-align: ${isAr ? "right" : "left"};" class="${isAr ? "text-right" : "text-left"}">${isAr ? "الفئة" : "Category"}</th>
          <th style="padding: 12px 14px; text-align: ${isAr ? "left" : "right"};" class="${isAr ? "text-left" : "text-right"}">${isAr ? "المبلغ" : "Amount"}</th>
        </tr>
      </thead>
      <tbody>
        ${[...db.expenses].sort((a, b) => b.date - a.date).map(e => {
          const catLabel = isAr ? (
            e.category === "Rent" ? "إيجار" :
            e.category === "Salaries" ? "مرتبات" :
            e.category === "Electricity" ? "كهرباء" :
            e.category === "Internet" ? "إنترنت" :
            e.category === "Tools" ? "أدوات ومستلزمات" :
            e.category === "Teachers" ? "مستحقات معلمين" : "أخرى"
          ) : e.category;
          return `
            <tr>
              <td style="padding: 12px 14px; color: #64748b;" class="no-wrap">${new Date(e.date).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</td>
              <td style="font-weight: bold; padding: 12px 14px; color: #0f172a;">${e.title}</td>
              <td style="color: #475569; padding: 12px 14px; font-size: 12px;">${catLabel}</td>
              <td class="${isAr ? "text-left" : "text-right"} no-wrap" style="color: #dc2626; font-weight: 800; padding: 12px 14px;">-${formatMoney(e.amount, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  html += `<div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">Center Plus Desktop · /centers/${db.profile.centerId}</div>`;

  printHtml(`Finance_Report_${db.profile.name}`, html, isAr);
}

/* =========================================================================
   ADDITIONAL EXPORTS (TEACHER & STUDENT PDF/EXCEL WITH PERIOD FILTER)
   ========================================================================= */

export async function exportTeacherPdf(db: DatabaseShape, teacher: Teacher, lang: Lang): Promise<void> {
  const isAr = lang === "ar";
  const sym = currencySymbol(db);
  const rev = teacherRevenue(db, teacher.id);
  const share = teacherCenterShare(db, teacher);
  const net = rev - share;
  const students = studentsOfTeacher(db, teacher.id);
  const groups = groupsOfTeacher(db, teacher.id);

  const titleAr = `تقرير المعلم التفصيلي - ${teacher.name}`;
  const titleEn = `Teacher Detailed Report - ${teacher.name}`;
  const title = isAr ? titleAr : titleEn;

  let html = `
    <div class="header-banner" style="background: linear-gradient(135deg, #7c3aed, #4f46e5);">
      <table class="header-banner-table" dir="rtl">
        <tr class="header-banner-row">
          <td class="header-banner-td" style="text-align: right;">
            <div style="font-size: 22px; font-weight: 800; color: white;">${teacher.name}</div>
            <div style="font-size: 13px; opacity: 0.9; margin-top: 6px; font-weight: 600;">
              ${teacher.subjects.map(s => subjectLabel(s, lang)).join(" · ")}
            </div>
            <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
              ${isAr ? "تقرير الأداء والمستحقات والجدول" : "Performance, Financials & Schedule Report"}
            </div>
          </td>
          <td class="header-banner-td" style="text-align: left; opacity: 0.85; font-size: 11px; line-height: 1.5; color: white;">
            تاريخ الإصدار / Issued:<br/>
            <strong>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}</strong>
          </td>
        </tr>
      </table>
    </div>

    <!-- Stats summary -->
    <h3 style="text-align: ${isAr ? "right" : "left"}; font-size: 15px; font-weight: 800; color: #7c3aed; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 20px;">
      📊 ${isAr ? "ملخص المعلم المالي والإحصائي" : "Teacher Overview & Financials"}
    </h3>
    <table style="width: 100%; margin-bottom: 25px;" dir="rtl">
      <tbody>
        <tr>
          <td style="color: #475569; padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">${isAr ? "عدد الطلاب المقيدين" : "Registered Students"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; font-weight: 800;">${students.length}</td>
        </tr>
        <tr>
          <td style="color: #475569; padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">${isAr ? "إجمالي الإيرادات" : "Total Revenue"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; font-weight: 800; color: #059669;">${formatMoney(rev, sym)}</td>
        </tr>
        <tr>
          <td style="color: #475569; padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">${isAr ? "حصة المركز" : "Center Share"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; font-weight: 800; color: #dc2626;">${formatMoney(share, sym)}</td>
        </tr>
        <tr style="background: #f5f3ff;">
          <td style="color: #4c1d95; padding: 10px; border-bottom: 1px solid #ddd6fe; text-align: right; font-weight: bold;">${isAr ? "صافي مستحقات المعلم" : "Teacher Net Share"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd6fe; text-align: left; font-weight: 800; color: #7c3aed; font-size: 15px;">${formatMoney(net, sym)}</td>
        </tr>
        <tr>
          <td style="color: #475569; padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">${isAr ? "طريقة الحساب" : "Payment Contract"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left; font-weight: bold;">
            ${teacher.payType === "percentage" ? `%${teacher.commissionRate}` : `${formatMoney(teacher.fixedAmount, sym)} (${isAr ? "مبلغ ثابت" : "fixed"})`}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Students List -->
    <h3 style="text-align: ${isAr ? "right" : "left"}; font-size: 15px; font-weight: 800; color: #7c3aed; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; page-break-before: auto;">
      👥 ${isAr ? "كشف طلاب المعلم" : "Students List"}
    </h3>
    <table style="width: 100%; margin-bottom: 25px; font-size: 12px;" dir="${isAr ? "rtl" : "ltr"}">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 10px; text-align: ${isAr ? "right" : "left"};">${isAr ? "الكود" : "Code"}</th>
          <th style="padding: 10px; text-align: ${isAr ? "right" : "left"};">${isAr ? "الاسم" : "Name"}</th>
          <th style="padding: 10px; text-align: ${isAr ? "right" : "left"};">${isAr ? "الصف الدراسي" : "Grade"}</th>
          <th style="padding: 10px; text-align: ${isAr ? "left" : "right"};" class="${isAr ? "text-left" : "text-right"}">${isAr ? "الرسوم" : "Fee"}</th>
        </tr>
      </thead>
      <tbody>
        ${students.length === 0 ? `
          <tr>
            <td colspan="4" style="padding: 20px; text-align: center; color: #64748b;">${isAr ? "لا يوجد طلاب مقيدين لدى المعلم حالياً" : "No students currently registered for this teacher"}</td>
          </tr>
        ` : students.map(s => {
          const fee = s.teachers.find((x) => x.teacherId === teacher.id)?.fee ?? 0;
          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-weight: bold;">${s.id}</td>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${s.name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b;">${gradeLabel(s.grade, lang)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #059669;" class="${isAr ? "text-left" : "text-right"} no-wrap">${formatMoney(fee, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <!-- Weekly Schedule -->
    <div style="page-break-inside: avoid;">
      <h3 style="text-align: ${isAr ? "right" : "left"}; font-size: 15px; font-weight: 800; color: #7c3aed; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px;">
        📅 ${isAr ? "جدول الحصص الأسبوعي" : "Weekly Schedule"}
      </h3>
      ${(() => {
        const DAY_KEY: Record<number, string> = {
          1: isAr ? "الاثنين" : "Monday",
          2: isAr ? "الثلاثاء" : "Tuesday",
          3: isAr ? "الأربعاء" : "Wednesday",
          4: isAr ? "الخميس" : "Thursday",
          5: isAr ? "الجمعة" : "Friday",
          6: isAr ? "السبت" : "Saturday",
          7: isAr ? "الأحد" : "Sunday"
        };
        const sessions = db.scheduleEvents
          .filter((e) => groups.some((g) => g.id === e.groupId))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

        if (sessions.length === 0) {
          return `<div style="color: #94a3b8; text-align: center; padding: 20px; border: 1px dashed #e2e8f0; border-radius: 8px;">${isAr ? "لا توجد مواعيد مضافة لجدول المعلم" : "No schedule events added for this teacher"}</div>`;
        }

        return `
          <table style="width: 100%; font-size: 12px;" dir="${isAr ? "rtl" : "ltr"}">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 10px; text-align: ${isAr ? "right" : "left"};">${isAr ? "اليوم" : "Day"}</th>
                <th style="padding: 10px; text-align: ${isAr ? "right" : "left"};">${isAr ? "المجموعة" : "Group"}</th>
                <th style="padding: 10px; text-align: ${isAr ? "right" : "left"};">${isAr ? "الوقت" : "Time"}</th>
                <th style="padding: 10px; text-align: ${isAr ? "left" : "right"};" class="${isAr ? "text-left" : "text-right"}">${isAr ? "القاعة" : "Classroom"}</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(e => {
                const g = db.groups.find((x) => x.id === e.groupId);
                const room = db.classrooms.find((c) => c.id === e.classroomId);
                const timeStr = `${formatTime12(e.startTime, lang)}`;
                return `
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #4f46e5;">${DAY_KEY[e.dayOfWeek] || e.dayOfWeek}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${g?.name ?? "—"}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #475569;">${timeStr}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #4f46e5;" class="${isAr ? "text-left" : "text-right"}">${room?.name ?? "—"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        `;
      })()}
    </div>

    <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
      Center Plus Desktop · /centers/${db.profile.centerId} · ${teacher.name}
    </div>
  `;

  await downloadHtmlAsPdf(title, html, isAr);
}

export function exportTeacherExcel(db: DatabaseShape, teacher: Teacher, lang: Lang) {
  const sym = currencySymbol(db);
  const rev = teacherRevenue(db, teacher.id);
  const share = teacherCenterShare(db, teacher);
  const net = rev - share;
  const students = studentsOfTeacher(db, teacher.id);
  const groups = groupsOfTeacher(db, teacher.id);
  
  const wb = XLSX.utils.book_new();

  // Overview Sheet
  const overviewRows = [
    [lang === "ar" ? "تقرير المعلم الشامل" : "Teacher Comprehensive Report"],
    [],
    [lang === "ar" ? "اسم المعلم" : "Teacher Name", teacher.name],
    [lang === "ar" ? "المواد" : "Subjects", teacher.subjects.map(s => subjectLabel(s, lang)).join(" | ")],
    [lang === "ar" ? "عقد المحاسبة" : "Billing Model", teacher.payType === "percentage" ? `${teacher.commissionRate}%` : `${teacher.fixedAmount} ${sym}`],
    [],
    [lang === "ar" ? "إجمالي إيرادات الحصص" : "Total Revenue", rev],
    [lang === "ar" ? "حصة المركز" : "Center Share", share],
    [lang === "ar" ? "صافي مستحقات المعلم" : "Teacher Net Share", net],
    [],
    [lang === "ar" ? "عدد الطلاب المقيدين" : "Total Students", students.length],
    [lang === "ar" ? "تاريخ الإصدار" : "Generated Date", new Date().toLocaleDateString()]
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  XLSX.utils.book_append_sheet(wb, wsOverview, lang === "ar" ? "ملخص المعلم" : "Overview");

  // Students Sheet
  const studentsRows: any[][] = [
    [
      lang === "ar" ? "كود الطالب" : "Student ID",
      lang === "ar" ? "اسم الطالب" : "Student Name",
      lang === "ar" ? "المرحلة/الصف الدراسي" : "Grade",
      lang === "ar" ? "الرسوم الخاصة بالمعلم" : "Fee"
    ]
  ];
  for (const s of students) {
    const fee = s.teachers.find((x) => x.teacherId === teacher.id)?.fee ?? 0;
    studentsRows.push([
      s.id, s.name, gradeLabel(s.grade, lang), fee
    ]);
  }
  const wsStudents = XLSX.utils.aoa_to_sheet(studentsRows);
  XLSX.utils.book_append_sheet(wb, wsStudents, lang === "ar" ? "الطلاب" : "Students");

  // Schedule Sheet
  const DAY_KEY: Record<number, string> = {
    1: lang === "ar" ? "الاثنين" : "Monday",
    2: lang === "ar" ? "الثلاثاء" : "Tuesday",
    3: lang === "ar" ? "الأربعاء" : "Wednesday",
    4: lang === "ar" ? "الخميس" : "Thursday",
    5: lang === "ar" ? "الجمعة" : "Friday",
    6: lang === "ar" ? "السبت" : "Saturday",
    7: lang === "ar" ? "الأحد" : "Sunday"
  };
  const sessions = db.scheduleEvents
    .filter((e) => groups.some((g) => g.id === e.groupId))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  const scheduleRows: any[][] = [
    [
      lang === "ar" ? "اليوم" : "Day",
      lang === "ar" ? "المجموعة" : "Group Name",
      lang === "ar" ? "التوقيت" : "Start Time",
      lang === "ar" ? "القاعة" : "Classroom/Room"
    ]
  ];
  for (const e of sessions) {
    const g = db.groups.find((x) => x.id === e.groupId);
    const room = db.classrooms.find((c) => c.id === e.classroomId);
    scheduleRows.push([
      DAY_KEY[e.dayOfWeek] || e.dayOfWeek,
      g?.name ?? "—",
      formatTime12(e.startTime, lang),
      room?.name ?? "—"
    ]);
  }
  const wsSchedule = XLSX.utils.aoa_to_sheet(scheduleRows);
  XLSX.utils.book_append_sheet(wb, wsSchedule, lang === "ar" ? "الجدول الأسبوعي" : "Schedule");

  XLSX.writeFile(wb, `${teacher.name.replace(/\s+/g, "_")}_Excel_Report.xlsx`);
}

export function exportStudentExcel(db: DatabaseShape, student: Student, lang: Lang) {
  const studentAtt = studentMonthAttendance(db, student.id, monthKey(now()));
  const attRate = Math.round(studentAtt.rate);
  const avg = studentAverage(db, student.id);
  const paid = totalPaidFor(db, student.id);
  const due = balanceDue(db, student);
  const group = db.groups.find((g) => student.groupIds?.includes(g.id));

  const wb = XLSX.utils.book_new();

  // Profile/Overview Sheet
  const profileRows = [
    [lang === "ar" ? "تقرير كشف حساب وبيانات الطالب" : "Student Comprehensive Account Report"],
    [],
    [lang === "ar" ? "اسم الطالب" : "Student Name", student.name],
    [lang === "ar" ? "كود الطالب" : "Student Code/ID", student.id],
    [lang === "ar" ? "المرحلة / الصف الدراسي" : "Grade", gradeLabel(student.grade, lang)],
    [lang === "ar" ? "المجموعة" : "Group Name", group?.name ?? "—"],
    [lang === "ar" ? "اسم ولي الأمر" : "Parent Name", student.parentName || "—"],
    [lang === "ar" ? "رقم ولي الأمر" : "Parent Phone", student.parentPhone || "—"],
    [],
    [lang === "ar" ? "إحصائيات ومستحقات:" : "Statistics & Balance:"],
    [lang === "ar" ? "نسبة حضور الشهر الحالي" : "Current Month Attendance Rate", `${attRate}%`],
    [lang === "ar" ? "متوسط الدرجات في الامتحانات" : "Exams Average Grade", avg != null ? `${Math.round(avg)}%` : "—"],
    [lang === "ar" ? "إجمالي المبالغ المدفوعة" : "Total Amount Paid", paid],
    [lang === "ar" ? "الرصيد أو المديونيات المستحقة" : "Outstanding Balance Due", due],
    [],
    [lang === "ar" ? "تاريخ توليد الملف" : "Generated At", new Date().toLocaleDateString()]
  ];
  const wsProfile = XLSX.utils.aoa_to_sheet(profileRows);
  
  // Format phone number column as text
  if (wsProfile["B8"]) wsProfile["B8"].z = "@";

  XLSX.utils.book_append_sheet(wb, wsProfile, lang === "ar" ? "الملخص والبيانات" : "Student Profile");

  // Payments Sheet
  const paymentsRows: any[][] = [
    [
      lang === "ar" ? "التاريخ" : "Date",
      lang === "ar" ? "نوع المعاملة" : "Payment Type",
      lang === "ar" ? "الشهر" : "Month",
      lang === "ar" ? "المبلغ المدفوع" : "Amount Paid"
    ]
  ];
  const paymentTypeLabels: Record<string, string> = {
    REGISTRATION: lang === "ar" ? "تسجيل" : "Registration",
    MONTHLY_FEE: lang === "ar" ? "اشتراك شهري" : "Monthly Fee",
    EXAM_FEE: lang === "ar" ? "رسوم امتحان" : "Exam Fee",
    BOOK_FEE: lang === "ar" ? "ثمن كتب" : "Books Fee",
    OTHER: lang === "ar" ? "أخرى" : "Other",
  };
  const payments = db.payments
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => b.date - a.date);

  for (const p of payments) {
    paymentsRows.push([
      new Date(p.date).toLocaleDateString(),
      paymentTypeLabels[p.type] || p.type,
      p.month || "—",
      p.amount
    ]);
  }
  const wsPayments = XLSX.utils.aoa_to_sheet(paymentsRows);
  XLSX.utils.book_append_sheet(wb, wsPayments, lang === "ar" ? "المدفوعات والاشتراكات" : "Payments");

  // Exams & Scores Sheet
  const examsRows: any[][] = [
    [
      lang === "ar" ? "التاريخ" : "Date",
      lang === "ar" ? "اسم الامتحان" : "Exam Title",
      lang === "ar" ? "الدرجة المحصلة" : "Obtained Grade",
      lang === "ar" ? "الدرجة النهائية" : "Max Score",
      lang === "ar" ? "النسبة المئوية" : "Percentage"
    ]
  ];
  const grades = db.examGrades
    .filter((g) => g.studentId === student.id)
    .map((g) => ({ g, exam: db.exams.find((e) => e.id === g.examId) }))
    .filter((x) => x.exam);

  for (const x of grades) {
    if (!x.exam) continue;
    const pct = x.exam.maxGrade > 0 ? Math.round((x.g.obtainedGrade / x.exam.maxGrade) * 100) : 0;
    examsRows.push([
      new Date(x.exam.date).toLocaleDateString(),
      x.exam.name,
      x.g.obtainedGrade,
      x.exam.maxGrade,
      `${pct}%`
    ]);
  }
  const wsExams = XLSX.utils.aoa_to_sheet(examsRows);
  XLSX.utils.book_append_sheet(wb, wsExams, lang === "ar" ? "الامتحانات والدرجات" : "Exams & Grades");

  // Attendance Sheet
  const attendanceRows: any[][] = [
    [
      lang === "ar" ? "التاريخ" : "Date",
      lang === "ar" ? "المجموعة" : "Group Name",
      lang === "ar" ? "الحالة" : "Status",
      lang === "ar" ? "ملاحظات" : "Notes"
    ]
  ];
  const attendance = db.attendance
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => b.date - a.date);

  const statusLabels: Record<string, string> = {
    PRESENT: lang === "ar" ? "حاضر" : "Present",
    ABSENT: lang === "ar" ? "غائب" : "Absent",
    EXCUSED: lang === "ar" ? "عذر غياب" : "Excused",
    LATE: lang === "ar" ? "متأخر" : "Late",
  };

  for (const r of attendance) {
    const g = db.groups.find((x) => x.id === r.groupId);
    attendanceRows.push([
      new Date(r.date).toLocaleDateString(),
      g?.name ?? "—",
      statusLabels[r.status] || r.status,
      r.notes || "—"
    ]);
  }
  const wsAttendance = XLSX.utils.aoa_to_sheet(attendanceRows);
  XLSX.utils.book_append_sheet(wb, wsAttendance, lang === "ar" ? "سجل الحضور والغياب" : "Attendance");

  XLSX.writeFile(wb, `${student.name.replace(/\s+/g, "_")}_Excel_Report.xlsx`);
}

