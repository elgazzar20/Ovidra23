import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  ScanLine,
  Camera,
  CameraOff,
  CheckCircle2,
  CircleAlert,
  Search,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader,
  Button,
  Card,
  Select,
  Input,
  Field,
  Tabs,
  Badge,
  EmptyState,
} from "../components/ui";
import { Donut } from "../components/charts";
import type { AttendanceRecord, AttendanceStatus } from "../lib/types";
import { startOfDay, now } from "../lib/db";
import { cn } from "../utils/cn";
import { verifyToken } from "../lib/attendance/crypto";

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "EXCUSED", "LATE"];
const STATUS_TONE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-500 text-white",
  ABSENT: "bg-rose-500 text-white",
  EXCUSED: "bg-sky-500 text-white",
  LATE: "bg-amber-500 text-white",
};

export function Attendance() {
  const { db, lang, canUseFeature } = useAppHook();
  const [tab, setTab] = useState("sheet");
  const qrEnabled = canUseFeature("qr_scanner");
  const isEnded = db.profile.academicYearEnded;
  const isAr = lang === "ar";

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t0("att.title")} subtitle={t0("att.subtitle")} />

      {isEnded && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-xs font-semibold text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleAlert className="h-4 w-4 shrink-0 text-rose-500 animate-pulse" />
          <span>
            {isAr
              ? "العام الدراسي منتهي: تم إيقاف تسجيل وحساب الحضور والغياب للطلاب مؤقتًا. يمكنك تفعيل العام الدراسي أو إدارته من صفحة الإعدادات."
              : "Academic Year Ended: Attendance tracking and calculations are suspended. You can reactivate or manage this via Settings."}
          </span>
        </div>
      )}

      {qrEnabled && (
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "sheet", label: t0("att.mode.sheet"), icon: <ClipboardCheck className="h-4 w-4" /> },
            { id: "scan", label: t0("att.mode.scan"), icon: <ScanLine className="h-4 w-4" /> },
          ]}
        />
      )}
      {tab === "sheet" || !qrEnabled ? <Sheet /> : <Scanner />}
    </div>
  );
}

// small hook to read t without prop-drilling
import { useApp as useAppHook } from "../context/AppContext";
function t0(key: string) {
  return useAppHook().t(key);
}

function recordId(studentId: string, date: number, groupId: string) {
  return `${studentId}_${date}_${groupId}`;
}

function Sheet() {
  const { db, t, upsert } = useApp();
  const isEnded = db.profile.academicYearEnded;
  const [groupId, setGroupId] = useState(db.groups[0]?.id ?? "");
  const [date, setDate] = useState(startOfDay(now()));
  const [search, setSearch] = useState("");
  const groupStudents = db.students.filter((s) => s.groupIds.includes(groupId));
  const shown = search.trim()
    ? groupStudents.filter((s) => s.name.toLowerCase().includes(search.toLowerCase().trim()) || s.id.toLowerCase().includes(search.toLowerCase().trim()))
    : groupStudents;

  const todays = useMemo(
    () => db.attendance.filter((a) => a.groupId === groupId && a.date === date),
    [db.attendance, groupId, date],
  );

  const get = (sid: string): AttendanceRecord | undefined =>
    todays.find((a) => a.studentId === sid);

  const mark = (sid: string, status: AttendanceStatus) => {
    if (isEnded) return;
    const existing = get(sid);
    upsert("attendance", {
      id: existing?.id ?? recordId(sid, date, groupId),
      studentId: sid,
      groupId,
      date,
      status,
      tempDegree: existing?.tempDegree,
      notes: existing?.notes,
      lastUpdated: now(),
    });
  };

  const markAll = () => {
    if (isEnded) return;
    groupStudents.forEach((s) => mark(s.id, "PRESENT"));
  };

  const present = todays.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const rate = groupStudents.length ? (present / groupStudents.length) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("att.group")} className="min-w-[200px]">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label={t("att.date")}>
          <Input
            type="date"
            value={new Date(date).toISOString().slice(0, 10)}
            onChange={(e) => setDate(startOfDay(new Date(e.target.value).getTime()))}
          />
        </Field>
        {groupStudents.length > 0 && (
          <Button variant="subtle" onClick={markAll} disabled={isEnded}>
            <CheckCircle2 className="h-4 w-4" />
            {t("action.markAll")}
          </Button>
        )}
      </div>
      {groupStudents.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
          <Input placeholder={t("action.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
        </div>
      )}

      {groupStudents.length === 0 ? (
        <Card className="p-6"><EmptyState title={t("att.summary")} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="space-y-2">
              {shown.length === 0 && <p className="py-6 text-center text-xs text-muted">{t("fin.noResults")}</p>}
              {shown.map((s) => {
                const rec = get(s.id);
                return (
                  <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-line p-2.5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white">
                        {s.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                        <p className="font-mono text-[10px] text-faint">{s.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-lg border border-line p-0.5">
                        {STATUSES.map((st) => (
                          <button
                            key={st}
                            onClick={() => mark(s.id, st)}
                            disabled={isEnded}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed",
                              rec?.status === st ? STATUS_TONE[st] : "text-muted hover:bg-elevated",
                            )}
                          >
                            {t(`att.${st.toLowerCase()}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">{t("att.summary")}</h3>
            <div className="flex flex-col items-center gap-3">
              <Donut value={rate} color="#10b981" label={`${Math.round(rate)}%`} sublabel={t("att.rate")} />
              <div className="grid w-full grid-cols-2 gap-2">
                {STATUSES.map((st) => (
                  <div key={st} className="rounded-lg bg-elevated/60 p-2 text-center">
                    <p className="text-base font-bold text-ink">{todays.filter((a) => a.status === st).length}</p>
                    <p className="text-[10px] text-muted">{t(`att.${st.toLowerCase()}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Scanner() {
  const { db, t, upsert } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cooldownRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState<{ name: string; ok: boolean; msg: string }[]>([]);
  const [supportsDetect, setSupportsDetect] = useState(true);

  const isEnded = db.profile.academicYearEnded;

  const pushLog = (name: string, ok: boolean, msg: string) =>
    setLog((l) => [{ name, ok, msg }, ...l].slice(0, 8));

  const handleValue = async (raw: string) => {
    if (isEnded) return;
    const token = await verifyToken(raw);
    if (!token) {
      pushLog(raw, false, t("att.notFound"));
      return;
    }
    const student = db.students.find((s) => s.id === token.studentId || s.qrCode === raw);
    if (!student || !student.groupIds.length) {
      pushLog(token.studentId, false, t("att.notFound"));
      return;
    }
    if (cooldownRef.current.has(student.id)) return;
    cooldownRef.current.add(student.id);
    setTimeout(() => cooldownRef.current.delete(student.id), 3500);

    const date = startOfDay(now());
    const existing = db.attendance.find(
      (a) => a.studentId === student.id && a.date === date,
    );
    const already = existing && (existing.status === "PRESENT" || existing.status === "LATE");
    upsert("attendance", {
      id: existing?.id ?? recordId(student.id, date, student.groupIds[0]),
      studentId: student.id,
      groupId: student.groupIds[0],
      date,
      status: "PRESENT",
      tempDegree: undefined,
      notes: undefined,
      lastUpdated: now(),
    });
    pushLog(student.name, true, already ? t("att.already") : t("att.scanned"));
  };

  const detectLoop = async () => {
    if (!active) return;
    const video = videoRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyWin = window as any;
    if (video && AnyWin.BarcodeDetector) {
      try {
        const detector = new AnyWin.BarcodeDetector({ formats: ["qr_code"] });
        const codes = await detector.detect(video);
        if (codes?.length) handleValue(String(codes[0].rawValue));
      } catch {
        /* ignore frame errors */
      }
    }
    rafRef.current = window.setTimeout(detectLoop, 400) as unknown as number;
  };

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AnyWin = window as any;
      if (!AnyWin.BarcodeDetector) setSupportsDetect(false);
      setActive(true);
      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        detectLoop();
      }, 100);
    } catch {
      setError(t("att.noCamera"));
      setSupportsDetect(false);
    }
  };

  const stop = () => {
    setActive(false);
    if (rafRef.current) clearTimeout(rafRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // simulate: pick a random student not yet present today
  const simulate = () => {
    const date = startOfDay(now());
    const candidates = db.students.filter(
      (s) => s.groupIds.length && !db.attendance.some((a) => a.studentId === s.id && a.date === date && a.status === "PRESENT"),
    );
    const pool = candidates.length ? candidates : db.students;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    handleValue(pick.qrCode);
  };

  useEffect(() => () => stop(), []);

  const scannedToday = useMemo(() => {
    const date = startOfDay(now());
    return db.attendance.filter((a) => a.date === date && a.status === "PRESENT").length;
  }, [db.attendance]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl bg-slate-950">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
              <CameraOff className="h-10 w-10" />
              <p className="text-xs">{t("att.scannerIdle")}</p>
            </div>
          )}
          {active && (
            <>
              <div className="absolute inset-0 ring-4 ring-inset ring-brand-500/40" />
              <div className="absolute left-1/2 top-1/2 h-1 w-3/4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-brand-400/70" />
              <Badge tone={supportsDetect ? "success" : "warning"} className="absolute start-3 top-3">
                {supportsDetect ? t("action.scanning") : t("action.simulate")}
              </Badge>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {!active ? (
            <Button onClick={start}><Camera className="h-4 w-4" />{t("action.startScan")}</Button>
          ) : (
            <Button variant="danger" onClick={stop}><CameraOff className="h-4 w-4" />{t("action.stopScan")}</Button>
          )}
          <Button variant="secondary" onClick={simulate}><Sparkles className="h-4 w-4" />{t("att.simulate")}</Button>
        </div>
        {error && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600">
            <CircleAlert className="h-4 w-4" />{error}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{t("att.present")}</h3>
          <Badge tone="success">{scannedToday}</Badge>
        </div>
        <div className="space-y-2">
          {log.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">{t("att.scannerIdle")}</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line p-2">
                {entry.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <CircleAlert className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{entry.name}</p>
                  <p className="text-[10px] text-faint">{entry.msg}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}


