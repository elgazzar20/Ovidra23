import { useState } from "react";
import { FeatureLockOverlay } from "../components/FeatureLockOverlay";
import {
  UserPlus, Plus, Check, KeyRound, Lock, Activity,
  Trash2, Power, ChevronLeft, Wallet, Send, Mail, CalendarDays, Coins, Gift
} from "lucide-react";
import { useApp, type Permission } from "../context/AppContext";
import type { Role, UserRbac } from "../lib/types";
import {
  PageHeader, Button, Card, Input, Select, Field, Badge, Modal, Avatar, pushToast,
} from "../components/ui";
import { cn } from "../utils/cn";

const PERM_GROUPS: { titleKey: string; perms: Permission[] }[] = [
  {
    titleKey: "perm.section.access",
    perms: [
      "students.manage", "teachers.manage", "classes.manage", "schedule.manage",
      "attendance.manage", "finance.manage", "exams.manage", "staff.manage",
      "settings.manage", "reports.view", "reports.send", "ai.use",
    ],
  },
  { titleKey: "perm.section.revenue", perms: ["revenue.teachers", "revenue.center"] },
  { titleKey: "perm.section.actions", perms: ["data.add", "data.delete"] },
];
const ROLE_TONE: Record<Role, "brand" | "violet" | "info" | "success" | "neutral" | "danger"> = {
  OWNER: "brand", ADMIN: "violet", SECRETARY: "info", TEACHER: "success", PARENT: "neutral", STUDENT: "neutral", super_admin: "danger",
};

export function Staff() {
  const { db, t, staff, staffActivity, inviteStaff, updateStaff, deleteStaff, sendStaffMessage, canUseFeature } = useApp();
  const isLocked = !canUseFeature("staff_management");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRbac | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);

  // invite / edit form
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iPass, setIPass] = useState("");
  const [iRole, setIRole] = useState<Role>("SECRETARY");
  const [iPerms, setIPerms] = useState<Permission[]>([]);
  const [iSalary, setISalary] = useState(0);
  const [iPosition, setIPosition] = useState("");
  const [err, setErr] = useState("");

  const openInvite = () => {
    setEditing(null);
    setIName(""); setIEmail(""); setIPass(""); setIRole("SECRETARY"); setIPerms([]); setISalary(0); setIPosition(""); setErr("");
    setOpen(true);
  };
  const openEdit = (u: UserRbac) => {
    setEditing(u);
    setIName(u.displayName); setIEmail(u.email); setIPass(""); setIRole(u.role); setIPerms(u.permissions as Permission[]);
    setISalary(u.salary ?? 0); setIPosition(u.title ?? ""); setErr("");
    setOpen(true);
  };
  const togglePerm = (p: Permission) =>
    setIPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const save = () => {
    setErr("");
    if (editing) {
      const patch: Partial<UserRbac> = { displayName: iName, role: iRole, permissions: iPerms, salary: iSalary, title: iPosition };
      if (iPass.trim()) patch.password = iPass;
      updateStaff(editing.uid, patch);
      pushToast(t("toast.updated"));
      setOpen(false);
      return;
    }
    const res = inviteStaff(iEmail, iName, iPass, iRole, iPerms, { salary: iSalary, title: iPosition });
    if (!res.ok) { setErr(t(`err.${res.error}`)); return; }
    pushToast(t("toast.accountCreated"));
    setOpen(false);
  };

  const stat = (uid: string) => staffActivity[uid];

  if (profileUid) {
    const u = staff.find((s) => s.uid === profileUid);
    if (u) return <StaffProfile user={u} stat={stat(u.uid)} onBack={() => setProfileUid(null)} onUpdate={updateStaff} onMessage={sendStaffMessage} db={db} t={t} />;
  }

  return (
    <div className="relative min-h-[400px]">
      <div className={cn("animate-fade-in space-y-5", isLocked && "pointer-events-none blur-sm select-none")}>
        <PageHeader title={t("staff.title")} subtitle={t("staff.subtitle")}
          actions={<Button onClick={openInvite} disabled={isLocked}><UserPlus className="h-4 w-4" />{t("settings.addStaff")}</Button>} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((u) => {
            const st = stat(u.uid);
            return (
              <Card key={u.uid} className="card-hover p-4">
                <button onClick={() => !isLocked && setProfileUid(u.uid)} className="flex w-full items-start gap-3 text-start">
                  <Avatar name={u.displayName} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-ink">{u.displayName}</p>
                      {!u.active && <Badge tone="danger"><Power className="h-3 w-3" />{t("staff.disabled")}</Badge>}
                    </div>
                    <p className="truncate text-[11px] text-muted">{u.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge tone={ROLE_TONE[u.role]}>{t(`role.${u.role}`)}</Badge>
                      {u.title && <span className="text-[10px] text-faint">· {u.title}</span>}
                    </div>
                  </div>
                </button>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                  <div className="rounded-lg bg-elevated/60 p-2">
                    <p className="flex items-center justify-center gap-1 text-sm font-bold text-brand-600"><Activity className="h-3.5 w-3.5" />{st?.count ?? 0}</p>
                    <p className="text-[10px] text-muted">{t("staff.recordsAdded")}</p>
                  </div>
                  <div className="rounded-lg bg-elevated/60 p-2">
                    <p className="text-sm font-bold text-ink">{st ? new Date(st.lastAt).toLocaleDateString() : "—"}</p>
                    <p className="text-[10px] text-muted">{t("staff.lastSeen")}</p>
                  </div>
                  <div className="rounded-lg bg-elevated/60 p-2">
                    <p className="text-sm font-bold text-emerald-600">{u.salary ? u.salary : "—"}</p>
                    <p className="text-[10px] text-muted">{t("staff.salary")}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setProfileUid(u.uid)}>{t("staff.viewProfile")}</Button>
                  {u.role !== "OWNER" && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><KeyRound className="h-3.5 w-3.5" />{t("action.edit")}</Button>
                      <Button variant="ghost" size="icon" onClick={() => { deleteStaff(u.uid); pushToast(t("toast.deleted")); }}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* create / edit modal */}
        <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("staff.edit") : t("settings.addStaff")} size="lg"
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button onClick={save}>{editing ? t("action.save") : t("action.create")}</Button></>}>
          <div className="space-y-3">
            <div className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              <Lock className="me-1 inline h-3 w-3" />{t("staff.loginInfo")}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("auth.name")}><Input value={iName} onChange={(e) => setIName(e.target.value)} /></Field>
              <Field label={t("settings.staffEmail")} required><Input type="email" value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="staff@center.com" disabled={!!editing} /></Field>
              <Field label={t("staff.position")}><Input value={iPosition} onChange={(e) => setIPosition(e.target.value)} /></Field>
              <Field label={t("staff.salary")} hint={t("staff.salaryHint")}><Input type="number" min={0} value={iSalary} onChange={(e) => setISalary(+e.target.value)} /></Field>
            </div>
            <Field label={editing ? `${t("staff.password")} (${t("misc.optional")})` : t("staff.setPassword")} required={!editing}>
              <Input type="text" value={iPass} onChange={(e) => setIPass(e.target.value)} placeholder="••••••" />
            </Field>
            <Field label={t("settings.staffRole")}>
              <Select value={iRole} onChange={(e) => setIRole(e.target.value as Role)}>
                {(["ADMIN", "SECRETARY", "TEACHER"] as Role[]).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
              </Select>
            </Field>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">{t("settings.permissions")}</p>
              <div className="space-y-3">
                {PERM_GROUPS.map((grp) => (
                  <div key={grp.titleKey} className="rounded-xl border border-line p-2.5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-faint">{t(grp.titleKey)}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {grp.perms.map((p) => (
                        <button key={p} onClick={() => togglePerm(p)}
                          className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition", iPerms.includes(p) ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                          <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded border", iPerms.includes(p) ? "border-brand-500 bg-brand-500 text-white" : "border-faint")}>
                            {iPerms.includes(p) && <Check className="h-2.5 w-2.5" />}
                          </span>
                          {t(`perm.${p}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {err && <p className="text-xs font-medium text-rose-600">{err}</p>}
          </div>
        </Modal>
      </div>
      {isLocked && (
        <FeatureLockOverlay 
          title="نظام إدارة الموظفين والصلاحيات مغلق" 
          description="قم بدعوة سكرتارية ومعلمين إلى السنتر وتحديد صلاحيات دقيقة لكل مستخدم لحماية بياناتك والتحكم في إدخال وحذف السجلات." 
          requiredPlan="enterprise"
        />
      )}
    </div>
  );
}

/* --------------------------- Staff profile page --------------------------- */
function getOpLabel(op: string, ar: boolean): string {
  const parts = op.split(":");
  const collection = parts[0];
  const action = parts[1];

  const colNamesAr: Record<string, string> = {
    students: "الطلاب",
    teachers: "المعلمين",
    groups: "المجموعات",
    classrooms: "القاعات",
    scheduleEvents: "جدول الحصص",
    attendance: "الحضور والغياب",
    payments: "عمليات الدفع",
    expenses: "المصروفات",
    exams: "الامتحانات",
    examGrades: "درجات الامتحانات",
    assignments: "الواجبات",
    studentNotes: "ملاحظات الطلاب",
    branches: "الفروع",
    cardThemes: "الكروت التعريفية"
  };

  const colNamesEn: Record<string, string> = {
    students: "Students",
    teachers: "Teachers",
    groups: "Groups",
    classrooms: "Classrooms",
    scheduleEvents: "Schedule",
    attendance: "Attendance",
    payments: "Payments",
    expenses: "Expenses",
    exams: "Exams",
    examGrades: "Exam Grades",
    assignments: "Homework",
    studentNotes: "Student Notes",
    branches: "Branches",
    cardThemes: "Card Themes"
  };

  const actionAr: Record<string, string> = {
    create: "إضافة",
    update: "تعديل",
    delete: "حذف"
  };

  const actionEn: Record<string, string> = {
    create: "Add",
    update: "Edit",
    delete: "Delete"
  };

  const colAr = colNamesAr[collection] || collection;
  const colEn = colNamesEn[collection] || collection;
  const actAr = actionAr[action] || action;
  const actEn = actionEn[action] || action;

  if (ar) {
    return `${actAr} في سجل ${colAr}`;
  }
  return `${actEn} in ${colEn}`;
}

function StaffProfile({
  user, stat, onBack, onUpdate, onMessage, db, t,
}: {
  user: UserRbac;
  stat: { count: number; lastAt: number; lastOp: string; log?: { op: string; label: string; at: number }[] } | undefined;
  onBack: () => void;
  onUpdate: (uid: string, patch: Partial<UserRbac>) => void;
  onMessage: (toUid: string, text: string) => void;
  db: import("../lib/types").DatabaseShape;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const { lang, upsert, remove } = useApp();
  const ar = lang === "ar";
  const [msg, setMsg] = useState("");
  const [bonusAmt, setBonusAmt] = useState<number>(0);
  const [bonusNotes, setBonusNotes] = useState("");
  const sym = db.profile.currency;
  const messages = (user.messages ?? []).slice();

  const send = () => {
    if (!msg.trim()) return;
    onMessage(user.uid, msg);
    setMsg("");
    pushToast(t("toast.staffMsg"));
  };

  const paySalary = () => {
    const salary = user.salary ?? 0;
    if (salary <= 0) {
      pushToast(ar ? "يرجى تحديد راتب الموظف أولاً" : "Please set the employee's salary first");
      return;
    }
    upsert("expenses", {
      id: "",
      title: ar ? `راتب الموظف: ${user.displayName}` : `Salary for: ${user.displayName}`,
      amount: salary,
      category: "Salaries",
      date: Date.now(),
      notes: ar ? "تسديد الراتب الأساسي" : "Base salary payment",
      lastUpdated: Date.now(),
      staffId: user.uid
    });
    pushToast(ar ? "تم تسجيل تسديد الراتب بنجاح" : "Salary payment recorded successfully");
  };

  const payBonus = () => {
    if (bonusAmt <= 0) {
      pushToast(ar ? "يرجى إدخال مبلغ الحافز" : "Please enter the bonus amount");
      return;
    }
    upsert("expenses", {
      id: "",
      title: ar ? `حافز للموظف: ${user.displayName}` : `Bonus for: ${user.displayName}`,
      amount: bonusAmt,
      category: "Salaries",
      date: Date.now(),
      notes: bonusNotes.trim() || (ar ? "صرف حافز تشجيعي" : "Incentive bonus"),
      lastUpdated: Date.now(),
      staffId: user.uid
    });
    setBonusAmt(0);
    setBonusNotes("");
    pushToast(ar ? "تم تسجيل الحافز بنجاح" : "Bonus recorded successfully");
  };

  const paymentHistory = (db.expenses || [])
    .filter((e) => e.category === "Salaries" && e.staffId === user.uid)
    .sort((a, b) => b.date - a.date);

  // work breakdown: records this staff member touched (syncLog has no per-user
  // history beyond the stat, so we summarize counts from the activity stat)
  const lastOpLabel = stat?.lastOp ? getOpLabel(stat.lastOp, ar) : t("staff.noActivity");

  return (
    <div className="animate-fade-in space-y-5">
      {/* header */}
      <Card className="mesh-brand relative overflow-hidden border-0 text-white shadow-[var(--shadow-brand)]">
        <div className="orb float-soft -right-8 -top-12 h-40 w-40 bg-white/12" />
        <div className="relative flex flex-wrap items-center gap-4 p-5">
          <Button variant="secondary" size="icon" onClick={onBack} className="relative border-0 bg-white/15 text-white hover:bg-white/25">
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <Avatar name={user.displayName} className="relative h-14 w-14 ring-2 ring-white/30" />
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{user.displayName}</h1>
              {!user.active && <span className="rounded-md bg-rose-500/30 px-2 py-0.5 text-[11px] font-semibold">{t("staff.disabled")}</span>}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80"><Mail className="h-3 w-3" />{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium backdrop-blur">{t(`role.${user.role}`)}</span>
              {user.title && <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] backdrop-blur">{user.title}</span>}
              <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[11px] backdrop-blur"><CalendarDays className="h-3 w-3" />{t("staff.joinedOn")}: {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* left: work summary + salary */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-ink">{t("staff.workSummary")}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-elevated/40 p-3 text-center">
                <Activity className="mx-auto mb-1 h-4 w-4 text-brand-600" />
                <p className="text-xl font-bold text-ink">{stat?.count ?? 0}</p>
                <p className="text-[10px] text-muted">{t("staff.recordsAdded")}</p>
              </div>
              <div className="rounded-xl border border-line bg-elevated/40 p-3 text-center">
                <Wallet className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
                <p className="text-xl font-bold text-emerald-600">{user.salary ?? 0}</p>
                <p className="text-[10px] text-muted">{sym} / {t("staff.salary")}</p>
              </div>
              <div className="rounded-xl border border-line bg-elevated/40 p-3 text-center">
                <CalendarDays className="mx-auto mb-1 h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-ink">{stat ? new Date(stat.lastAt).toLocaleDateString() : "—"}</p>
                <p className="text-[10px] text-muted">{t("staff.lastSeen")}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-line bg-elevated/40 p-3 sm:col-span-1">
                <p className="text-[10px] text-muted">{t("staff.lastSeen")}</p>
                <p className="mt-0.5 truncate text-xs font-medium text-ink">{lastOpLabel}</p>
              </div>
            </div>
          </Card>

          {/* detailed activity log */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-2.5 text-[15px] font-semibold tracking-tight text-ink">{ar ? "سجل الأنشطة الكامل" : t("staff.activity")}</div>
            <div className="max-h-80 overflow-y-auto">
              {(!stat?.log || stat.log.length === 0) ? (
                <p className="py-6 text-center text-xs text-muted">{t("staff.noActivity")}</p>
              ) : stat.log.map((it, i) => {
                const isAdd = it.op.includes("create");
                const isDel = it.op.includes("delete");
                return (
                  <div key={i} className="flex items-center gap-2.5 border-b border-line/50 px-5 py-2 text-xs last:border-0">
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", isAdd ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15" : isDel ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15" : "bg-sky-50 text-sky-600 dark:bg-sky-500/15")}>
                      {isAdd ? <Plus className="h-3.5 w-3.5" /> : isDel ? <Trash2 className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{it.label || ""}</p>
                      <p className="text-[10px] text-faint">{getOpLabel(it.op, ar)}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-faint">{new Date(it.at).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* conversation */}
          <Card className="flex flex-col p-5">
            <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-ink">{t("staff.conversation")}</h3>
            <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-elevated/40 p-3">
              {messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">{t("staff.noMessages")}</p>
              ) : messages.map((m) => {
                const mine = m.fromUid === user.uid ? false : true; // owner's messages shown right
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3 py-1.5 text-xs", mine ? "bg-brand-600 text-white" : "bg-surface border border-line text-ink")}>
                      <p>{m.text}</p>
                      <p className={cn("mt-0.5 text-[9px]", mine ? "text-white/70" : "text-faint")}>{new Date(m.at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t("staff.message")} />
              <Button onClick={send} disabled={!msg.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>

        {/* right: quick actions */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-ink">{t("action.details")}</h3>
            {user.role === "OWNER" ? (
              <p className="text-xs text-muted leading-relaxed">
                {ar 
                  ? "هذا هو الحساب الرئيسي لمالك السنتر. لا يمكن تعديل راتبه أو تعطيل حسابه من هنا." 
                  : "This is the primary Owner account. Its salary cannot be set, and it cannot be disabled."}
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">{t("staff.salary")}</p>
                  <Input type="number" min={0} defaultValue={user.salary ?? 0} onBlur={(e) => onUpdate(user.uid, { salary: +e.target.value })} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">{t("staff.position")}</p>
                  <Input defaultValue={user.title ?? ""} onBlur={(e) => onUpdate(user.uid, { title: e.target.value })} />
                </div>
                <Button variant={user.active ? "danger" : "primary"} className="w-full" onClick={() => onUpdate(user.uid, { active: !user.active })}>
                  <Power className="h-4 w-4" />{user.active ? t("staff.disabled") : t("staff.active")}
                </Button>
              </div>
            )}
          </Card>

          {user.role !== "OWNER" && (
            <Card className="p-5">
              <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-600" />
                <span>{ar ? "الرواتب والحوافز" : "Salaries & Bonuses"}</span>
              </h3>
              
              <div className="space-y-4">
                {/* Pay Salary button */}
                <div className="rounded-xl border border-line bg-elevated/40 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[11px] text-muted">{ar ? "الراتب المستحق" : "Due Salary"}</p>
                      <p className="text-base font-bold text-ink">{user.salary ?? 0} {sym}</p>
                    </div>
                    <Button size="sm" onClick={paySalary} disabled={!(user.salary && user.salary > 0)} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 flex items-center gap-1.5 py-1 px-3">
                      <Wallet className="h-4 w-4" />
                      <span>{ar ? "تسديد الراتب" : "Pay Salary"}</span>
                    </Button>
                  </div>
                </div>

                {/* Give Bonus Section */}
                <div className="rounded-xl border border-line p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-ink flex items-center gap-1">
                    <Gift className="h-4 w-4 text-brand-600" />
                    <span>{ar ? "صرف حافز / مكافأة" : "Give Bonus / Reward"}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[10px] text-muted">{ar ? "المبلغ" : "Amount"}</p>
                      <Input type="number" min={1} value={bonusAmt || ""} onChange={(e) => setBonusAmt(+e.target.value)} placeholder="0" className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted">{ar ? "السبب" : "Reason"}</p>
                      <Input value={bonusNotes} onChange={(e) => setBonusNotes(e.target.value)} placeholder={ar ? "أداء ممتاز" : "Excellent performance"} className="h-8 text-xs" />
                    </div>
                  </div>
                  <Button size="sm" onClick={payBonus} disabled={bonusAmt <= 0} className="w-full h-8 text-xs">
                    {ar ? "تسجيل الحافز" : "Record Bonus"}
                  </Button>
                </div>

                {/* History Log */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-ink">{ar ? "سجل دفع الرواتب والحوافز" : "Salary & Bonus Log"}</p>
                  {paymentHistory.length === 0 ? (
                    <p className="text-center text-[11px] text-muted py-3 bg-elevated/20 rounded-lg">{ar ? "لا توجد مدفوعات مسجلة بعد" : "No recorded payments yet"}</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {paymentHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-line bg-surface/50 p-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-ink">{item.title}</p>
                            <p className="text-[10px] text-muted">{new Date(item.date).toLocaleDateString()} {item.notes ? `· ${item.notes}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-rose-600">-{item.amount} {sym}</span>
                            <button onClick={() => remove("expenses", item.id)} className="text-rose-500 hover:text-rose-700 p-1" title={ar ? "حذف" : "Delete"}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
