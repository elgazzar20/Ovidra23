import { useMemo, useState } from "react";
import { Plus, Trash2, CalendarDays, AlertTriangle, Lock, Unlock, DoorOpen, CalendarRange } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader, Button, Card, Select, Field, Modal, EmptyState, Badge, Tabs,
} from "../components/ui";
import { TimePicker } from "../components/TimePicker";
import { usePersistentView } from "../components/PersistentViewToggle";
import { ViewToggle } from "../components/ViewToggle";
import type { ScheduleEvent, DayOfWeek } from "../lib/types";
import { now } from "../lib/db";
import { formatTime12 } from "../lib/constants";
import { toMin, findConflict } from "../lib/schedule";
import { cn } from "../utils/cn";

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];
const DAY_KEY: Record<number, string> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun" };

export function Schedule() {
  const { t } = useApp();
  const [tab, setTab] = useState("week");
  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("schedule.title")} subtitle={t("schedule.subtitle")} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "week", label: t("schedule.weekView"), icon: <CalendarRange className="h-4 w-4" /> },
        { id: "rooms", label: t("schedule.roomsView"), icon: <DoorOpen className="h-4 w-4" /> },
      ]} />
      {tab === "week" ? <WeekView /> : <RoomsView />}
    </div>
  );
}

function WeekView() {
  const { db, t, lang, upsert, remove, can } = useApp();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ScheduleEvent>({
    id: "", groupId: db.groups[0]?.id ?? "", classroomId: db.classrooms[0]?.id ?? "",
    dayOfWeek: 1, startTime: "16:00", endTime: "17:30", locked: false, lastUpdated: now(),
  });

  const byDay = useMemo(() => {
    const map: Record<number, ScheduleEvent[]> = {};
    DAYS.forEach((d) => (map[d] = []));
    db.scheduleEvents.forEach((e) => map[e.dayOfWeek]?.push(e));
    Object.values(map).forEach((arr) => arr.sort((a, b) => toMin(a.startTime) - toMin(b.startTime)));
    return map;
  }, [db.scheduleEvents]);

  const openCreate = () => {
    setError("");
    setForm({ id: "", groupId: db.groups[0]?.id ?? "", classroomId: db.classrooms[0]?.id ?? "", dayOfWeek: 1, startTime: "16:00", endTime: "17:30", locked: false, lastUpdated: now() });
    setCreating(true);
  };

  const save = () => {
    setError("");
    if (toMin(form.endTime) <= toMin(form.startTime)) { setError(t("schedule.conflict")); return; }
    const conflict = findConflict(db, form);
    if (conflict) {
      setError(
        conflict.locked
          ? `🔒 ${t("schedule.conflict")} — ${conflict.withGroup ?? ""} (${conflict.withRoom ?? ""})`
          : `${t("schedule.conflict")} — ${conflict.withGroup ?? ""} (${conflict.withRoom ?? ""})`,
      );
      if (conflict.locked) return;
    }
    upsert("scheduleEvents", form);
    setCreating(false);
  };

  const toggleLock = (e: ScheduleEvent) => upsert("scheduleEvents", { ...e, locked: !e.locked, lastUpdated: now() });
  const set = <K extends keyof ScheduleEvent>(k: K, v: ScheduleEvent[K]) => setForm((f) => ({ ...f, [k]: v }));
  const { view, change: setView } = usePersistentView("schedule", "grid");

  // flat sorted list for the table/compact views
  const flat = useMemo(
    () => [...db.scheduleEvents].sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMin(a.startTime) - toMin(b.startTime)),
    [db.scheduleEvents],
  );

  const colorFor = (id: string) => {
    const palette = [
      "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-200",
      "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/30 dark:text-violet-200",
      "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-200",
      "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-200",
      "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-200",
      "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-200",
    ];
    const idx = db.groups.findIndex((g) => g.id === id);
    return palette[idx % palette.length];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {can("schedule.manage") ? <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("schedule.add")}</Button> : <span />}
        {db.scheduleEvents.length > 0 && <ViewToggle value={view} onChange={setView} />}
      </div>
      {db.scheduleEvents.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<CalendarDays className="h-6 w-6" />} title={t("schedule.empty")} /></Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-[11px] uppercase text-faint">
                <th className="px-4 py-2.5 text-start font-semibold">{t("schedule.day")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("schedule.group")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("schedule.classroom")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("classes.startTime")}</th>
                <th className="px-4 py-2.5 text-start font-semibold">{t("classes.endTime")}</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {flat.map((e) => {
                  const group = db.groups.find((g) => g.id === e.groupId);
                  const room = db.classrooms.find((c) => c.id === e.classroomId);
                  return (
                    <tr key={e.id} className="border-b border-line/60 last:border-0 hover:bg-elevated/40">
                      <td className="px-4 py-2.5 font-medium text-ink">{t(`schedule.days.${DAY_KEY[e.dayOfWeek]}`)}</td>
                      <td className="px-4 py-2.5 text-ink">{group?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted">{room?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-ink">{formatTime12(e.startTime, lang)}</td>
                      <td className="px-4 py-2.5 text-ink">{formatTime12(e.endTime, lang)}</td>
                      <td className="px-4 py-2.5 text-end">
                        {can("schedule.manage") && <Button variant="ghost" size="icon" onClick={() => remove("scheduleEvents", e.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : view === "compact" ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line/60">
            {flat.map((e) => {
              const group = db.groups.find((g) => g.id === e.groupId);
              const room = db.classrooms.find((c) => c.id === e.classroomId);
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/40">
                  <span className="w-16 shrink-0 font-bold text-brand-600">{t(`schedule.days.${DAY_KEY[e.dayOfWeek]}`)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{group?.name ?? "—"}</p>
                    <p className="truncate text-[10px] text-faint">{room?.name ?? "—"}</p>
                  </div>
                  <span className="text-xs text-muted">{formatTime12(e.startTime, lang)} – {formatTime12(e.endTime, lang)}</span>
                  {can("schedule.manage") && <Button variant="ghost" size="icon" onClick={() => remove("scheduleEvents", e.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[860px] grid-cols-7 gap-3">
            {DAYS.map((d) => (
              <div key={d} className="space-y-2">
                <div className="rounded-xl bg-gradient-to-br from-brand-500/10 to-accent-500/10 py-2 text-center text-xs font-bold text-ink ring-1 ring-brand-500/10">
                  {t(`schedule.days.${DAY_KEY[d]}`)}
                </div>
                {byDay[d].length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line py-6 text-center text-[10px] text-faint">—</div>
                ) : (
                  byDay[d].map((e) => {
                    const group = db.groups.find((g) => g.id === e.groupId);
                    const room = db.classrooms.find((c) => c.id === e.classroomId);
                    const conflict = findConflict(db, e, e.id);
                    return (
                      <div key={e.id} className={cn("group rounded-lg border p-2", colorFor(e.groupId))}>
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[11px] font-bold leading-tight">{group?.name ?? "—"}</p>
                          {can("schedule.manage") && (
                            <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                              <button onClick={() => toggleLock(e)} className="rounded p-0.5 hover:bg-black/5">
                                {e.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 opacity-60" />}
                              </button>
                              <button onClick={() => remove("scheduleEvents", e.id)} className="rounded p-0.5 hover:bg-black/5">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] opacity-80">{formatTime12(e.startTime, lang)} – {formatTime12(e.endTime, lang)}</p>
                        <p className="text-[10px] opacity-70">📍 {room?.name ?? "—"}</p>
                        <div className="mt-1 flex items-center gap-1">
                          {e.locked && <Badge tone="warning">🔒</Badge>}
                          {conflict && <Badge tone={conflict.locked ? "danger" : "warning"}><AlertTriangle className="h-2.5 w-2.5" /></Badge>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={t("schedule.add")}
        footer={<><Button variant="secondary" onClick={() => setCreating(false)}>{t("action.cancel")}</Button><Button onClick={save}>{t("action.save")}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("schedule.group")} className="sm:col-span-2">
            <Select value={form.groupId} onChange={(e) => set("groupId", e.target.value)}>
              {db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label={t("schedule.classroom")}>
            <Select value={form.classroomId} onChange={(e) => set("classroomId", e.target.value)}>
              {db.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label={t("schedule.day")}>
            <Select value={form.dayOfWeek} onChange={(e) => set("dayOfWeek", +e.target.value as DayOfWeek)}>
              {DAYS.map((d) => <option key={d} value={d}>{t(`schedule.days.${DAY_KEY[d]}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("classes.startTime")}>
            <TimePicker value={form.startTime} onChange={(v) => set("startTime", v)} />
          </Field>
          <Field label={t("classes.endTime")}>
            <TimePicker value={form.endTime} onChange={(v) => set("endTime", v)} />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <button type="button" onClick={() => set("locked", !form.locked)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium",
                form.locked ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300" : "border-line text-muted hover:bg-elevated")}>
              {form.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {form.locked ? (lang === "ar" ? "مقفل" : "Locked slot") : (lang === "ar" ? "قفل الميعاد" : "Lock this slot")}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
      </Modal>
    </div>
  );
}

function RoomsView() {
  const { db, t, lang } = useApp();
  const [roomFilter, setRoomFilter] = useState("");

  const rooms = db.classrooms.filter((r) => !roomFilter || r.id === roomFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="h-9 w-auto py-1.5 text-xs">
          <option value="">{t("classes.classrooms")} ({db.classrooms.length})</option>
          {db.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {rooms.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<DoorOpen className="h-6 w-6" />} title={t("classes.emptyRooms")} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rooms.map((room) => {
            const events = db.scheduleEvents
              .filter((e) => e.classroomId === room.id)
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMin(a.startTime) - toMin(b.startTime));
            return (
              <Card key={room.id} className="card-hover overflow-hidden">
                <div className="flex items-center gap-2 border-b border-line bg-elevated/40 px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15"><DoorOpen className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{room.name}</p>
                    <p className="text-[10px] text-faint">{room.capacity} · {events.length} {t("teachers.sessions")}</p>
                  </div>
                  <Badge tone={events.length > 0 ? "warning" : "success"}>{events.length > 0 ? t("schedule.booked") : t("schedule.free")}</Badge>
                </div>
                <div className="grid grid-cols-7 gap-px bg-line">
                  {DAYS.map((d) => {
                    const dayEvents = events.filter((e) => e.dayOfWeek === d).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
                    return (
                      <div key={d} className="min-h-[120px] bg-surface p-1">
                        <p className="mb-1 text-center text-[9px] font-bold text-faint">{t(`schedule.short.${DAY_KEY[d]}`)}</p>
                        <div className="space-y-1">
                          {dayEvents.map((e) => {
                            const group = db.groups.find((g) => g.id === e.groupId);
                            return (
                              <div key={e.id} className="rounded bg-brand-50 px-1 py-0.5 text-[9px] font-medium leading-tight text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" title={group?.name}>
                                <p className="truncate">{formatTime12(e.startTime, lang)}</p>
                                <p className="truncate opacity-70">{group?.name?.split(" ")[0]}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
