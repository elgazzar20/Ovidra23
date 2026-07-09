/**
 * Excel Import Utility
 * =====================
 * Parses Excel/CSV files containing student or teacher data
 * and converts them into our internal types.
 */

import * as XLSX from "xlsx";
import type { Student, Teacher } from "./types";
import { nextStudentCode, now, startOfDay } from "./db";

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  count: number;
}

/**
 * Parses an Excel file into Student objects.
 * Expected columns (flexible header names):
 *   - name / الاسم / اسم الطالب
 *   - grade / الصف / السنة الدراسية
 *   - phone / الهاتف / رقم الطالب
 *   - parentName / ولي الأمر / اسم ولي الأمر
 *   - parentPhone / هاتف ولي الأمر / رقم ولي الأمر
 *   - fee / الرسوم / المصاريف
 */
export async function parseStudentsExcel(
  file: File,
  existingStudents: Student[],
): Promise<ImportResult<Student>> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

    const errors: string[] = [];
    const students: Student[] = [];
    let counter = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row.name || row["الاسم"] || row["اسم الطالب"] || row["Name"] || "").trim();
      if (!name) {
        errors.push(`الصف ${i + 2}: لا يوجد اسم — تم التخطي`);
        continue;
      }

      const grade = String(row.grade || row["الصف"] || row["السنة الدراسية"] || row["Grade"] || "").trim();
      const phone = String(row.phone || row["الهاتف"] || row["رقم الطالب"] || row["Phone"] || "").trim();
      const parentName = String(row.parentName || row["ولي الأمر"] || row["اسم ولي الأمر"] || row["Parent"] || "").trim();
      const parentPhone = String(row.parentPhone || row["هاتف ولي الأمر"] || row["رقم ولي الأمر"] || "").trim();
      const feeNum = Number(row.fee || row["الرسوم"] || row["المصاريف"] || row["Fee"] || 0);
      void feeNum;

      const code = nextStudentCode([...existingStudents, ...students]);
      const ts = now();

      students.push({
        id: code,
        name,
        grade,
        groupIds: [],
        teachers: [],
        studentPhone: phone || undefined,
        parentName: parentName || undefined,
        parentPhone: parentPhone || undefined,
        discount: 0,
        isExempt: false,
        qrCode: `CPD:${code}`,
        registrationDate: startOfDay(now()),
        lastUpdated: ts,
      });
      counter++;
    }

    return { success: true, data: students, errors, count: counter };
  } catch (err) {
    return { success: false, data: [], errors: ["فشل قراءة الملف: تأكد من أنه ملف Excel صالح"], count: 0 };
  }
}

/**
 * Parses an Excel file into Teacher objects.
 * Expected columns:
 *   - name / الاسم / اسم المعلم
 *   - subject / المادة / التخصص
 *   - phone / الهاتف
 *   - email / البريد
 */
export async function parseTeachersExcel(
  file: File,
): Promise<ImportResult<Teacher>> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

    const errors: string[] = [];
    const teachers: Teacher[] = [];
    let counter = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row.name || row["الاسم"] || row["اسم المعلم"] || row["Name"] || "").trim();
      if (!name) {
        errors.push(`الصف ${i + 2}: لا يوجد اسم — تم التخطي`);
        continue;
      }

      const subject = String(row.subject || row["المادة"] || row["التخصص"] || row["Subject"] || "").trim();
      const phone = String(row.phone || row["الهاتف"] || row["Phone"] || "").trim();
      const email = String(row.email || row["البريد"] || row["Email"] || "").trim();

      const ts = now();
      teachers.push({
        id: `tch_import_${Date.now()}_${counter}`,
        name,
        subjects: subject ? [subject] : [],
        phone: phone || undefined,
        email: email || undefined,
        payType: "percentage",
        commissionRate: 10,
        fixedAmount: 500,
        lastUpdated: ts,
      });
      counter++;
    }

    return { success: true, data: teachers, errors, count: counter };
  } catch (err) {
    return { success: false, data: [], errors: ["فشل قراءة الملف: تأكد من أنه ملف Excel صالح"], count: 0 };
  }
}

/** Generates an Excel template file for students. */
export function downloadStudentsTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    { name: "محمد أحمد", grade: "الثالث الابتدائي", phone: "01012345678", parentName: "أحمد علي", parentPhone: "01123456789", fee: 300 },
    { name: "فاطمة علي", grade: "الأول الإعدادي", phone: "01098765432", parentName: "علي حسن", parentPhone: "01234567890", fee: 350 },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "students_template.xlsx");
}

/** Generates an Excel template file for teachers. */
export function downloadTeachersTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    { name: "أحمد محمد", subject: "الرياضيات", phone: "01012345678", email: "teacher@example.com" },
    { name: "سارة علي", subject: "اللغة الإنجليزية", phone: "01098765432", email: "sara@example.com" },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Teachers");
  XLSX.writeFile(wb, "teachers_template.xlsx");
}
