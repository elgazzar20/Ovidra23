/**
 * Student ID Card — Premium export engine (CR80 85.6×54mm)
 *  - DATA face (front): white body + navy top/bottom bars, QR left, data table right, barcode footer
 *  - INSTRUCTIONS face (back): navy gradient + gold-bulleted rules + QR box + footer
 *  - PNG/JPEG (300 DPI) · SVG · PDF (CR80 or A4 sheet w/ crop marks) · ZIP
 *  - Background generation with progress (10k+), never freezes the UI
 */
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import JSZip from "jszip";
import type { CardTheme, DatabaseShape, Student } from "./types";
import {
  studentNetFee, currencySymbol, formatMoney, studentPaymentStatus, shiftMonth,
} from "./analytics";
import { monthKey, now } from "./db";
import { gradeLabel, subjectLabel } from "./constants";
import { fontOf, fmtCardDate } from "./cardTheme";

export type CardFace = "front" | "back";

export interface CardData {
  id: string;
  name: string;
  stageLabel: string;
  gradeLabel: string;
  sectionLabel: string;
  teachers: string[];
  subjects: string[];
  feeLabel: string;
  issueLabel: string;
  validLabel: string;
  status: "active" | "paused" | "expired";
  qrValue: string;
  barcode: string;
  isPrivate: boolean;
}

export function buildCardData(db: DatabaseShape, student: Student, lang: string): CardData {
  const sym = currencySymbol(db);
  const st = studentPaymentStatus(db, student);
  let status: CardData["status"];
  if (student.isExempt || st.status === "paid") status = "active";
  else if (st.status === "overdue" && st.monthsLate >= 2) status = "expired";
  else status = "paused";

  const teacherRows = (student.teachers ?? []).map((tr) => ({ t: db.teachers.find((x) => x.id === tr.teacherId) })).filter((x) => x.t) as { t: NonNullable<ReturnType<typeof db.teachers.find>> }[];
  const teachers = teacherRows.map((x) => x.t.name);
  const subjects = Array.from(new Set(teacherRows.flatMap((x) => x.t.subjects ?? []).map((s) => subjectLabel(s, lang as any))));

  const groups = (student.groupIds ?? []).map((id) => db.groups.find((g) => g.id === id)?.name).filter(Boolean) as string[];
  const sectionLabel = groups.length === 0 ? "—" : groups.length === 1 ? groups[0] : `${groups[0]} +${groups.length - 1}`;

  const endOfMonth = (m: string) => { const [y, mm] = m.split("-").map(Number); return new Date(y, mm, 0, 23, 59, 59, 999); };
  const cur = monthKey(now());
  const base = student.paymentType === "deferred" ? shiftMonth(cur, -1) : cur;
  let paidThrough = base;
  if (status !== "active") {
    const paid = new Set(db.payments.filter((p) => p.studentId === student.id && p.type === "MONTHLY_FEE").map((p) => p.month));
    const reg = monthKey(student.registrationDate); let m = base; while (m >= reg && !paid.has(m)) m = shiftMonth(m, -1);
    paidThrough = m >= reg ? m : reg;
  }

  const STAGE_OF: Record<string, string> = { PRE:"pre",KG1:"pre",KG2:"pre",G1:"primary",G2:"primary",G3:"primary",G4:"primary",G5:"primary",G6:"primary",P1:"prep",P2:"prep",P3:"prep",S1:"secondary",S2:"secondary",S3:"secondary" };
  const stageId = STAGE_OF[student.grade ?? ""] ?? "primary";
  const stageAr: Record<string,string> = { pre:"تمهيدي", primary:"ابتدائي", prep:"إعدادي", secondary:"ثانوي" };
  const ar = lang === "ar";
  const code = student.id.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || student.id.slice(-8);
  return {
    id: student.id, name: student.name,
    stageLabel: ar ? stageAr[stageId] : stageId,
    gradeLabel: gradeLabel(student.grade, lang as any), sectionLabel, teachers, subjects,
    feeLabel: formatMoney(studentNetFee(student), sym),
    issueLabel: fmtDate(student.registrationDate, lang),
    validLabel: fmtDate(endOfMonth(paidThrough).getTime(), lang),
    status, qrValue: student.qrCode || `CPD:${student.id}`, barcode: code,
    isPrivate: student.enrollmentType === "private",
  };
}

function fmtDate(ts: number, lang: string) {
  return new Date(ts).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ============================ QR matrix ============================ */
const qrCache = new Map<string, { size: number; data: number[] }>();
function getQrMatrix(value: string) {
  const cached = qrCache.get(value);
  if (cached) return cached;
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const flat: number[] = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) flat[r * n + c] = qr.modules.get(c, r) ? 1 : 0;
  const entry = { size: n, data: flat };
  if (qrCache.size > 2000) qrCache.clear();
  qrCache.set(value, entry);
  return entry;
}
function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, dark: string) {
  const { size: n, data } = getQrMatrix(value);
  const cell = size / n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (data[r * n + c]) { ctx.fillStyle = dark; ctx.fillRect(x + c * cell, y + r * cell, cell + 0.7, cell + 0.7); }
}

/* ============================ canvas helpers ============================ */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
const grad = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string) => {
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, a); g.addColorStop(1, b); return g;
};
const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(f.slice(0,2),16), g = parseInt(f.slice(2,4),16), b = parseInt(f.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
};
function fit(ctx: CanvasRenderingContext2D, txt: string, maxW: number): string {
  if (ctx.measureText(txt).width <= maxW) return txt;
  let lo = 1, hi = txt.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ctx.measureText(txt.slice(0, m) + "…").width <= maxW) lo = m + 1; else hi = m; }
  return txt.slice(0, Math.max(1, lo - 1)) + "…";
}
/* ============================ barcode ============================ */
const bcCache = new Map<string, HTMLCanvasElement>();
function barcodeCanvas(value: string, dark: string): HTMLCanvasElement {
  const key = value + dark;
  const cached = bcCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  try { JsBarcode(c, value, { format: "CODE128", height: 50, width: 2, displayValue: false, margin: 0, background: "transparent", lineColor: dark }); } catch { /* ignore */ }
  bcCache.set(key, c); if (bcCache.size > 800) bcCache.clear();
  return c;
}

/* ============================ the premium card drawer ============================ */
export function drawCard(ctx: CanvasRenderingContext2D, pxW: number, face: CardFace, theme: CardTheme, data: CardData, _lang: string, logoImg: HTMLImageElement | null, centerName: string) {
  const pxH = Math.round(pxW / 1.5852);
  const u = pxW / 85.6;
  const L = theme.labels;
  const FONT = fontOf(theme.fontKey);
  const accent = theme.accent || "#F59E0B";
  const ink = theme.bodyText || "#1F2937";
  const muted = theme.labelText || "#9CA3AF";
  const surface = theme.bodyBg || "#FFFFFF";
  const navy1 = theme.headerFrom || "#0B1023";
  const navy2 = theme.headerTo || "#1E2742";
  const centerNameFinal = theme.customCenterName?.trim() || centerName;
  const radius = Math.min(32, theme.cornerRadius ?? 3) * u;

  ctx.clearRect(0, 0, pxW, pxH);

  if (face === "front") {
    /* ===== FRONT (premium split layout) ===== */
    roundRect(ctx, 0, 0, pxW, pxH, radius); ctx.fillStyle = surface; ctx.fill();
    ctx.save(); roundRect(ctx, 0, 0, pxW, pxH, radius); ctx.clip();

    // subtle graduation-cap watermark
    // centered watermark (configurable opacity)
    const wmOp = (theme.watermarkOpacity ?? 4) / 100;
    ctx.globalAlpha = wmOp; ctx.fillStyle = ink;
    drawGradCap(ctx, pxW * 0.5, pxH * 0.55, 20 * u);
    ctx.globalAlpha = 1;
    ctx.restore();

    const headH = 13.5 * u, pad = 4 * u;

    /* TOP NAVY HEADER */
    ctx.save(); roundRect(ctx, 0, 0, pxW, pxH, radius); ctx.clip();
    ctx.fillStyle = grad(ctx, 0, 0, pxW, headH, navy1, navy2); ctx.fillRect(0, 0, pxW, headH);
    ctx.restore();
    // orange line under header
    const og = ctx.createLinearGradient(0, 0, pxW, 0); og.addColorStop(0, accent); og.addColorStop(1, hexA(accent, 0.2));
    ctx.fillStyle = og; ctx.fillRect(0, headH - 0.7 * u, pxW, 0.7 * u);

    // header RIGHT (RTL start): logo + academy name
    const logoSize = (theme.logoSize ?? 8) * u;
    const logoX = pxW - pad - logoSize;
    const logoY = (headH - logoSize) / 2;
    if (theme.showLogo && logoImg) {
      ctx.save(); roundRect(ctx, logoX, logoY, logoSize, logoSize, 2 * u); ctx.clip(); ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize); ctx.restore();
    } else if (theme.showLogo) {
      ctx.fillStyle = grad(ctx, logoX, logoY, logoSize, logoSize, accent, hexA(accent, 0.6));
      roundRect(ctx, logoX, logoY, logoSize, logoSize, 2 * u); ctx.fill();
      ctx.fillStyle = navy1; ctx.font = `800 ${logoSize * 0.42}px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(theme.logoText || centerNameFinal?.slice(0, 2) || "FM", logoX + logoSize / 2, logoY + logoSize / 2 + 0.2 * u);
    }
    ctx.textBaseline = "alphabetic";
    const hNameX = logoX - 1.4 * u;
    ctx.fillStyle = "#ffffff"; ctx.font = `800 ${3.6 * u}px ${FONT}`; ctx.textAlign = "right";
    ctx.fillText(fit(ctx, centerNameFinal || "Future Minds Center", pxW - logoSize - 30 * u), hNameX, headH / 2 - 0.8 * u);
    if (theme.showAcademyName !== false) { ctx.fillStyle = accent; ctx.font = `600 ${2.1 * u}px ${FONT}`; ctx.fillText(L.academyRole || "Academic Management System", hNameX, headH / 2 + 2.4 * u); }
    // header LEFT: ID CARD title (toggleable)
    if (theme.showCardTitle !== false) {
      ctx.fillStyle = "#ffffff"; ctx.font = `800 ${3.6 * u}px ${FONT}`; ctx.textAlign = "left";
      ctx.fillText(L.cardTitle || "ID CARD", pad, headH / 2 + 0.5 * u);
    }

    /* MAIN: info (right/RTL-start) + QR (left) */
    const midTop = headH + 2.5 * u;
    const qrZoneW = 22 * u;
    const qrSize = (theme.qrSize ?? 13) * u, qrBox = qrSize + 2.8 * u;
    const qrX = pad, qrY = midTop + 1.5 * u;
    ctx.shadowColor = "rgba(11,16,35,0.25)"; ctx.shadowBlur = 3 * u; ctx.shadowOffsetY = 1.2 * u;
    roundRect(ctx, qrX, qrY, qrBox, qrBox, 2.2 * u); ctx.fillStyle = "#ffffff"; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    drawQr(ctx, data.qrValue, qrX + 1.4 * u, qrY + 1.4 * u, qrSize, ink);
    // student code directly under QR
    ctx.fillStyle = ink; ctx.font = `800 ${2.4 * u}px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText(data.id, qrX + qrBox / 2, qrY + qrBox + 3.2 * u);
    ctx.fillStyle = muted; ctx.font = `500 ${1.6 * u}px ${FONT}`;
    ctx.fillText(fit(ctx, L.scanHint || "امسح للحضور", qrBox), qrX + qrBox / 2, qrY + qrBox + 5.4 * u);

    // info block (right of QR)
    const infoLeft = qrX + qrZoneW + 1.5 * u, infoRight = pxW - pad;
    // "اسم الطالب" label
    ctx.fillStyle = muted; ctx.font = `500 ${1.9 * u}px ${FONT}`; ctx.textAlign = "right";
    ctx.fillText("اسم الطالب", infoRight, midTop + 2.5 * u);
    // student name — large & bold
    const nmLen = data.name.length;
    const nmFs = nmLen <= 18 ? 5.6 : nmLen <= 26 ? 4.6 : 3.8;
    ctx.fillStyle = ink; ctx.font = `800 ${nmFs * u}px ${FONT}`;
    ctx.fillText(fit(ctx, data.name, infoRight - infoLeft), infoRight, midTop + 6 * u);

    // visibility helper — default to VISIBLE when a field key is missing (old themes)
    const isVisible = (k: string) => theme.fields?.[k] !== false;
    // teacher chips — all teachers, compact
    const teacherNames = data.teachers;
    let chipsBottomY = midTop + 8 * u;
    if (isVisible("teachers") && teacherNames.length) {
      // label
      ctx.fillStyle = muted; ctx.font = `500 ${1.6 * u}px ${FONT}`; ctx.textAlign = "right";
      ctx.fillText(L.teachers || "المعلمون", infoRight, midTop + 8.5 * u);
      const chipMaxW = infoRight - infoLeft - 1.5 * u;
      let chipX = infoRight;
      let chipRowY = midTop + 11.5 * u;
      let rowCount = 0;
      teacherNames.forEach((tn) => {
        ctx.font = `600 ${1.7 * u}px ${FONT}`;
        const measured = ctx.measureText(tn).width;
        const tw = Math.min(measured, chipMaxW * 0.48) + 2.6 * u;
        const label = measured > chipMaxW * 0.48 ? fit(ctx, tn, chipMaxW * 0.48) : tn;
        if (chipX - tw < infoLeft) { chipX = infoRight; chipRowY += 3.8 * u; rowCount++; if (rowCount >= 2) return; }
        const x = chipX - tw;
        roundRect(ctx, x, chipRowY - 2.5 * u, tw, 3.4 * u, 1.5 * u);
        ctx.fillStyle = hexA(accent, 0.1); ctx.fill();
        ctx.strokeStyle = hexA(accent, 0.3); ctx.lineWidth = 0.4 * u; ctx.stroke();
        ctx.fillStyle = accent; ctx.textAlign = "right";
        ctx.fillText(label, x + tw - 1.2 * u, chipRowY);
        chipX = x - 0.8 * u;
      });
      chipsBottomY = chipRowY + 3 * u;
    }

    // other fields grid — visible fields only
    const order = (theme.fieldOrder?.length ? theme.fieldOrder : ["stage", "grade", "section", "teachers", "fee"]).filter((k) => k !== "teachers" && k !== "code");
    const valOf: Record<string, string> = { code: data.id, stage: data.stageLabel, grade: data.gradeLabel, section: data.sectionLabel, fee: data.feeLabel };
    const lblOf: Record<string, string> = { code: "كود الطالب", stage: "المرحلة", grade: "الصف", section: "القسم", fee: "الرسوم" };
    const rows: [string, string][] = [];
    order.filter((k) => isVisible(k)).forEach((k) => rows.push([L[k] ?? lblOf[k] ?? k, valOf[k] ?? "—"]));
    const colW = (infoRight - infoLeft) / 2;
    const cellH = 5.2 * u;
    const gridTop = chipsBottomY + 1.5 * u;
    rows.slice(0, 6).forEach((r, i) => {
      const col = i % 2, rown = Math.floor(i / 2);
      const cx = infoRight - col * colW;
      const cy = gridTop + rown * cellH;
      ctx.fillStyle = muted; ctx.font = `500 ${1.8 * u}px ${FONT}`; ctx.textAlign = "right";
      ctx.fillText(r[0], cx, cy);
      ctx.fillStyle = ink; ctx.font = `700 ${2.6 * u}px ${FONT}`;
      ctx.fillText(fit(ctx, r[1] || "—", colW - 1.5 * u), cx, cy + 2.6 * u);
    });

    /* BOTTOM BAR: barcode (left) + validity dates (right, small) */
    ctx.strokeStyle = hexA(ink, 0.08); ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); ctx.moveTo(pad, pxH - 8.5 * u); ctx.lineTo(pxW - pad, pxH - 8.5 * u); ctx.stroke();
    // dates right (custom override honored)
    const startLabel = theme.customStart ? fmtCardDate(theme.customStart) : data.issueLabel;
    const endLabel = theme.customEnd ? fmtCardDate(theme.customEnd) : data.validLabel;
    ctx.fillStyle = muted; ctx.font = `500 ${1.7 * u}px ${FONT}`; ctx.textAlign = "right";
    ctx.fillText("الصلاحية", infoRight, pxH - 6 * u);
    ctx.fillStyle = ink; ctx.font = `700 ${2.1 * u}px ${FONT}`;
    ctx.fillText(`${startLabel} ← ${endLabel}`, infoRight, pxH - 3.4 * u);
    // barcode left
    if (theme.showBarcode !== false) {
      const bc = barcodeCanvas(data.barcode, hexA(ink, 0.7));
      const bcH = 4.5 * u, bcW = (bc.width / bc.height) * bcH || 26 * u;
      ctx.drawImage(bc, pad, pxH - 6.4 * u, bcW, bcH);
    }

  } else {
    /* ===== BACK (full navy, abstract shapes) ===== */
    roundRect(ctx, 0, 0, pxW, pxH, radius);
    ctx.fillStyle = grad(ctx, 0, 0, pxW, pxH, theme.backFrom || navy1, theme.backTo || navy2); ctx.fill();
    // abstract curves
    const c1 = ctx.createRadialGradient(pxW * 0.92, pxH * 0.1, 1 * u, pxW * 0.92, pxH * 0.1, 30 * u);
    c1.addColorStop(0, hexA(accent, 0.16)); c1.addColorStop(1, "transparent");
    roundRect(ctx, 0, 0, pxW, pxH, radius); ctx.fillStyle = c1; ctx.fill();
    const c2 = ctx.createRadialGradient(pxW * 0.05, pxH * 0.95, 1 * u, pxW * 0.05, pxH * 0.95, 32 * u);
    c2.addColorStop(0, hexA("#6366F1", 0.16)); c2.addColorStop(1, "transparent");
    roundRect(ctx, 0, 0, pxW, pxH, radius); ctx.fillStyle = c2; ctx.fill();

    const pad = 4 * u;
    const bText = theme.backText || "#E5E7EB";
    const qrZoneW = 24 * u;

    // QR (left)
    const qSize = (theme.qrSize ?? 13) * 1.05 * u, qBox = qSize + 2.8 * u;
    const qx = pad, qy = (pxH - qBox) / 2 - 4 * u;
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 3 * u; ctx.shadowOffsetY = 1.2 * u;
    roundRect(ctx, qx, qy, qBox, qBox, 2.2 * u); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    drawQr(ctx, data.qrValue, qx + 1.4 * u, qy + 1.4 * u, qSize, ink);
    ctx.fillStyle = accent; ctx.font = `700 ${2 * u}px ${FONT}`; ctx.textAlign = "center";
    ctx.fillText("SCAN FOR ATTENDANCE", qx + qBox / 2, qy + qBox + 3.4 * u);

    // thin divider
    const divX = pxW - qrZoneW - pad;
    ctx.strokeStyle = hexA("#ffffff", 0.1); ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); ctx.moveTo(divX, pad + 3 * u); ctx.lineTo(divX, pxH - pad - 7 * u); ctx.stroke();

    // instructions (right)
    const rightLeft = divX + 3 * u, rightRight = pxW - pad;
    // title with info dot
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(rightRight - 1.6 * u, pad + 2.4 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = `800 ${3 * u}px ${FONT}`; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText("تعليمات الاستخدام", rightRight - 3.4 * u, pad + 3.4 * u);

    const inst = (theme.instructions?.length
      ? theme.instructions
      : [L.instructions0, L.instructions1, L.instructions2, L.instructions3, L.instructions4]
    ).filter(Boolean);
    const extraLines = (L.extraText || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3);
    inst.slice(0, extraLines.length ? 4 : 5).forEach((t, i) => {
      const iy = pad + 6.8 * u + i * 3.6 * u;
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(rightRight - 1.3 * u, iy - 0.8 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bText; ctx.textAlign = "right";
      ctx.fillText(fit(ctx, t, rightRight - rightLeft - 3 * u), rightRight - 3 * u, iy);
    });
    // contact
    const phone = L.supportPhone || "";
    const shownInst = Math.min(inst.length, extraLines.length ? 4 : 5);
    let cy = pad + 6.8 * u + shownInst * 3.6 * u + 1 * u;
    ctx.font = `500 ${1.8 * u}px ${FONT}`; ctx.textAlign = "right";
    if (phone) { ctx.fillStyle = hexA(bText, 0.7); ctx.fillText("📞 " + phone, rightRight, cy); cy += 3 * u; }
    if (L.website) { ctx.fillStyle = hexA(bText, 0.7); ctx.fillText("🌐 " + fit(ctx, L.website, rightRight - rightLeft), rightRight, cy); cy += 3 * u; }

    // extra free text (multi-line)
    if (extraLines.length) {
      ctx.strokeStyle = hexA("#ffffff", 0.1); ctx.lineWidth = 0.5 * u;
      ctx.beginPath(); ctx.moveTo(rightLeft, cy - 1.5 * u); ctx.lineTo(rightRight, cy - 1.5 * u); ctx.stroke();
      cy += 1.5 * u;
      extraLines.forEach((t) => { ctx.fillStyle = hexA(bText, 0.85); ctx.font = `600 ${1.7 * u}px ${FONT}`; ctx.textAlign = "right"; ctx.fillText(fit(ctx, t, rightRight - rightLeft), rightRight, cy); cy += 2.6 * u; });
    }

    // footer line
    ctx.strokeStyle = hexA("#ffffff", 0.1); ctx.lineWidth = 0.5 * u;
    ctx.beginPath(); ctx.moveTo(pad, pxH - 5.5 * u); ctx.lineTo(pxW - pad, pxH - 5.5 * u); ctx.stroke();
    ctx.fillStyle = hexA(bText, 0.5); ctx.font = `500 ${1.7 * u}px ${FONT}`; ctx.textAlign = "left";
    ctx.fillText((L.footer || "").replace("{year}", String(new Date().getFullYear())) + " · v1.0", pad, pxH - 2.8 * u);
    ctx.fillStyle = accent; ctx.font = `800 ${2.1 * u}px ${FONT}`; ctx.textAlign = "right";
    ctx.fillText(fit(ctx, centerNameFinal || "Center Plus", pxW * 0.5), pxW - pad, pxH - 2.6 * u);
  }
}

/** Draws a graduation-cap glyph as a subtle watermark. */
function drawGradCap(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  // mortarboard
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.35); ctx.lineTo(size, 0); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size, 0); ctx.closePath();
  ctx.fill();
  // cap base
  ctx.fillRect(-size * 0.5, size * 0.2, size, size * 0.5);
  ctx.beginPath(); ctx.moveTo(-size * 0.5, size * 0.2); ctx.lineTo(0, size * 0.55); ctx.lineTo(size * 0.5, size * 0.2); ctx.fill();
  // tassel
  ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = size * 0.08; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(size, size * 0.4); ctx.stroke();
  ctx.restore();
}

/* ============================ render to canvas ============================ */
const DPI = 300;
const MM_TO_PX = DPI / 25.4;
export const CARD_W_MM = 85.6;
export const CARD_H_MM = 54;

const logoCache = new Map<string, HTMLImageElement>();
function loadLogo(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  const cached = logoCache.get(url);
  if (cached && cached.complete) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { logoCache.set(url, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderCardCanvas(db: DatabaseShape, student: Student, theme: CardTheme, face: CardFace, lang: string): Promise<HTMLCanvasElement> {
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const pxW = Math.round(CARD_W_MM * MM_TO_PX);
  const canvas = document.createElement("canvas");
  canvas.width = pxW; canvas.height = Math.round(CARD_H_MM * MM_TO_PX);
  const ctx = canvas.getContext("2d")!;
  // full-card image override takes precedence over the designed face
  const faceImgUrl = face === "front" ? theme.frontImage : theme.backImage;
  if (faceImgUrl) {
    const img = await loadLogo(faceImgUrl);
    drawCardImage(ctx, pxW, img, theme);
  } else {
    const logo = await loadLogo(theme.logoImage);
    drawCard(ctx, pxW, face, theme, buildCardData(db, student, lang), lang, logo, db.profile.name);
  }
  return canvas;
}

/** Draws an uploaded full-card image, fitted to the CR80 frame. */
function drawCardImage(ctx: CanvasRenderingContext2D, pxW: number, img: HTMLImageElement | null, theme: CardTheme) {
  const pxH = Math.round(pxW / 1.5852);
  const radius = Math.min(32, theme.cornerRadius ?? 3) * (pxW / 85.6);
  roundRect(ctx, 0, 0, pxW, pxH, radius);
  ctx.save(); ctx.clip();
  if (img) {
    if (theme.imageFit === "contain") {
      const r = Math.min(pxW / img.width, pxH / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, (pxW - dw) / 2, (pxH - dh) / 2, dw, dh);
    } else {
      const r = Math.max(pxW / img.width, pxH / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, (pxW - dw) / 2, (pxH - dh) / 2, dw, dh);
    }
  } else {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pxW, pxH);
  }
  ctx.restore();
}

/* ============================ robust download ============================ */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function canvasToBlob(c: HTMLCanvasElement, type: "png" | "jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => { c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), type === "jpeg" ? "image/jpeg" : "image/png", 0.95); });
}
async function canvasToDataUrl(c: HTMLCanvasElement, type: "png" | "jpeg"): Promise<string> {
  return c.toDataURL(type === "jpeg" ? "image/jpeg" : "image/png", 0.95);
}
function downloadDataUrl(dataUrl: string, filename: string) { const a = document.createElement("a"); a.href = dataUrl; a.download = filename; a.click(); }
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();

export async function exportPng(db: DatabaseShape, student: Student, theme: CardTheme, face: CardFace, lang: string) {
  const c = await renderCardCanvas(db, student, theme, face, lang);
  try { downloadBlob(await canvasToBlob(c, "png"), `${safeName(student.id + "_" + student.name)}_${face}.png`); }
  catch { downloadDataUrl(await canvasToDataUrl(c, "png"), `${safeName(student.id + "_" + student.name)}_${face}.png`); }
}
export async function exportJpeg(db: DatabaseShape, student: Student, theme: CardTheme, face: CardFace, lang: string) {
  const c = await renderCardCanvas(db, student, theme, face, lang);
  try { downloadBlob(await canvasToBlob(c, "jpeg"), `${safeName(student.id + "_" + student.name)}_${face}.jpg`); }
  catch { downloadDataUrl(await canvasToDataUrl(c, "jpeg"), `${safeName(student.id + "_" + student.name)}_${face}.jpg`); }
}
export async function exportSvg(db: DatabaseShape, student: Student, theme: CardTheme, face: CardFace, lang: string) {
  const c = await renderCardCanvas(db, student, theme, face, lang);
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W_MM}mm" height="${CARD_H_MM}mm" viewBox="0 0 ${c.width} ${c.height}"><image href="${await canvasToDataUrl(c, "png")}" width="${c.width}" height="${c.height}"/></svg>`;
  downloadBlob(new Blob([xml], { type: "image/svg+xml" }), `${safeName(student.id + "_" + student.name)}_${face}.svg`);
}
export async function exportSinglePdf(db: DatabaseShape, student: Student, theme: CardTheme, lang: string) {
  await printCard(db, student, theme, lang);
}

export async function printCard(db: DatabaseShape, student: Student, theme: CardTheme, lang: string) {
  const front = await renderCardCanvas(db, student, theme, "front", lang);
  const back = await renderCardCanvas(db, student, theme, "back", lang);
  const frontUrl = await canvasToDataUrl(front, "png");
  const backUrl = await canvasToDataUrl(back, "png");
  
  const w = window.open("", "_blank");
  if (!w) return;
  
  w.document.open();
  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Card - ${student.name}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; background: #f1f5f9; }
        @media print { body { background: white; padding: 0; align-items: flex-start; gap: 0; } }
        img { width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm; page-break-inside: avoid; }
        .page { page-break-after: always; display: flex; justify-content: center; align-items: center; height: 100vh; }
        @page { size: ${CARD_W_MM}mm ${CARD_H_MM}mm landscape; margin: 0; }
      </style>
    </head>
    <body>
      <div class="page"><img src="${frontUrl}" /></div>
      <div class="page"><img src="${backUrl}" /></div>
      <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

/* ============================ batch exports ============================ */
const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));
type ThemeGet = CardTheme | ((s: Student) => CardTheme);
const pickTheme = (g: ThemeGet, s: Student) => (typeof g === "function" ? g(s) : g);

export async function exportBatchPdf(db: DatabaseShape, students: Student[], themeGet: ThemeGet, lang: string, onProgress?: (i: number, n: number) => void) {
  const cols = 2, rows = 5, bleed = 3;
  const cellW = CARD_W_MM + bleed * 2, cellH = (CARD_H_MM * 2) + bleed * 2;
  const gridW = cols * cellW, gridH = rows * cellH;
  const pageW = 210, pageH = 297;
  const offX = (pageW - gridW) / 2, offY = (pageH - gridH) / 2;
  
  let htmlPages = "";
  let currentPageHtml = "";
  
  for (let i = 0; i < students.length; i++) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) {
      htmlPages += `<div class="page">${currentPageHtml}</div>`;
      currentPageHtml = "";
    }
    
    const s = students[i];
    onProgress?.(i + 1, students.length);
    const th = pickTheme(themeGet, s);
    const front = await renderCardCanvas(db, s, th, "front", lang);
    const back = await renderCardCanvas(db, s, th, "back", lang);
    
    const frontUrl = await canvasToDataUrl(front, "png");
    const backUrl = await canvasToDataUrl(back, "png");
    
    const col = slot % cols, rown = Math.floor(slot / cols);
    const x = offX + col * cellW + bleed;
    const y = offY + rown * cellH + bleed;
    
    currentPageHtml += `
      <img src="${frontUrl}" style="left: ${x}mm; top: ${y}mm; width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm;" />
      <img src="${backUrl}" style="left: ${x}mm; top: ${y + CARD_H_MM}mm; width: ${CARD_W_MM}mm; height: ${CARD_H_MM}mm;" />
      ${drawCropMarksHtml(x, y, CARD_W_MM, CARD_H_MM)}
      ${drawCropMarksHtml(x, y + CARD_H_MM, CARD_W_MM, CARD_H_MM)}
    `;
    
    if (i % 6 === 0) await yieldUI();
  }
  if (currentPageHtml) {
    htmlPages += `<div class="page">${currentPageHtml}</div>`;
  }
  
  const w = window.open("", "_blank");
  if (!w) return;
  
  w.document.open();
  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Batch Print Cards</title>
      <style>
        body { margin: 0; padding: 0; background: #e2e8f0; }
        .page { width: 210mm; height: 297mm; background: white; margin: 20px auto; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; page-break-after: always; }
        img { position: absolute; }
        .crop-mark { position: absolute; background: #94a3b8; }
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .page { margin: 0; box-shadow: none; border: none; }
          @page { size: A4 portrait; margin: 0; }
        }
      </style>
    </head>
    <body>
      ${htmlPages}
      <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 1500); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

function drawCropMarksHtml(x: number, y: number, w: number, h: number) {
  const len = 2, off = 1.5;
  const thin = 0.1;
  return `
    <div class="crop-mark" style="left: ${x}mm; top: ${y - off - len}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x}mm; top: ${y + off}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x - off - len}mm; top: ${y}mm; width: ${len}mm; height: ${thin}mm;"></div>
    <div class="crop-mark" style="left: ${x + off}mm; top: ${y}mm; width: ${len}mm; height: ${thin}mm;"></div>
    
    <div class="crop-mark" style="left: ${x + w}mm; top: ${y - off - len}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x + w}mm; top: ${y + off}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x + w + off}mm; top: ${y}mm; width: ${len}mm; height: ${thin}mm;"></div>
    <div class="crop-mark" style="left: ${x + w - off - len}mm; top: ${y}mm; width: ${len}mm; height: ${thin}mm;"></div>
    
    <div class="crop-mark" style="left: ${x}mm; top: ${y + h - off - len}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x}mm; top: ${y + h + off}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x - off - len}mm; top: ${y + h}mm; width: ${len}mm; height: ${thin}mm;"></div>
    <div class="crop-mark" style="left: ${x + off}mm; top: ${y + h}mm; width: ${len}mm; height: ${thin}mm;"></div>
    
    <div class="crop-mark" style="left: ${x + w}mm; top: ${y + h - off - len}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x + w}mm; top: ${y + h + off}mm; width: ${thin}mm; height: ${len}mm;"></div>
    <div class="crop-mark" style="left: ${x + w + off}mm; top: ${y + h}mm; width: ${len}mm; height: ${thin}mm;"></div>
    <div class="crop-mark" style="left: ${x + w - off - len}mm; top: ${y + h}mm; width: ${len}mm; height: ${thin}mm;"></div>
  `;
}

export async function exportBatchZip(db: DatabaseShape, students: Student[], themeGet: ThemeGet, lang: string, fmt: "png" | "jpeg" = "png", onProgress?: (i: number, n: number) => void) {
  const zip = new JSZip();
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    onProgress?.(i + 1, students.length);
    const front = await renderCardCanvas(db, s, pickTheme(themeGet, s), "front", lang);
    zip.file(`${safeName(s.id + "_" + s.name)}_front.${fmt === "png" ? "png" : "jpg"}`, await canvasToBlob(front, fmt));
    if (i % 6 === 0) await yieldUI();
  }
  downloadBlob(await zip.generateAsync({ type: "blob" }), `student_cards_${students.length}.zip`);
}
