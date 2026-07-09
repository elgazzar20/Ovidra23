import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine, Camera, CameraOff, Keyboard, Usb, Nfc,
  CheckCircle2, XCircle, Clock, User, BookOpen, Users2, Building2,
  ChevronRight, Loader2, Volume2, VolumeX, Settings as SettingsIcon, Activity,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card, Input, Modal, Field, Toggle, Badge, pushToast } from "../components/ui";
import { cn } from "../utils/cn";
import { FeatureLockOverlay } from "../components/FeatureLockOverlay";
import { hardware } from "../lib/attendance/hal";
import { sound } from "../lib/attendance/sound";
import { createAttendanceService } from "../lib/attendance/service";
import { loadAttendanceSettings, saveAttendanceSettings } from "../lib/attendance/settings";
import type { AttendanceSettings, CaptureOutcome, ScanEvent, InputSource } from "../lib/attendance/types";
import { startOfDay, now } from "../lib/db";
import { subjectLabel } from "../lib/constants";

type FlashState =
  | { kind: "idle" }
  | { kind: "processing" }
  | { kind: "success"; outcome: CaptureOutcome }
  | { kind: "error"; outcome: CaptureOutcome };

export function SmartAttendance() {
  const { db, lang, upsert, currentBranchId, user, canUseFeature } = useApp();
  const ar = lang === "ar";
  const centerId = user?.centerId ?? "demo";
  const isEnded = db.profile.academicYearEnded;

  const [settings, setSettings] = useState<AttendanceSettings>(() => loadAttendanceSettings(centerId));
  const [flash, setFlash] = useState<FlashState>({ kind: "idle" });
  const [history, setHistory] = useState<{ name: string; ok: boolean; at: number; reason?: string }[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  // build the service once (deps are stable callbacks)
  const service = useMemo(() => createAttendanceService({
    getDb: () => db,
    getCurrentBranchId: () => currentBranchId,
    upsertAttendance: (rec) => upsert("attendance", rec as any),
    settings,
    logCapture: (e) => { /* could persist to an audit log collection */ void e; },
  }), [db, currentBranchId, upsert, settings]);

  // keep sound engine in sync
  useEffect(() => { sound.setEnabled(settings.soundEnabled); }, [settings.soundEnabled]);

  // detect serial support
  useEffect(() => {
    setSerialSupported(typeof (navigator as any).serial !== "undefined");
  }, []);

  const triggerFlash = useCallback((state: FlashState) => {
    setFlash(state);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    // success/error auto-clear after 3.5s back to idle
    if (state.kind === "success" || state.kind === "error") {
      flashTimer.current = window.setTimeout(() => setFlash({ kind: "idle" }), 3500);
    }
  }, []);

  const handleResult = useCallback(async (payload: string, source: InputSource) => {
    if (isEnded) {
      pushToast(ar ? "العام الدراسي منتهي، لا يمكن تسجيل حضور" : "Academic year ended, cannot take attendance", "error");
      return;
    }
    sound.unlock();
    triggerFlash({ kind: "processing" });
    const outcome = await service.capture(payload, source);
    const name = outcome.ok ? outcome.record.studentName : "—";
    const reason = outcome.ok ? undefined : outcome.error.reason;
    setHistory((h) => [{ name, ok: outcome.ok, at: now(), reason }, ...h].slice(0, 20));
    if (outcome.ok) {
      triggerFlash({ kind: "success", outcome });
      if (settings.soundEnabled) {
        const shortName = outcome.record.studentName.split(" ").slice(0, 2).join(" ");
        const greetText = ar
          ? `تم تسجيل الحضور، أهلاً بك يا ${shortName}`
          : `Checked in, welcome ${shortName}`;
        sound.speak(greetText, ar ? "ar" : "en");
      }
    } else {
      triggerFlash({ kind: "error", outcome });
      if (settings.soundEnabled) {
        const errText = ar
          ? `تنبيه، ${outcome.error.message}`
          : `Warning, ${outcome.error.message}`;
        sound.speak(errText, ar ? "ar" : "en");
      }
    }
  }, [service, db.students, triggerFlash, isEnded, ar, settings.soundEnabled]);

  // start the hardware wedge listener
  useEffect(() => {
    void hardware.start();
    hardware.setWedgeEnabled(true);
    const off = hardware.onScan((evt: ScanEvent) => { void handleResult(evt.payload, evt.source); });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleResult]);

  // ----------------------------- camera -----------------------------
  const detectLoop = useCallback(async () => {
    const video = videoRef.current;
    const AnyWin = window as any;
    if (video && AnyWin.BarcodeDetector) {
      try {
        const detector = new AnyWin.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });
        const codes = await detector.detect(video);
        if (codes?.length) {
          const val = String(codes[0].rawValue);
          handleResult(val, "camera");
          // brief cooldown to avoid duplicate camera scans
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch { /* ignore frame */ }
    }
    if (cameraOn) rafRef.current = window.setTimeout(detectLoop, 400) as unknown as number;
  }, [cameraOn, handleResult]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(async () => {
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        detectLoop();
      }, 100);
    } catch {
      pushToast(ar ? "تعذّر الوصول للكاميرا" : "Camera unavailable", "error");
    }
  }, [detectLoop, ar]);

  const stopCamera = useCallback(() => {
    setCameraOn(false);
    if (rafRef.current) clearTimeout(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const connectSerial = useCallback(async () => {
    const ok = await hardware.startSerial();
    if (ok) pushToast(ar ? "تم توصيل قارئ Serial" : "Serial scanner connected");
    else pushToast(ar ? "تعذّر التوصيل" : "Connection failed", "error");
  }, [ar]);

  // ----------------------------- stats -----------------------------
  const todayStats = useMemo(() => {
    const day = startOfDay(now());
    const recs = db.attendance.filter((a) => a.date === day);
    return {
      present: recs.filter((a) => a.status === "PRESENT" || a.status === "LATE").length,
      late: recs.filter((a) => a.status === "LATE").length,
    };
  }, [db.attendance]);

  // ----------------------------- render -----------------------------
  const flashColor =
    flash.kind === "success" ? "from-emerald-500 to-green-600" :
    flash.kind === "error" ? "from-rose-500 to-red-600" :
    flash.kind === "processing" ? "from-brand-500 to-violet-600" :
    "from-navy-700 to-navy-900";

  const isLocked = !canUseFeature("smart_attendance");

  return (
    <div className="relative min-h-[500px]">
      <div className={cn("mx-auto max-w-5xl space-y-4", isLocked && "pointer-events-none opacity-40 select-none")}>
        {/* ---------- academic year ended banner ---------- */}
        {isEnded && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-xs font-semibold text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <Activity className="h-4 w-4 shrink-0 text-rose-500 animate-pulse" />
            <span>
              {ar
                ? "العام الدراسي منتهي: تم إيقاف نظام تسجيل وحساب الحضور والغياب للطلاب مؤقتًا. يمكنك تفعيل العام الدراسي أو إدارته من صفحة الإعدادات."
                : "Academic Year Ended: Attendance tracking and calculations are suspended. You can reactivate or manage this via Settings."}
            </span>
          </div>
        )}

        {/* ---------- header ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink">
              <ScanLine className="h-6 w-6 text-brand-600" />
              {ar ? "الحضور الذكي" : "Smart Attendance"}
            </h1>
            <p className="text-xs text-muted">{ar ? "امسح البطاقة — يتم التسجيل تلقائيًا في أقل من ثانية" : "Scan a card — auto check-in under 1 second"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />{ar ? "حاضر اليوم" : "Today"}: {todayStats.present}</Badge>
            <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}><SettingsIcon className="h-4 w-4" />{ar ? "إعدادات" : "Settings"}</Button>
          </div>
        </div>

        {/* ---------- device status bar ---------- */}
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <DeviceChip on icon={Keyboard} label={ar ? "قارئ USB/بلوتوث" : "USB/BT Scanner"} sub={ar ? "جاهز تلقائيًا" : "Auto-ready"} tone="success" />
          <DeviceChip on={cameraOn} icon={Camera} label={ar ? "كاميرا" : "Camera"} sub={cameraOn ? (ar ? "تعمل" : "Live") : (ar ? "مغلقة" : "Off")} tone={cameraOn ? "success" : "muted"} />
          {serialSupported && <DeviceChip on={false} icon={Usb} label={ar ? "Serial" : "Serial"} sub={ar ? "اختياري" : "Optional"} tone="muted" onClick={connectSerial} />}
          <DeviceChip on={false} icon={Nfc} label="NFC" sub={ar ? "قريب" : "Coming"} tone="muted" />
          <div className="ms-auto flex items-center gap-2">
            <Button size="sm" variant={cameraOn ? "danger" : "primary"} onClick={cameraOn ? stopCamera : startCamera}>
              {cameraOn ? <><CameraOff className="h-4 w-4" />{ar ? "إيقاف الكاميرا" : "Stop Camera"}</> : <><Camera className="h-4 w-4" />{ar ? "تشغيل الكاميرا" : "Start Camera"}</>}
            </Button>
            <button onClick={() => { const v = !settings.soundEnabled; setSettings((s) => ({ ...s, soundEnabled: v })); }} className="rounded-lg border border-line p-2 text-muted hover:bg-elevated">
              {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </Card>

        {/* ---------- main grid ---------- */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* ===== capture flash panel ===== */}
          <div className={cn("relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white transition-all duration-300", flashColor)}>
            {/* idle state */}
            {flash.kind === "idle" && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                    <ScanLine className="h-12 w-12" />
                  </div>
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
                </div>
                <div>
                  <p className="text-lg font-bold">{ar ? "في انتظار المسح…" : "Waiting for scan…"}</p>
                  <p className="text-sm text-white/70">{ar ? "وجّه القارئ نحو بطاقة الطالب أو استخدم الكاميرا" : "Point the scanner at a student card or use the camera"}</p>
                </div>
                {/* manual entry */}
                <div className="mt-2 flex w-full max-w-sm items-center gap-2">
                  <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={ar ? "أو اكتب الكود يدويًا" : "Or type the code"} className="border-white/20 bg-white/10 text-white placeholder:text-white/50" onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { handleResult(manual.trim(), "manual"); setManual(""); } }} />
                  <Button variant="secondary" onClick={() => { if (manual.trim()) { handleResult(manual.trim(), "manual"); setManual(""); } }}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
                </div>
              </div>
            )}

            {/* processing */}
            {flash.kind === "processing" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-16 w-16 animate-spin" />
                <p className="text-lg font-bold">{ar ? "جارٍ التحقق…" : "Verifying…"}</p>
              </div>
            )}

            {/* success */}
            {flash.kind === "success" && flash.outcome.ok && (
              <SuccessPanel outcome={flash.outcome} ar={ar} />
            )}

            {/* error */}
            {flash.kind === "error" && !flash.outcome.ok && (
              <ErrorPanel outcome={flash.outcome} ar={ar} />
            )}
          </div>

          {/* ===== side: camera + history ===== */}
          <div className="space-y-4">
            {/* camera preview */}
            <Card className="overflow-hidden p-0">
              <div className="relative aspect-[4/3] bg-black">
                <video ref={videoRef} className={cn("h-full w-full object-cover", !cameraOn && "hidden")} playsInline muted />
                {!cameraOn && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-white/50">
                    <CameraOff className="h-8 w-8" />
                    <p className="text-xs">{ar ? "الكاميرا متوقفة" : "Camera off"}</p>
                  </div>
                )}
                {cameraOn && (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-x-8 inset-y-6 rounded-xl border-2 border-dashed border-white/60" />
                    <div className="absolute inset-x-8 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px] shadow-emerald-400/60" style={{ animation: "scanline 1.8s ease-in-out infinite" }} />
                  </div>
                )}
              </div>
            </Card>

            {/* recent activity */}
            <Card className="p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink"><Activity className="h-4 w-4 text-brand-600" />{ar ? "آخر العمليات" : "Recent activity"}</h3>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {history.length === 0 ? <p className="py-4 text-center text-[11px] text-faint">{ar ? "لا توجد عمليات بعد" : "No activity yet"}</p> :
                  history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                      {h.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{h.name}</span>
                      <span className="font-mono text-[10px] text-faint">{new Date(h.at).toLocaleTimeString(ar ? "ar-EG" : "en-US")}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>

        <style>{`@keyframes scanline{0%{top:12%}50%{top:80%}100%{top:12%}}`}</style>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={(s) => { setSettings(s); saveAttendanceSettings(centerId, s); }} />
      </div>

      {isLocked && (
        <FeatureLockOverlay
          title={ar ? "تحضير الحضور الذكي مغلق" : "Smart Attendance is Locked"}
          description={ar 
            ? "تحضير الطلاب الذكي باستخدام كاميرا الويب، رموز الـ QR، الباركود، وقارئ الأجهزة يتطلب الباقة المؤسسية (Enterprise). طوّر اشتراكك لتتمكن من استخدام ميزة الحضور الذكي." 
            : "Smart student attendance utilizing webcams, QR codes, barcodes, and hardware devices requires the Enterprise Plan. Upgrade your subscription to unlock the smart attendance feature."}
          requiredPlan="enterprise"
        />
      )}
      <style>{`@keyframes scanline{0%{top:12%}50%{top:80%}100%{top:12%}}`}</style>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={(s) => { setSettings(s); saveAttendanceSettings(centerId, s); }} />
    </div>
  );
}

/* ============================== success panel ============================== */
function SuccessPanel({ outcome, ar }: { outcome: CaptureOutcome; ar: boolean }) {
  if (!outcome.ok) return null;
  const r = outcome.record;
  const initials = r.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
        <CheckCircle2 className="h-4 w-4" />{r.alreadyCheckedIn ? (ar ? "تم التسجيل مسبقًا" : "Already checked in") : (ar ? "تم تسجيل الحضور" : "Checked in")}
      </div>
      {/* avatar */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-extrabold text-emerald-600 shadow-lg">
        {initials}
      </div>
      <div>
        <p className="text-2xl font-extrabold">{r.studentName}</p>
        <p className="font-mono text-sm text-white/70">{r.studentId}</p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-start">
        <Info icon={BookOpen} label={ar ? "المادة" : "Subject"} value={subjectLabel(r.subject, ar ? "ar" : "en")} />
        <Info icon={Users2} label={ar ? "المجموعة" : "Group"} value={r.groupName} />
        <Info icon={User} label={ar ? "المدرس" : "Teacher"} value={r.teacherName} />
        <Info icon={Building2} label={ar ? "الفصل" : "Room"} value={r.classroom} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{new Date(r.arrivedAt).toLocaleTimeString(ar ? "ar-EG" : "en-US")}</span>
        {r.status === "LATE" && <span className="rounded-full bg-amber-400/30 px-2 py-0.5 font-bold text-amber-100">{ar ? "متأخر" : "Late"}</span>}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/60" />
      <div className="min-w-0">
        <p className="text-[9px] text-white/60">{label}</p>
        <p className="truncate text-xs font-bold">{value}</p>
      </div>
    </div>
  );
}

/* ============================== error panel ============================== */
function ErrorPanel({ outcome, ar }: { outcome: CaptureOutcome; ar: boolean }) {
  if (outcome.ok) return null;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
        <XCircle className="h-12 w-12" />
      </div>
      <p className="text-xl font-extrabold">{ar ? "تعذّر التسجيل" : "Check-in failed"}</p>
      <p className="max-w-xs text-sm text-white/80">{outcome.error.message}</p>
      <p className="font-mono text-[10px] text-white/40">{outcome.error.reason}</p>
    </div>
  );
}

/* ============================== device chip ============================== */
function DeviceChip({ on, icon: Icon, label, sub, tone, onClick }: {
  on: boolean; icon: typeof Usb; label: string; sub: string; tone: "success" | "muted"; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start transition", on ? "border-emerald-300/50 bg-emerald-50 dark:bg-emerald-500/10" : "border-line", onClick && "cursor-pointer hover:bg-elevated")}>
      <span className={cn("relative flex h-2 w-2", on && "live-dot-wrap")}>
        <span className={cn("h-2 w-2 rounded-full", tone === "success" ? "bg-emerald-500" : "bg-faint")} />
        {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
      </span>
      <Icon className={cn("h-4 w-4", on ? "text-emerald-500" : "text-muted")} />
      <div>
        <p className="text-[11px] font-bold text-ink">{label}</p>
        <p className="text-[9px] text-faint">{sub}</p>
      </div>
    </button>
  );
}

/* ============================== settings modal ============================== */
function SettingsModal({ open, onClose, settings, onChange }: {
  open: boolean; onClose: () => void; settings: AttendanceSettings; onChange: (s: AttendanceSettings) => void;
}) {
  const [s, setS] = useState(settings);
  useEffect(() => { if (open) setS(settings); }, [open, settings]);
  const set = <K extends keyof AttendanceSettings>(k: K, v: AttendanceSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title="إعدادات الحضور الذكي" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={() => { onChange(s); onClose(); }}>حفظ</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="سماح مبكر (دقيقة)"><Input type="number" value={s.earlyGraceMin} onChange={(e) => set("earlyGraceMin", +e.target.value)} /></Field>
          <Field label="حد التأخير (دقيقة)"><Input type="number" value={s.lateThresholdMin} onChange={(e) => set("lateThresholdMin", +e.target.value)} /></Field>
          <Field label="قطع متأخر (دقيقة)"><Input type="number" value={s.lateCutoffMin} onChange={(e) => set("lateCutoffMin", +e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-lg border border-line p-2.5"><span className="text-xs font-medium text-ink">منع الحضور لغير المسددين</span><Toggle checked={s.blockUnpaid} onChange={(v) => set("blockUnpaid", v)} /></label>
          <label className="flex items-center justify-between rounded-lg border border-line p-2.5"><span className="text-xs font-medium text-ink">تفعيل الأصوات</span><Toggle checked={s.soundEnabled} onChange={(v) => set("soundEnabled", v)} /></label>
          <label className="flex items-center justify-between rounded-lg border border-line p-2.5"><span className="text-xs font-medium text-ink">عزل الفروع</span><Toggle checked={s.enforceBranch} onChange={(v) => set("enforceBranch", v)} /></label>
        </div>
      </div>
    </Modal>
  );
}
