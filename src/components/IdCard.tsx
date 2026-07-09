import { memo, useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { QRCodeImage } from "./QRCode";
import { Barcode } from "./Barcode";
import { GraduationCap, ShieldCheck, Info, Phone, Globe } from "lucide-react";
import type { CardTheme, DatabaseShape, Student } from "../lib/types";
import { GRADES, gradeLabel, subjectLabel } from "../lib/constants";
import {
  studentNetFee, currencySymbol, formatMoney, studentPaymentStatus, shiftMonth,
} from "../lib/analytics";
import { monthKey, now } from "../lib/db";
import { fontOf, fmtCardDate } from "../lib/cardTheme";
import type { CardData } from "../lib/cardExport";

export type CardStatus = "active" | "paused" | "expired";

export function studentCardInfo(db: DatabaseShape, student: Student): CardData & { netFee: number } {
  const sym = currencySymbol(db);
  const st = studentPaymentStatus(db, student);
  let status: CardStatus;
  if (student.isExempt || st.status === "paid") status = "active";
  else if (st.status === "overdue" && st.monthsLate >= 2) status = "expired";
  else status = "paused";
  const rows = (student.teachers ?? []).map((tr) => db.teachers.find((t) => t.id === tr.teacherId)).filter(Boolean) as typeof db.teachers;
  const teachers = rows.map((t) => t.name);
  const subjects = Array.from(new Set(rows.flatMap((t) => t.subjects ?? []).map((s) => subjectLabel(s, "ar"))));
  const groups = (student.groupIds ?? []).map((id) => db.groups.find((g) => g.id === id)?.name).filter(Boolean) as string[];
  const sectionLabel = groups.length === 0 ? "—" : groups.length === 1 ? groups[0] : `${groups[0]} +${groups.length - 1}`;
  const cur = monthKey(now());
  const base = student.paymentType === "deferred" ? shiftMonth(cur, -1) : cur;
  const stageId = GRADES.find((g) => g.id === student.grade)?.stage ?? "primary";
  const stageAr: Record<string, string> = { pre: "تمهيدي", primary: "ابتدائي", prep: "إعدادي", secondary: "ثانوي" };
  return {
    id: student.id, name: student.name, stageLabel: stageAr[stageId],
    gradeLabel: gradeLabel(student.grade, "ar"), sectionLabel, teachers, subjects,
    feeLabel: formatMoney(studentNetFee(student), sym),
    issueLabel: fmt(student.registrationDate), validLabel: validUntil(db, student, base),
    status, qrValue: student.qrCode || `CPD:${student.id}`,
    barcode: (student.id.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || student.id.slice(-8)),
    isPrivate: student.enrollmentType === "private", netFee: studentNetFee(student),
  };
}
const fmt = (ts: number) => new Date(ts).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
function validUntil(db: DatabaseShape, student: Student, base: string) {
  const st = studentPaymentStatus(db, student);
  let p = base;
  if (!(student.isExempt || st.status === "paid")) {
    const paid = new Set(db.payments.filter((x) => x.studentId === student.id && x.type === "MONTHLY_FEE").map((x) => x.month));
    const reg = monthKey(student.registrationDate); let m = base;
    while (m >= reg && !paid.has(m)) m = shiftMonth(m, -1); p = m >= reg ? m : reg;
  }
  const [y, mm] = p.split("-").map(Number);
  return fmt(new Date(y, mm, 0, 23, 59, 59).getTime());
}

const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(f.slice(0, 2), 16), g = parseInt(f.slice(2, 4), 16), b = parseInt(f.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

function useMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => { const cw = e[0]?.contentRect.width; if (cw) setW(cw); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return { ref, w };
}

/* ============================== flip wrapper ============================== */
export const IdCard = memo(function IdCard({ db, student, theme, flipped, onFlip }: {
  db: DatabaseShape; student: Student; theme: CardTheme; flipped: boolean; onFlip: () => void;
}) {
  const { ref, w } = useMeasure();
  const h = Math.round(w / 1.5852);
  return (
    <div ref={ref} className="group w-full cursor-pointer [perspective:1600px]" onClick={onFlip} style={{ height: h }}>
      <div className={cn("relative transition-transform duration-700 ease-out [transform-style:preserve-3d]", flipped && "[transform:rotateY(180deg)]")} style={{ width: w, height: h }}>
        <div className="absolute inset-0 [backface-visibility:hidden]"><IdCardFront db={db} student={student} theme={theme} width={w} /></div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"><IdCardBack db={db} student={student} theme={theme} width={w} /></div>
      </div>
    </div>
  );
});

/* logo glyph (uploaded image or gold initials) */
function LogoGlyph({ theme, centerName, size }: { theme: CardTheme; centerName: string; size: number }) {
  if (theme.logoImage) return <img src={theme.logoImage} alt="logo" className="h-full w-full object-cover" />;
  return (
    <span className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg,${theme.accent || "#F59E0B"},${hexA(theme.accent || "#F59E0B", 0.6)})` }}>
      <span className="font-extrabold" style={{ fontSize: size * 0.42, color: theme.headerFrom || "#0B1023" }}>{theme.logoText || centerName?.slice(0, 2) || "FM"}</span>
    </span>
  );
}

/* ============================== FRONT ============================== */
export function IdCardFront({ db, student, theme, width = 360 }: { db: DatabaseShape; student: Student; theme: CardTheme; width?: number }) {
  const s = width / 85.6;
  const h = width / 1.5852;
  const L = theme.labels;
  const accent = theme.accent || "#F59E0B";
  const ink = theme.bodyText || "#1F2937";
  const muted = theme.labelText || "#9CA3AF";
  const surface = theme.bodyBg || "#FFFFFF";
  const navy1 = theme.headerFrom || "#0B1023";
  const navy2 = theme.headerTo || "#1E2742";
  const radius = Math.min(32, theme.cornerRadius ?? 3);
  const info = studentCardInfo(db, student);
  const centerName = theme.customCenterName?.trim() || db.profile.name || "Future Minds Center";

  // full-card image override
  if (theme.frontImage) {
    return (
      <div dir="rtl" className="relative overflow-hidden shadow-[0_20px_50px_-16px_rgba(11,16,35,0.45)] ring-1 ring-black/[0.06] transition-transform duration-300 group-hover:-translate-y-1.5"
        style={{ width, height: h, borderRadius: radius * s, background: surface }}>
        <img src={theme.frontImage} alt="card" className={theme.imageFit === "contain" ? "h-full w-full object-contain" : "h-full w-full object-cover"} />
      </div>
    );
  }

  // Build the data rows — default to VISIBLE when a field key is missing (old themes)
  const isVisible = (k: string) => theme.fields?.[k] !== false;
  const order = (theme.fieldOrder?.length ? theme.fieldOrder : ["stage", "grade", "section", "teachers", "fee"]).filter((k) => k !== "teachers");
  const valOf: Record<string, string> = { code: info.id, stage: info.stageLabel, grade: info.gradeLabel, section: info.sectionLabel, fee: info.feeLabel };
  const lblOf: Record<string, string> = { code: "كود الطالب", stage: "المرحلة", grade: "الصف", section: "القسم", fee: "الرسوم" };
  const rows: [string, string][] = [];
  order.filter((k) => isVisible(k) && k !== "code").forEach((k) => rows.push([L[k] ?? lblOf[k] ?? k, valOf[k] ?? "—"]));
  // teachers always shown if present (not gated on a strict true check)
  const teacherNames = info.teachers;

  // custom dates override the computed ones
  const startDate = theme.customStart ? fmtCardDate(theme.customStart, "ar") : info.issueLabel;
  const endDate = theme.customEnd ? fmtCardDate(theme.customEnd, "ar") : info.validLabel;

  return (
    <div dir="rtl" className="relative overflow-hidden shadow-[0_20px_50px_-16px_rgba(11,16,35,0.45)] ring-1 ring-black/[0.06] transition-transform duration-300 group-hover:-translate-y-1.5"
      style={{ width, height: h, borderRadius: radius * s, background: surface, fontFamily: fontOf(theme.fontKey) }}>
      {/* centered watermark */}
      <GraduationCap
        className="pointer-events-none absolute z-0"
        style={{ width: 38 * s, height: 38 * s, left: "50%", top: "52%", transform: "translate(-50%,-50%)", color: ink, opacity: (theme.watermarkOpacity ?? 4) / 100 }}
        strokeWidth={1.1}
      />
      {theme.bgImage && <img src={theme.bgImage} alt="" className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" style={{ opacity: (theme.watermarkOpacity ?? 4) / 100 }} />}

      {/* TOP NAVY HEADER */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2" style={{ height: 12 * s, paddingInline: 4 * s, background: `linear-gradient(120deg, ${navy1}, ${navy2})` }}>
        <div className="flex min-w-0 items-center gap-1.5">
          {theme.showLogo && (
            <div className="shrink-0 overflow-hidden shadow-sm ring-1 ring-white/30" style={{ width: (theme.logoSize ?? 8) * s, height: (theme.logoSize ?? 8) * s, borderRadius: 2 * s }}>
              <LogoGlyph theme={theme} centerName={centerName} size={(theme.logoSize ?? 8) * s} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-extrabold leading-none text-white" style={{ fontSize: 3.2 * s }}>{centerName}</p>
            {theme.showAcademyName !== false && <p className="mt-0.5 leading-none" style={{ fontSize: 1.9 * s, color: accent }}>{L.academyRole}</p>}
          </div>
        </div>
        {theme.showCardTitle !== false && (
          <div className="shrink-0 text-end">
            <p className="font-extrabold uppercase tracking-wide text-white" style={{ fontSize: 3.4 * s, lineHeight: 1 }}>{L.cardTitle}</p>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 z-10" style={{ top: 12 * s, height: 0.6 * s, background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.2)})` }} />

      {/* MAIN CONTENT: info (right) + QR (left) — fits tightly, no clipping */}
      <div className="absolute z-10 flex items-start gap-2" style={{ top: 13.5 * s, bottom: 8 * s, paddingInline: 4 * s }}>
        {/* info section (right in RTL) */}
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 0.8 * s }}>
          {/* student name */}
          <div>
            <p style={{ fontSize: 1.7 * s, color: muted, lineHeight: 1 }}>{arLabel("اسم الطالب", true)}</p>
            <p className="font-extrabold" style={{ fontSize: nameFontSize(info.name) * s, color: ink, lineHeight: 1.1, marginTop: 0.3 * s, overflowWrap: "break-word" }}>{info.name}</p>
          </div>

          {/* teachers — ALL of them, compact, always visible */}
          {isVisible("teachers") && teacherNames.length > 0 && (
            <div>
              <p style={{ fontSize: 1.6 * s, color: muted, lineHeight: 1, marginBottom: 0.3 * s }}>{L.teachers ?? "المعلمون"}</p>
              <div className="flex flex-wrap" style={{ gap: 0.4 * s }}>
                {teacherNames.map((tn, i) => (
                  <span key={i} className="font-semibold leading-none" style={{ fontSize: 1.8 * s, color: accent, background: hexA(accent, 0.1), border: `0.5px solid ${hexA(accent, 0.3)}`, borderRadius: 1.2 * s, padding: `${0.5 * s}px ${0.7 * s}px`, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tn}</span>
                ))}
              </div>
            </div>
          )}

          {/* data grid — clear, readable, always visible */}
          {rows.length > 0 && (
            <div className="grid grid-cols-2" style={{ gap: `${0.6 * s}px ${1.5 * s}px` }}>
              {rows.slice(0, 6).map((r, i) => (
                <div key={i} className="min-w-0">
                  <p style={{ fontSize: 1.8 * s, color: muted, lineHeight: 1.1 }}>{r[0]}</p>
                  <p className="truncate font-bold" style={{ fontSize: 2.6 * s, color: ink, lineHeight: 1.15 }}>{r[1] || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR section (left) */}
        <div className="flex shrink-0 flex-col items-center gap-0.5" style={{ width: 21 * s }}>
          <div className="bg-white shadow-[0_6px_18px_-8px_rgba(11,16,35,0.4)] ring-1 ring-black/5" style={{ padding: 1.3 * s, borderRadius: 2 * s }}>
            <QRCodeImage value={info.qrValue} size={Math.round((theme.qrSize ?? 12) * s)} />
          </div>
          <p className="font-mono font-bold" style={{ fontSize: 2.3 * s, color: ink }}>{info.id}</p>
          <p style={{ fontSize: 1.5 * s, color: muted, textAlign: "center" }}>{L.scanHint}</p>
        </div>
      </div>

      {/* BOTTOM BAR: barcode (left) + validity dates (right) */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t" style={{ borderColor: hexA(ink, 0.08), padding: `${1.4 * s}px ${4 * s}px`, height: 8 * s }}>
        {theme.showBarcode !== false ? (
          <Barcode value={info.barcode} height={Math.round(4.5 * s)} width={1} color={hexA(ink, 0.75)} />
        ) : <span />}
        <div className="shrink-0 text-end leading-tight">
          <p style={{ fontSize: 1.6 * s, color: muted }}>{arLabel("الصلاحية", true)}</p>
          <p className="font-bold" style={{ fontSize: 2 * s, color: ink }}>{startDate} ← {endDate}</p>
        </div>
      </div>
    </div>
  );
}

/** Scale the student-name font down slightly for long names so it stays readable. */
function nameFontSize(name: string): number {
  const len = (name || "").length;
  if (len <= 18) return 5.6;
  if (len <= 26) return 4.6;
  return 3.8;
}
function arLabel(ar: string, _force: boolean) { return ar; }

/* ============================== BACK ============================== */
export function IdCardBack({ db, student, theme, width = 360 }: { db: DatabaseShape; student: Student; theme: CardTheme; width?: number }) {
  const s = width / 85.6;
  const h = width / 1.5852;
  const L = theme.labels;
  const accent = theme.accent || "#F59E0B";
  const bText = theme.backText || "#E5E7EB";
  const navy1 = theme.headerFrom || "#0B1023";
  const navy2 = theme.headerTo || "#1E2742";
  const radius = Math.min(32, theme.cornerRadius ?? 3);
  const info = studentCardInfo(db, student);
  const centerName = db.profile.name || "Future Minds Center";
  // dynamic instructions array takes priority over the fixed instructions0-4 labels
  const inst = (theme.instructions?.length
    ? theme.instructions
    : [L.instructions0, L.instructions1, L.instructions2, L.instructions3, L.instructions4]
  ).filter(Boolean).slice(0, 6);
  const phone = L.supportPhone || db.profile.phone || "";
  const extraLines = (L.extraText || theme.extraText || "").split("\n").map((x) => x.trim()).filter(Boolean);

  // full-card image override
  if (theme.backImage) {
    return (
      <div dir="rtl" className="relative overflow-hidden shadow-[0_20px_50px_-16px_rgba(11,16,35,0.45)] ring-1 ring-white/10"
        style={{ width, height: h, borderRadius: radius * s, background: navy1 }}>
        <img src={theme.backImage} alt="card back" className={theme.imageFit === "contain" ? "h-full w-full object-contain" : "h-full w-full object-cover"} />
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative overflow-hidden shadow-[0_20px_50px_-16px_rgba(11,16,35,0.45)] ring-1 ring-white/10"
      style={{ width, height: h, borderRadius: radius * s, background: `linear-gradient(150deg, ${theme.backFrom || navy1}, ${theme.backTo || navy2})`, fontFamily: fontOf(theme.fontKey) }}>
      {/* abstract curved shapes */}
      <div className="pointer-events-none absolute" style={{ right: -20 * s, top: -16 * s, width: 60 * s, height: 60 * s, borderRadius: "50%", background: `radial-gradient(circle, ${hexA(accent, 0.16)}, transparent 65%)` }} />
      <div className="pointer-events-none absolute" style={{ left: -22 * s, bottom: -24 * s, width: 64 * s, height: 64 * s, borderRadius: "50%", background: `radial-gradient(circle, ${hexA("#6366F1", 0.14)}, transparent 65%)` }} />

      <div className="relative flex h-full items-stretch gap-2.5" style={{ padding: 4 * s }}>
        {/* QR (left) */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1" style={{ width: 24 * s }}>
          <div className="rounded-2xl bg-white shadow-lg ring-1 ring-white/10" style={{ padding: 1.4 * s, borderRadius: 2.2 * s }}>
            <QRCodeImage value={info.qrValue} size={Math.round((theme.qrSize ?? 13) * 1.05 * s)} />
          </div>
          <p className="mt-0.5 font-bold" style={{ fontSize: 2 * s, color: accent }}>{arLabel("امسح للحضور", true)}</p>
        </div>

        {/* divider */}
        <div className="my-1" style={{ width: 0.5 * s, background: hexA("#ffffff", 0.1) }} />

        {/* instructions (right) */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1 flex items-center gap-1.5">
            <Info className="shrink-0" style={{ width: 3 * s, height: 3 * s, color: accent }} />
            <p className="font-extrabold text-white" style={{ fontSize: 3 * s }}>{arLabel("تعليمات الاستخدام", true)}</p>
          </div>
          <ul className="space-y-1">
            {inst.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 shrink-0 rounded-full" style={{ width: 1.3 * s, height: 1.3 * s, background: accent }} />
                <span style={{ fontSize: 1.9 * s, color: bText, lineHeight: 1.35 }}>{t}</span>
              </li>
            ))}
          </ul>
          {(phone || L.website) && (
            <div className="mt-1.5 space-y-0.5" style={{ fontSize: 1.7 * s, color: hexA(bText, 0.7) }}>
              {phone && <p className="flex items-center gap-1"><Phone className="shrink-0" style={{ width: 2 * s, height: 2 * s }} />{phone}</p>}
              {L.website && <p className="flex items-center gap-1"><Globe className="shrink-0" style={{ width: 2 * s, height: 2 * s }} />{L.website}</p>}
            </div>
          )}
          {/* extra free text */}
          {extraLines.length > 0 && (
            <div className="mt-1.5 space-y-0.5 border-t pt-1" style={{ borderColor: hexA("#ffffff", 0.1) }}>
              {extraLines.map((t, i) => (
                <p key={i} style={{ fontSize: 1.7 * s, color: hexA(bText, 0.85), lineHeight: 1.3 }}>{t}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t" style={{ borderColor: hexA("#ffffff", 0.1), padding: `${1.4 * s}px ${4 * s}px` }}>
        <span style={{ fontSize: 1.7 * s, color: hexA(bText, 0.5) }}>{(L.footer || "").replace("{year}", String(new Date().getFullYear()))} · v1.0</span>
        <span className="flex items-center gap-1 font-bold text-white" style={{ fontSize: 2 * s }}>
          <ShieldCheck style={{ width: 2.4 * s, height: 2.4 * s, color: accent }} />{centerName}
        </span>
      </div>
    </div>
  );
}
