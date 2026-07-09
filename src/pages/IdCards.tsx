import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Download, FileText, Printer, Loader2, ScanLine, Camera, CameraOff,
  CircleCheck, CheckCircle2, XCircle, Sparkles, GraduationCap, Palette,
  FileImage, FileArchive, FileType, Users, ChevronDown, Wand2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Button, Card, Input, Badge, Modal, EmptyState, FilterSelect, pushToast,
} from "../components/ui";
import { ViewToggle, type ViewMode } from "../components/ViewToggle";
import { IdCard, studentCardInfo } from "../components/IdCard";
import { IdCardCustomizer } from "../components/IdCardCustomizer";
import { resolveThemeForStudent, defaultTheme } from "../lib/cardTheme";
import {
  exportPng, exportSvg, exportSinglePdf, printCard, exportBatchPdf, exportBatchZip,
} from "../lib/cardExport";
import { GRADES, gradeLabel } from "../lib/constants";
import { now, startOfDay } from "../lib/db";
import { cn } from "../utils/cn";
import type { Student } from "../lib/types";
import { verifyToken } from "../lib/attendance/crypto";

type BatchFmt = "pdf" | "png" | "jpeg" | "svg" | "zip";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  expired: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};
const STATUS_AR: Record<string, string> = { active: "نشط", paused: "موقوف", expired: "منتهي" };

export function IdCards() {
  const { db, lang, can, cardThemes, upsert, setActiveCardTheme } = useApp();
  const ar = lang === "ar";

  const [query, setQuery] = useState("");
  const [fStage, setFStage] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fTeacher, setFTeacher] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [designerOpen, setDesignerOpen] = useState(false);
  const [designStudent, setDesignStudent] = useState<Student | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [busy, setBusy] = useState<{ i: number; n: number } | null>(null);

  // ensure a default theme exists so cards always render
  const ensured = useRef(false);
  useEffect(() => {
    if (!cardThemes.length && !ensured.current && can("students.manage")) {
      ensured.current = true;
      const t = defaultTheme();
      upsert("cardThemes", t); setActiveCardTheme(t.id);
    }
  }, [cardThemes.length, can, upsert, setActiveCardTheme]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return db.students
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
        if (fStage) { const g = GRADES.find((x) => x.id === s.grade); if (!g || g.stage !== fStage) return false; }
        if (fGrade && s.grade !== fGrade) return false;
        if (fTeacher && !s.teachers.some((tr) => tr.teacherId === fTeacher)) return false;
        if (fStatus) { const info = studentCardInfo(db, s); if (info.status !== fStatus) return false; }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db, query, fStage, fGrade, fTeacher, fStatus]);

  const themeOf = (s: Student) => resolveThemeForStudent(db, s);
  const toggleFlip = (id: string) => setFlipped((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const runExport = (p: Promise<void>) => {
    setBusy({ i: 0, n: 1 });
    p.then(() => setBusy(null)).catch(() => { pushToast(ar ? "تعذّر التصدير" : "Export failed", "error"); setBusy(null); });
  };

  const stats = useMemo(() => {
    let active = 0, paused = 0, expired = 0;
    for (const s of db.students) { const st = studentCardInfo(db, s).status; if (st === "active") active++; else if (st === "paused") paused++; else expired++; }
    return { active, paused, expired, total: db.students.length };
  }, [db]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-navy-700 to-navy-900 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#c9a227]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#f0d98a]" />{ar ? "بطاقات هوية بمعايير عالمية" : "Premium ID Cards"}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{ar ? "كروت هوية الطلاب" : "Student ID Cards"}</h1>
            <p className="mt-1 max-w-lg text-sm text-white/70">{ar ? "صمّم واطبع كروت هوية فاخرة (CR80) بدقة 300 DPI — مربوطة بنظام الحضور عبر QR والباركود." : "Design & print luxury CR80 cards at 300 DPI — linked to attendance via QR & barcode."}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span><b className="text-xl font-extrabold">{stats.total}</b> <span className="text-white/60">{ar ? "طالب" : "students"}</span></span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /><b>{stats.active}</b> <span className="text-white/60">{ar ? "نشط" : "active"}</span></span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /><b>{stats.paused}</b> <span className="text-white/60">{ar ? "موقوف" : "paused"}</span></span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /><b>{stats.expired}</b> <span className="text-white/60">{ar ? "منتهي" : "expired"}</span></span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDesignerOpen(true)} className="!bg-white !text-navy-800 hover:!bg-white/90"><Wand2 className="h-4 w-4" />{ar ? "استوديو التصميم" : "Design Studio"}</Button>
            <Button variant="secondary" onClick={() => setScanOpen(true)} className="!bg-white/10 !text-white hover:!bg-white/20"><ScanLine className="h-4 w-4" />{ar ? "ماسح الحضور" : "Scan"}</Button>
          </div>
        </div>
      </div>

      {busy && (
        <div className="rounded-2xl border border-brand-200/60 bg-brand-50/80 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-brand-700 dark:text-brand-300">
            <Loader2 className="h-4 w-4 animate-spin" />{ar ? "جارٍ إنشاء الكروت في الخلفية…" : "Generating cards in the background…"} ({busy.i} {ar ? "من" : "of"} {busy.n})
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/20">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${busy.n ? (busy.i / busy.n) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* toolbar */}
      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
            <Input placeholder={ar ? "بحث بالاسم أو الكود…" : "Search by name or code…"} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
          </div>
          <FilterSelect label={ar ? "المرحلة" : "Stage"} value={fStage} onChange={setFStage}
            options={[{ value: "", label: ar ? "الكل" : "All" }, { value: "pre", label: "تمهيدي" }, { value: "primary", label: "ابتدائي" }, { value: "prep", label: "إعدادي" }, { value: "secondary", label: "ثانوي" }]} />
          <FilterSelect label={ar ? "الصف" : "Grade"} value={fGrade} onChange={setFGrade}
            options={[{ value: "", label: ar ? "الكل" : "All" }, ...GRADES.map((g) => ({ value: g.id, label: gradeLabel(g.id, lang as any) }))]} />
          <FilterSelect label={ar ? "المدرس" : "Teacher"} value={fTeacher} onChange={setFTeacher}
            options={[{ value: "", label: ar ? "الكل" : "All" }, ...db.teachers.map((t) => ({ value: t.id, label: t.name }))]} />
          <FilterSelect label={ar ? "الحالة" : "Status"} value={fStatus} onChange={setFStatus}
            options={[{ value: "", label: ar ? "الكل" : "All" }, { value: "active", label: STATUS_AR.active }, { value: "paused", label: STATUS_AR.paused }, { value: "expired", label: STATUS_AR.expired }]} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={allSelected ? "primary" : "secondary"} onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map((s) => s.id)))}>
            <CheckCircle2 className="h-3.5 w-3.5" />{selected.size ? `${selected.size} ${ar ? "محدد" : "selected"}` : (ar ? "تحديد الكل" : "Select all")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBatchOpen(true)} disabled={!filtered.length}>
            <Download className="h-3.5 w-3.5" />{ar ? "تصدير جماعي" : "Batch export"}
          </Button>
          {selected.size > 0 && <Button size="sm" onClick={() => setBatchOpen(true)}><Download className="h-3.5 w-3.5" />{ar ? `تصدير ${selected.size}` : `Export ${selected.size}`}</Button>}
          <div className="ms-auto flex items-center gap-2">
            <Badge tone="brand">{ar ? `${filtered.length} كارت` : `${filtered.length} cards`}</Badge>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10"><EmptyState icon={<GraduationCap className="h-7 w-7" />} title={ar ? "لا يوجد طلاب" : "No students"} /></Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => {
            const info = studentCardInfo(db, s);
            return (
              <div key={s.id} className={cn("group flex flex-col gap-3 rounded-2xl border bg-surface p-4 transition hover:shadow-md", selected.has(s.id) ? "border-brand-400 ring-2 ring-brand-400/30" : "border-line")}>
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} className="accent-brand-600" /></label>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_TONE[info.status])}>{STATUS_AR[info.status]}</span>
                </div>
                <div className="w-full max-w-[330px] self-center">
                  <IdCard db={db} student={s} theme={themeOf(s)} flipped={flipped.has(s.id)} onFlip={() => toggleFlip(s.id)} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{s.name}</p><p className="font-mono text-[10px] text-faint">{s.id}</p></div>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" onClick={() => toggleFlip(s.id)} title={ar ? "قلب" : "Flip"}><ChevronDown className="h-4 w-4" /></Button>
                    {can("students.manage") && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => { setDesignStudent(s); setDesignerOpen(true); }} title={ar ? "تصميم" : "Design"}><Palette className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => runExport(exportPng(db, s, themeOf(s), "front", lang))} title="PNG"><FileImage className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => runExport(exportSinglePdf(db, s, themeOf(s), lang))} title="PDF"><FileText className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => runExport(printCard(db, s, themeOf(s), lang))} title={ar ? "طباعة" : "Print"}><Printer className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-line/60">
            {filtered.map((s) => {
              const info = studentCardInfo(db, s);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} className="accent-brand-600" />
                  <div className="w-[220px] shrink-0">
                    <IdCard db={db} student={s} theme={themeOf(s)} flipped={flipped.has(s.id)} onFlip={() => toggleFlip(s.id)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{s.name}</p>
                    <p className="font-mono text-[11px] text-faint">{s.id}</p>
                    <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_TONE[info.status])}>{STATUS_AR[info.status]}</span>
                  </div>
                  {can("students.manage") && (
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" onClick={() => { setDesignStudent(s); setDesignerOpen(true); }}><Palette className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => runExport(exportPng(db, s, themeOf(s), "front", lang))}><FileImage className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => runExport(exportSinglePdf(db, s, themeOf(s), lang))}><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => runExport(printCard(db, s, themeOf(s), lang))}><Printer className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <IdCardCustomizer open={designerOpen} onClose={() => { setDesignerOpen(false); setDesignStudent(null); }} previewStudent={designStudent} />
      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} />
      <BatchExportModal open={batchOpen} onClose={() => setBatchOpen(false)} students={selected.size ? filtered.filter((s) => selected.has(s.id)) : filtered} busy={busy} setBusy={setBusy} />
    </div>
  );
}

/* ============================== BATCH EXPORT MODAL ============================== */
function BatchExportModal({ open, onClose, students, busy, setBusy }: {
  open: boolean; onClose: () => void; students: Student[];
  busy: { i: number; n: number } | null; setBusy: (b: { i: number; n: number } | null) => void;
}) {
  const { db, lang } = useApp();
  const ar = lang === "ar";
  const [fmt, setFmt] = useState<BatchFmt>("pdf");
  if (!open) return null;

  const formats: { id: BatchFmt; label: string; icon: typeof FileText; desc: string }[] = [
    { id: "pdf", label: "PDF", icon: FileType, desc: ar ? "ورقة A4 — 10 كروت/صفحة + علامات قص" : "A4 sheet, 10/page + crop marks" },
    { id: "png", label: "ZIP · PNG", icon: FileArchive, desc: ar ? "كل طالب صورة 300 DPI" : "One image per student, 300 DPI" },
    { id: "jpeg", label: "ZIP · JPEG", icon: FileArchive, desc: ar ? "صور أصغر حجمًا" : "Smaller images" },
    { id: "svg", label: "SVG", icon: FileImage, desc: ar ? "متجه قابل للتحجيم" : "Scalable vector (front)" },
  ];

  const run = async () => {
    if (!students.length) return;
    setBusy({ i: 0, n: students.length });
    try {
      const tg = (s: Student) => resolveThemeForStudent(db, s);
      const prog = (i: number, n: number) => setBusy({ i, n });
      if (fmt === "pdf") await exportBatchPdf(db, students, tg, lang, prog);
      else if (fmt === "png") await exportBatchZip(db, students, tg, lang, "png", prog);
      else if (fmt === "jpeg") await exportBatchZip(db, students, tg, lang, "jpeg", prog);
      else for (let i = 0; i < students.length; i++) { prog(i + 1, students.length); await exportSvg(db, students[i], resolveThemeForStudent(db, students[i]), "front", lang); }
      pushToast(ar ? `تم تصدير ${students.length} كارت` : `Exported ${students.length} cards`);
      onClose();
    } catch { pushToast(ar ? "تعذّر التصدير" : "Export failed", "error"); }
    finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={ar ? "تصدير جماعي" : "Batch export"} size="md"
      footer={<><Button variant="secondary" onClick={onClose} disabled={!!busy}>{ar ? "إلغاء" : "Cancel"}</Button>
        <Button onClick={run} disabled={!!busy || !students.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{ar ? "تصدير" : "Export"}</Button></>}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-elevated/50 px-3 py-2 text-xs text-muted">
          <Users className="h-4 w-4 text-brand-500" />{ar ? "سيتم تصدير" : "Will export"} <b className="text-ink">{students.length}</b> {ar ? "كارت" : "cards"}
          {students.length >= 1000 && <span className="text-amber-600">· {ar ? "قد يستغرق وقتًا" : "may take a while"}</span>}
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-ink">{ar ? "صيغة التصدير" : "Format"}</p>
          <div className="grid grid-cols-2 gap-2">
            {formats.map((f) => (
              <button key={f.id} onClick={() => setFmt(f.id)} disabled={!!busy}
                className={cn("rounded-xl border p-3 text-start transition", fmt === f.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15" : "border-line hover:bg-elevated")}>
                <f.icon className={cn("mb-1 h-5 w-5", fmt === f.id ? "text-brand-600" : "text-muted")} />
                <p className="text-xs font-bold text-ink">{f.label}</p>
                <p className="text-[10px] text-faint">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>
        {busy && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${busy.n ? (busy.i / busy.n) * 100 : 0}%` }} />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================== QR SCANNER ============================== */
function ScanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, lang, upsert } = useApp();
  const ar = lang === "ar";
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cooldown = useRef<Set<string>>(new Set());
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<{ name: string; ok: boolean; msg: string; time: string }[]>([]);

  const pushLog = (name: string, ok: boolean, msg: string) =>
    setLog((l) => [{ name, ok, msg, time: new Date().toLocaleTimeString("ar-EG") }, ...l].slice(0, 10));

  const handle = async (raw: string) => {
    const token = await verifyToken(raw);
    if (!token) { pushLog(raw, false, ar ? "رمز غير صالح" : "Invalid token"); return; }
    const student = db.students.find((s) => s.id === token.studentId || s.qrCode === raw);
    if (!student || !student.groupIds.length) { pushLog(token.studentId, false, ar ? "غير موجود" : "Not found"); return; }
    if (cooldown.current.has(student.id)) return;
    cooldown.current.add(student.id);
    setTimeout(() => cooldown.current.delete(student.id), 3500);
    const date = startOfDay(now());
    const existing = db.attendance.find((a) => a.studentId === student.id && a.date === date);
    const already = existing && (existing.status === "PRESENT" || existing.status === "LATE");
    if (!already) upsert("attendance", { id: existing?.id ?? `${student.id}_${date}_${student.groupIds[0]}`, studentId: student.id, groupId: student.groupIds[0], date, status: "PRESENT", lastUpdated: now() } as any);
    pushToast(already ? (ar ? "تم التسجيل مسبقًا" : "Already checked in") : (ar ? "تم تسجيل الحضور ✓" : "Attendance recorded ✓"), already ? "info" : "success");
    pushLog(student.name, true, already ? (ar ? "مسجّل مسبقًا" : "Already in") : (ar ? "تم التسجيل" : "Recorded"));
  };

  const loop = async () => {
    if (!active) return;
    const video = videoRef.current; const AnyWin = window as any;
    if (video && AnyWin.BarcodeDetector) { try { const codes = await new AnyWin.BarcodeDetector({ formats: ["qr_code"] }).detect(video); if (codes?.length) handle(String(codes[0].rawValue)); } catch { /* ignore */ } }
    rafRef.current = window.setTimeout(loop, 400) as unknown as number;
  };
  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream; setActive(true);
      setTimeout(async () => { if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } loop(); }, 100);
    } catch { setError(ar ? "تعذّر الوصول للكاميرا" : "No camera access"); }
  };
  const stop = () => { setActive(false); if (rafRef.current) clearTimeout(rafRef.current); streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  const simulate = () => {
    const date = startOfDay(now());
    const cand = db.students.filter((s) => s.groupIds.length && !db.attendance.some((a) => a.studentId === s.id && a.date === date && a.status === "PRESENT"));
    const pool = cand.length ? cand : db.students;
    if (pool.length) handle(pool[Math.floor(Math.random() * pool.length)].qrCode);
  };
  useEffect(() => () => stop(), []);
  const today = db.attendance.filter((a) => a.date === startOfDay(now()) && a.status === "PRESENT").length;

  return (
    <Modal open={open} onClose={() => { stop(); onClose(); }} title={ar ? "ماسح الحضور QR" : "QR Attendance Scanner"} size="lg"
      footer={<Button variant="secondary" onClick={() => { stop(); onClose(); }}>{ar ? "إغلاق" : "Close"}</Button>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs text-muted">{ar ? "وجّه الكاميرا نحو كارت الطالب لتسجيل الحضور ومنع التسجيل المزدوج." : "Point the camera at a student card to log attendance and prevent double check-in."}</p>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-black">
            {error ? <div className="flex h-full flex-col items-center justify-center gap-2 text-white/80"><CameraOff className="h-10 w-10" /><p className="text-xs">{error}</p></div> : (
              <>
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {active && <div className="pointer-events-none absolute inset-0"><div className="absolute inset-x-8 inset-y-6 rounded-xl border-2 border-dashed border-white/60" /><div className="absolute inset-x-8 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px] shadow-emerald-400/60" style={{ animation: "scanline 1.8s ease-in-out infinite" }} /></div>}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!active ? <Button onClick={start}><Camera className="h-4 w-4" />{ar ? "بدء المسح" : "Start scan"}</Button> : <Button variant="danger" onClick={stop}><CameraOff className="h-4 w-4" />{ar ? "إيقاف" : "Stop"}</Button>}
            <Button variant="secondary" onClick={simulate}><Sparkles className="h-4 w-4" />{ar ? "محاكاة" : "Simulate"}</Button>
          </div>
          <div className="flex items-center gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={ar ? "أو أدخل الكود يدويًا" : "Or enter code manually"} className="flex-1" />
            <Button size="sm" onClick={() => { if (manual.trim()) { handle(manual.trim()); setManual(""); } }}><CircleCheck className="h-4 w-4" />{ar ? "تسجيل" : "Log"}</Button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-elevated/40 px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{ar ? "حضور اليوم" : "Today"}</span>
            <Badge tone="success">{today}</Badge>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {log.length === 0 ? <p className="py-8 text-center text-xs text-muted">{ar ? "لا توجد عمليات بعد" : "No activity yet"}</p> :
              log.map((e, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line p-2.5">
                  {e.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{e.name}</p><p className={cn("text-[10px]", e.ok ? "text-emerald-600" : "text-rose-500")}>{e.msg}</p></div>
                  <span className="font-mono text-[10px] text-faint">{e.time}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes scanline{0%{top:18%}50%{top:78%}100%{top:18%}}`}</style>
    </Modal>
  );
}
