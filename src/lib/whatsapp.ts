import type { DatabaseShape, Student, Assignment } from "./types";
import { GRADES, gradeLabel } from "./constants";
import {
  studentMonthAttendance,
  studentAverage,
  balanceDue,
  studentNetFee,
  currencySymbol,
  formatMoney,
} from "./analytics";
import { monthKey, now } from "./db";

/**
 * Generates a shareable WhatsApp message for a homework assignment.
 * Does not include a phone number, so the user can choose who to send it to (e.g., a WhatsApp Group).
 */
export function getWhatsAppHomeworkShareUrl(db: DatabaseShape, assignment: Assignment): { url: string; text: string } {
  const group = db.groups.find(g => g.id === assignment.groupId);
  const subjectLabel = group?.subject ?? "";
  const groupName = group?.name ?? "";
  
  let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
  msg += `السادة أولياء الأمور الكرام،\n\n`;
  msg += `نود إعلامكم بوجود واجب منزلي جديد لمادة *${subjectLabel}* (مجموعة ${groupName}):\n\n`;
  msg += `📝 *موضوع الواجب:* ${assignment.title}\n`;
  if (assignment.description) {
    msg += `📖 *التفاصيل:* ${assignment.description}\n`;
  }
  msg += `⏰ *موعد التسليم:* ${new Date(assignment.dueDate).toLocaleDateString("ar-EG")}\n\n`;
  msg += `برجاء متابعة أبنائكم والتأكد من إتمام الواجب في الموعد المحدد.\n`;
  msg += `مع تمنياتنا بالتوفيق والتفوق 🌹\n`;
  msg += `إدارة سنتر *${db.profile.name}*`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  return { url, text: msg };
}

/**
 * Generates a highly professional WhatsApp report message in Arabic
 * for a specific student and returns the direct WhatsApp send URL.
 */
export function getWhatsAppReportUrl(db: DatabaseShape, student: Student, customNote?: string): { url: string; text: string; phone: string } {
  const lang = "ar";
  const sym = currencySymbol(db);
  const grade = GRADES.find((g) => g.id === student.grade);
  const gradeText = grade ? gradeLabel(student.grade, lang) : student.grade;
  
  // Calculations
  const attData = studentMonthAttendance(db, student.id, monthKey(now()));
  const attRate = Math.round(attData.rate);
  const avg = studentAverage(db, student.id);
  const due = balanceDue(db, student);
  const netFee = studentNetFee(student);

  // Get student's latest exam grades
  const studentGrades = db.examGrades
    .filter((g) => g.studentId === student.id)
    .map((g) => ({ g, exam: db.exams.find((e) => e.id === g.examId) }))
    .filter((x) => x.exam)
    .sort((a, b) => b.exam!.date - a.exam!.date)
    .slice(0, 3);

  let examsText = "";
  if (studentGrades.length > 0) {
    examsText = studentGrades
      .map(({ g, exam }) => `  ▫️ ${exam!.name}: (${g.obtainedGrade}/${exam!.maxGrade})`)
      .join("\n");
  } else {
    examsText = "  ▫️ لا توجد امتحانات مسجلة مؤخراً.";
  }

  // Get latest teacher note
  const latestNote = db.studentNotes
    .filter((n) => n.studentId === student.id)
    .sort((a, b) => b.date - a.date)[0]?.text;

  // Formulate the professional WhatsApp message
  let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
  msg += `تحية طيبة من سنتر *${db.profile.name}* ومستر محمد الجزار 🌹\n\n`;
  msg += `نرسل لكم التقرير الأكاديمي والمالي التلقائي للطالب/ة:\n`;
  msg += `👤 *الاسم:* ${student.name}\n`;
  msg += `🆔 *الكود:* ${student.id}\n`;
  msg += `📚 *الصف الدراسي:* ${gradeText}\n\n`;

  msg += `📊 *ملخص الأداء لشهر ${monthKey(now())}:*\n`;
  msg += `▫️ نسبة الحضور: *${attRate}%* (حاضر: ${attData.present} · غائب: ${attData.absent} · متأخر: ${attData.late})\n`;
  msg += `▫️ متوسط درجات الامتحانات: *${avg != null ? `${Math.round(avg)}%` : "لا يوجد بعد"}*\n`;
  msg += `📝 *نتائج الاختبارات الأخيرة:*\n${examsText}\n\n`;

  msg += `💵 *الحالة المالية لشهر ${monthKey(now())}:*\n`;
  msg += `▫️ إجمالي الرسوم الشهرية: *${formatMoney(netFee, sym)}*\n`;
  msg += `▫️ المبلغ المتبقي المستحق: *${due > 0 ? `⚠️ ${formatMoney(due, sym)}` : `✅ مسدد بالكامل (${formatMoney(due, sym)})`}*\n\n`;

  if (customNote && customNote.trim()) {
    msg += `✍️ *ملاحظة إضافية:* ${customNote.trim()}\n\n`;
  } else if (latestNote) {
    msg += `✍️ *ملاحظة المعلم الأخيرة:* ${latestNote}\n\n`;
  }

  msg += `__________________\n`;
  msg += `🎯 *مع تمنياتنا للطالب بدوام التفوق والنجاح!*\n`;
  msg += `👨‍🏫 *مطور النظام:* مستر محمد الجزار (مدرس مادة الرياضيات)\n`;

  // Standardize phone number for WhatsApp
  // Replace leading 0 with country code (defaults to +2 for Egypt if it starts with 01)
  let parentPhone = student.parentPhone || student.studentPhone || "";
  let cleanPhone = parentPhone.replace(/\s+/g, "").replace(/[+\-]/g, "");
  
  if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
    cleanPhone = "2" + cleanPhone;
  } else if (cleanPhone.startsWith("1") && cleanPhone.length === 10) {
    cleanPhone = "20" + cleanPhone;
  }

  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;

  return {
    url,
    text: msg,
    phone: cleanPhone,
  };
}

/**
 * Generates a shareable WhatsApp message for a single student's exam grade.
 */
export function getWhatsAppExamGradeUrl(db: DatabaseShape, student: Student, examName: string, maxGrade: number, obtainedGrade: number): { url: string; text: string; phone: string } {
  const phone = student.parentPhone || student.studentPhone || "";
  let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
  msg += `السادة أولياء الأمور الكرام،\n\n`;
  msg += `نود إعلامكم بنتيجة اختبار الطالب/ة *${student.name}* (${student.id}) في امتحان: *${examName}*\n\n`;
  msg += `📊 *الدرجة الحاصل عليها الطالب:* *${obtainedGrade}* من *${maxGrade}*\n`;
  const percentage = maxGrade > 0 ? Math.round((obtainedGrade / maxGrade) * 100) : 0;
  msg += `📈 *النسبة المئوية:* *${percentage}%*\n\n`;
  msg += `نرجو منكم دوام الدعم والتحفيز لمزيد من التقدم والنجاح 🌟\n`;
  msg += `مع تحيات إدارة سنتر *${db.profile.name}*`;

  let cleanPhone = phone.replace(/\s+/g, "").replace(/[+\-]/g, "");
  if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
    cleanPhone = "2" + cleanPhone;
  } else if (cleanPhone.startsWith("1") && cleanPhone.length === 10) {
    cleanPhone = "20" + cleanPhone;
  }

  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
  return { url, text: msg, phone: cleanPhone };
}

