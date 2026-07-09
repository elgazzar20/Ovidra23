import { useMemo, useState } from "react";
import { MessageCircle, Send, FileText, UserRound } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PageHeader, Button, Card, Input, Textarea, Field, Badge, Avatar, pushToast } from "../components/ui";
import { Combobox } from "../components/ui";
import { generateStudentPdf } from "../lib/pdf";
import { cn } from "../utils/cn";

export function Messages() {
  const { db, t, user, staff, sendStaffMessage, lang } = useApp();
  const [text, setText] = useState("");
  const [reportStudentId, setReportStudentId] = useState("");
  const [reportNote, setReportNote] = useState("");

  if (!user) return null;
  // The owner uid: for a staff member it's their ownerId; for the owner it's themselves.
  const ownerUid = user.ownerId ?? user.uid;
  const owner = staff.find((s) => s.uid === ownerUid) ?? user;

  // conversation between this user and the owner
  const thread = useMemo(() => {
    return (user.messages ?? [])
      .filter((m) => m.fromUid === ownerUid || m.toUid === ownerUid)
      .slice();
  }, [user.messages, ownerUid]);

  const studentOptions = useMemo(
    () => db.students.map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` })),
    [db.students],
  );

  const send = () => {
    if (!text.trim()) return;
    sendStaffMessage(ownerUid, text);
    setText("");
    pushToast(t("toast.staffMsg"));
  };

  const sendReport = () => {
    const student = db.students.find((s) => s.id === reportStudentId);
    if (!student) return;
    generateStudentPdf(db, student, lang);
    const note = reportNote.trim()
      ? `${t("reports.student")}: ${student.name} (${student.id}) — ${reportNote.trim()}`
      : `${t("reports.student")}: ${student.name} (${student.id})`;
    sendStaffMessage(ownerUid, note);
    setReportNote("");
    pushToast(t("toast.reportOwner"));
  };

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title={t("messages.title")} subtitle={t("messages.toOwner")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* conversation */}
        <Card className="flex flex-col p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Avatar name={owner.displayName} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{owner.displayName}</p>
              <p className="text-[11px] text-muted">{t("messages.owner")}</p>
            </div>
            <Badge tone="success"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" />{t("status.online")}</Badge>
          </div>

          <div className="mb-3 max-h-[420px] space-y-2 overflow-y-auto rounded-xl bg-elevated/40 p-3">
            {thread.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <MessageCircle className="h-8 w-8 text-faint" />
                <p className="text-xs text-muted">{t("messages.empty")}</p>
              </div>
            ) : thread.map((m) => {
              const mine = m.fromUid === user.uid;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-xs", mine ? "bg-brand-600 text-white" : "border border-line bg-surface text-ink")}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p className={cn("mt-1 text-[9px]", mine ? "text-white/70" : "text-faint")}>{new Date(m.at).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t("messages.placeholder")} />
            <Button onClick={send} disabled={!text.trim()}><Send className="h-4 w-4 rtl:rotate-180" /></Button>
          </div>
        </Card>

        {/* send student report */}
        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15"><FileText className="h-4 w-4" /></div>
            <div>
              <h3 className="text-sm font-semibold text-ink">{t("messages.sendReport")}</h3>
              <p className="text-[11px] text-muted">{t("messages.reportHint")}</p>
            </div>
          </div>
          <Field label={t("students.title")}>
            <Combobox value={reportStudentId} onChange={setReportStudentId} options={studentOptions}
              placeholder={t("messages.selectStudent")} allowCustom={false}
              searchLabel={t("fin.searchStudent")} emptyLabel={t("fin.noResults")} />
          </Field>
          <Field label={t("messages.note")}>
            <Textarea rows={4} value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder={t("messages.note")} className="mt-2" />
          </Field>
          <Button className="mt-3 w-full" onClick={sendReport} disabled={!reportStudentId}>
            <Send className="h-4 w-4 rtl:rotate-180" />{t("messages.sendReport")}
          </Button>

          <div className="mt-4 rounded-xl bg-sky-50 p-3 text-[11px] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            <UserRound className="me-1 inline h-3 w-3" />
            {t("messages.reportHint")}
          </div>
        </Card>
      </div>
    </div>
  );
}
