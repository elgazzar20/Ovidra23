import type { DatabaseShape, Teacher } from "./types";
import type { Lang } from "../i18n/translations";
import {
  teacherRevenue, teacherCenterShare, studentsOfTeacher, groupsOfTeacher,
  currencySymbol, formatMoney,
} from "./analytics";
import { gradeLabel, formatTime12 } from "./constants";

function printHtml(title: string, html: string) {
  const fontFamily = "'Cairo', 'Inter', sans-serif";

  // 1. Generate and trigger automatic download of offline-viewable report
  const offlineHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        body {
          margin: 0;
          padding: 20px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: ${fontFamily};
          color: #0f172a;
        }
        .header {
          background: #4f46e5;
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
        th { background: #f1f5f9; padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .text-left { text-align: left; }
        @media print {
          body { padding: 0; margin: 0; }
          @page { margin: 10mm; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body style="background-color: #f8fafc; padding: 20px; display: flex; flex-direction: column; align-items: center;">
      <div class="no-print" style="width: 100%; max-width: 900px; background: #e0e7ff; border: 1px solid #c7d2fe; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; font-family: ${fontFamily}; margin-bottom: 20px; border-radius: 12px; box-sizing: border-box;">
        <div style="font-size: 13px; color: #3730a3; line-height: 1.5; text-align: right;">
          <strong>💾 تم تحميل التقرير تلقائياً / Report Downloaded Successfully</strong><br/>
          تم حفظ هذا التقرير بنجاح على جهازك للاستعراض أوفلاين. اضغط على الزر الجانبي لطباعته في أي وقت. / This report has been saved locally for offline access. Click the print button to send it to a printer.
        </div>
        <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px; font-family: ${fontFamily}; transition: background 0.2s;">
          🖨️ طباعة الآن / Print Report
        </button>
      </div>
      <div style="background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); padding: 20px; width: 100%; max-width: 900px; box-sizing: border-box;">
        ${html}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([offlineHtml], { type: "text/html;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `${title.replace(/\s+/g, "_")}_Report_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

  // 2. Open print preview/window for immediate print
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return;
  }
  const doc = printWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        body {
          margin: 0;
          padding: 20px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: ${fontFamily};
          color: #0f172a;
        }
        .header {
          background: #4f46e5;
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
        th { background: #f1f5f9; padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .text-left { text-align: left; }
        @media print {
          body { padding: 0; margin: 0; }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      ${html}
      <script>
        window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
      </script>
    </body>
    </html>
  `);
  doc.close();
}

function renderHeader(db: DatabaseShape, teacher: Teacher, subtitleAr: string, subtitleEn: string) {
  return `
    <div class="header" style="flex-direction: row-reverse;">
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: bold;">${db.profile.name}</div>
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">${subtitleAr} / ${subtitleEn} — ${teacher.name}</div>
      </div>
      <div style="font-size: 12px; text-align: left;">
        تاريخ الإصدار / Issued:<br/>${new Date().toLocaleDateString("ar-EG")} / ${new Date().toLocaleDateString("en-US")}
      </div>
    </div>
  `;
}

export function exportStudents(db: DatabaseShape, teacher: Teacher, _lang: Lang) {
  const sym = currencySymbol(db);
  const students = studentsOfTeacher(db, teacher.id);
  
  let html = renderHeader(db, teacher, "تقرير الطلاب", "Students Report");
  html += `
    <table style="width: 100%;" dir="rtl">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 10px; text-align: right;">الكود / Code</th>
          <th style="padding: 10px; text-align: right;">الاسم / Name</th>
          <th style="padding: 10px; text-align: right;">المرحلة أو الصف / Grade</th>
          <th style="padding: 10px; text-align: left;">الرسوم / Fee</th>
        </tr>
      </thead>
      <tbody>
        ${students.map(s => {
          const fee = s.teachers.find((x) => x.teacherId === teacher.id)?.fee ?? 0;
          const gradeBilingual = `${gradeLabel(s.grade, "ar")} · ${gradeLabel(s.grade, "en")}`;
          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${s.id}</td>
              <td style="font-weight: 600; padding: 10px; border-bottom: 1px solid #e2e8f0;">${s.name}</td>
              <td style="color: #64748b; padding: 10px; border-bottom: 1px solid #e2e8f0;">${gradeBilingual}</td>
              <td style="text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #059669;">${formatMoney(fee, sym)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  
  printHtml(`Students_${teacher.name}`, html);
}

export function exportFinancial(db: DatabaseShape, teacher: Teacher, _lang: Lang) {
  const sym = currencySymbol(db);
  const rev = teacherRevenue(db, teacher.id);
  const share = teacherCenterShare(db, teacher);
  const net = rev - share;
  
  let html = renderHeader(db, teacher, "التقرير المالي", "Financial Report");
  
  const rows = [
    ["إجمالي الإيرادات / Total Revenue", formatMoney(rev, sym)],
    ["نسبة المركز / Center Share", formatMoney(share, sym)],
    ["صافي المعلم / Net to Teacher", formatMoney(net, sym)],
    ["نظام المحاسبة / Pay Model", teacher.payType === "percentage" ? `${teacher.commissionRate}%` : formatMoney(teacher.fixedAmount, sym)],
    ["عدد الطلاب / StudentsCount", String(studentsOfTeacher(db, teacher.id).length)],
  ];
  
  html += `
    <table style="width: 100%;" dir="rtl">
      <tbody>
        ${rows.map(([k, v]) => `
          <tr>
            <td style="color: #64748b; padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${k}</td>
            <td style="font-weight: bold; padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left;">${v}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  
  printHtml(`Finance_${teacher.name}`, html);
}

export function exportSchedule(db: DatabaseShape, teacher: Teacher, _lang: Lang) {
  const groups = groupsOfTeacher(db, teacher.id);
  const DAY_KEY: Record<number, string> = {
    1: "الاثنين / Monday",
    2: "الثلاثاء / Tuesday",
    3: "الأربعاء / Wednesday",
    4: "الخميس / Thursday",
    5: "الجمعة / Friday",
    6: "السبت / Saturday",
    7: "الأحد / Sunday"
  };
    
  const sessions = db.scheduleEvents
    .filter((e) => groups.some((g) => g.id === e.groupId))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
    
  let html = renderHeader(db, teacher, "جدول الحصص الأسبوعي", "Weekly Schedule");
  html += `
    <table style="width: 100%;" dir="rtl">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 10px; text-align: right;">اليوم / Day</th>
          <th style="padding: 10px; text-align: right;">المجموعة / Group</th>
          <th style="padding: 10px; text-align: right;">الوقت / Time</th>
          <th style="padding: 10px; text-align: left;">القاعة / Room</th>
        </tr>
      </thead>
      <tbody>
        ${sessions.map(e => {
          const g = db.groups.find((x) => x.id === e.groupId);
          const room = db.classrooms.find((c) => c.id === e.classroomId);
          const timeBilingual = `${formatTime12(e.startTime, "ar")} / ${formatTime12(e.startTime, "en")}`;
          return `
            <tr>
              <td style="color: #4f46e5; font-weight: 600; padding: 10px; border-bottom: 1px solid #e2e8f0;">${DAY_KEY[e.dayOfWeek]}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${g?.name ?? "—"}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${timeBilingual}</td>
              <td style="text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #4f46e5;">${room?.name ?? "—"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  
  printHtml(`Schedule_${teacher.name}`, html);
}
