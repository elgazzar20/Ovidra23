import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  LifeBuoy, Search, Clock, X, Send,
  User, Paperclip, ArrowLeft, Download, Lock
} from "lucide-react";
import {
  fetchSupportTickets,
  addTicketMessage,
  updateTicketMetadata,
  type SupportTicket,
  type TicketAttachment
} from "../../lib/superadmin";
import { cn } from "../../utils/cn";
import { pushToast } from "../../components/ui";

export function TicketsTab({
  admin
}: {
  admin: { uid: string; email: string };
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Selected ticket for details view
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<TicketAttachment[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Assignment & metadata updating states
  const [assignedInput, setAssignedInput] = useState("");
  const [updatingMetadata, setUpdatingMetadata] = useState(false);

  const loadAllTickets = async () => {
    setLoading(true);
    try {
      const data = await fetchSupportTickets();
      setTickets(data);
      if (selectedTicket) {
        const fresh = data.find(t => t.id === selectedTicket.id);
        if (fresh) {
          setSelectedTicket(fresh);
          setAssignedInput(fresh.assignedTo || "");
        }
      }
    } catch (e) {
      console.error("[TicketsTab] Failed to fetch tickets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTickets();
  }, []);

  // Handle drag and drop file uploads
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("الحد الأقصى لحجم الملف هو 2 ميجابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const attachment: TicketAttachment = {
        name: file.name,
        base64: reader.result as string
      };
      setReplyAttachments(prev => [...prev, attachment]);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Submit reply / internal note
  const handleSendReply = async () => {
    if (!selectedTicket || !replyBody.trim()) return;

    setReplyLoading(true);
    try {
      const replyPayload = {
        senderId: admin.uid,
        senderEmail: admin.email,
        senderRole: "admin" as const,
        senderName: "مشرف المنصة (الدعم الفني)",
        body: replyBody.trim(),
        isInternalNote,
        attachments: replyAttachments.length > 0 ? replyAttachments : undefined
      };

      // Auto set status to in_progress if sending a response, unless it's a private internal note or we manually set closed
      const nextStatus = isInternalNote 
        ? selectedTicket.status 
        : selectedTicket.status === "open" ? "in_progress" : selectedTicket.status;

      await addTicketMessage(selectedTicket.id, replyPayload, nextStatus);

      setReplyBody("");
      setReplyAttachments([]);
      setIsInternalNote(false);
      
      pushToast(
        isInternalNote ? "تم تسجيل الملاحظة الداخلية بنجاح." : "تم إرسال الرد وتحديث حالة التذكرة بنجاح.",
        "success"
      );
      loadAllTickets();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setReplyLoading(false);
    }
  };

  // Update Ticket Assignment
  const handleAssignTicket = async () => {
    if (!selectedTicket) return;
    setUpdatingMetadata(true);
    try {
      await updateTicketMetadata(
        selectedTicket.id,
        { assignedTo: assignedInput.trim() || undefined },
        { uid: admin.uid, email: admin.email, name: "مشرف المنصة" }
      );
      pushToast(
        assignedInput.trim() ? `تم تعيين التذكرة إلى: ${assignedInput}` : "تم إلغاء تعيين التذكرة بنجاح.",
        "success"
      );
      loadAllTickets();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUpdatingMetadata(false);
    }
  };

  // Update Status or Priority directly
  const handleUpdateMeta = async (patch: Partial<Omit<SupportTicket, "id" | "messages" | "activityLog">>) => {
    if (!selectedTicket) return;
    setUpdatingMetadata(true);
    try {
      await updateTicketMetadata(
        selectedTicket.id,
        patch,
        { uid: admin.uid, email: admin.email, name: "مشرف المنصة" }
      );
      pushToast("تم حفظ التعديلات وإدراجها في سجل النشاط بنجاح.", "success");
      loadAllTickets();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUpdatingMetadata(false);
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter(t => {
    const searchString = `${t.title} ${t.id} ${t.centerName} ${t.creatorEmail} ${t.description}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" ? true : t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            مفتوحة
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            قيد المعالجة
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            تم الحل
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-500/10 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            مغلقة
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            🔴 طارئ
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
            🟠 مرتفع
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            🟡 متوسط
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-500/15 dark:text-slate-300">
            🟢 منخفض
          </span>
        );
      default:
        return null;
    }
  };

  const downloadAttachment = (att: TicketAttachment) => {
    if (!att.base64) return;
    const link = document.createElement("a");
    link.href = att.base64;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Detail View */}
      {selectedTicket ? (
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <button
              onClick={() => { setSelectedTicket(null); loadAllTickets(); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              العودة لكافة التذاكر العامة
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleUpdateMeta({ status: "resolved" })}
                disabled={updatingMetadata}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 cursor-pointer"
              >
                تحديد كـ "تم الحل"
              </button>
              <button
                onClick={() => handleUpdateMeta({ status: "closed" })}
                disabled={updatingMetadata}
                className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 cursor-pointer"
              >
                إغلاق التذكرة
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column: Discussion & Replies */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono text-faint">المعرف: #{selectedTicket.id}</span>
                    <h1 className="text-lg font-extrabold text-ink">{selectedTicket.title}</h1>
                    <p className="text-xs text-muted mt-1">
                      بواسطة: <span className="font-bold">{selectedTicket.creatorName}</span> ({selectedTicket.creatorEmail}) - سنتر: <span className="font-bold">{selectedTicket.centerName}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                </div>

                <div className="text-xs text-muted leading-relaxed bg-elevated/20 p-4 rounded-xl whitespace-pre-wrap border border-line/40 select-text">
                  {selectedTicket.description}
                </div>

                {/* Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted">المرفقات الأساسية المرفوعة:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.attachments.map((att, i) => (
                        <button
                          key={i}
                          onClick={() => downloadAttachment(att)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated/40 px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-elevated transition cursor-pointer"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-rose-500" />
                          <span className="truncate max-w-xs">{att.name}</span>
                          <Download className="h-3 w-3 text-faint" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat thread containing messages + internal notes */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">سجل المناقشات والتنبيهات المتبادلة</h3>
                <div className="space-y-4">
                  {selectedTicket.messages?.map((msg) => {
                    const isAdmin = msg.senderRole === "admin" || msg.senderRole === "staff";
                    const isNote = msg.isInternalNote;

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col gap-1.5 max-w-[85%] rounded-2xl p-4 shadow-xs border transition-all",
                          isNote
                            ? "border-amber-200 bg-amber-500/10 mx-auto w-full max-w-[90%]"
                            : isAdmin
                              ? "border-rose-200 bg-rose-500/5 ms-auto rounded-tl-none"
                              : "border-line bg-surface me-auto rounded-tr-none"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4 text-[10px] text-faint">
                          <span className="font-bold text-ink inline-flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {msg.senderName}
                            {isNote && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500 px-1.5 py-0.5 text-[8px] font-extrabold text-amber-950">
                                <Lock className="h-2 w-2" /> ملاحظة داخلية (للمشرفين فقط)
                              </span>
                            )}
                            {!isNote && isAdmin && (
                              <span className="rounded bg-rose-600/10 px-1 py-0.5 text-[8px] font-extrabold text-rose-700 dark:text-rose-300">
                                الدعم الفني للمنصة
                              </span>
                            )}
                          </span>
                          <span>{new Date(msg.createdAt).toLocaleString("ar-EG")}</span>
                        </div>

                        <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap select-text">{msg.body}</p>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/50 pt-2">
                            {msg.attachments.map((att, idx) => (
                              <button
                                key={idx}
                                onClick={() => downloadAttachment(att)}
                                className="inline-flex items-center gap-1 rounded bg-elevated/50 px-2 py-1 text-[10px] font-semibold text-ink hover:bg-elevated transition cursor-pointer"
                              >
                                <Paperclip className="h-3 w-3 text-rose-500" />
                                <span className="truncate max-w-xs">{att.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reply box with internal notes option */}
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">كتابة رد جديد</span>
                  
                  {/* Internal Note Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-muted hover:text-ink transition">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-line text-amber-500 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className={cn(isInternalNote && "text-amber-600 dark:text-amber-400 font-extrabold")}>
                      تسجيل كملاحظة داخلية للمشرفين (مخفية عن المستخدم)
                    </span>
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={
                    isInternalNote 
                      ? "اكتب هنا ملاحظاتك الخاصة للمشرفين، هذه الرسالة لن تظهر إطلاقاً لصاحب السنتر..." 
                      : "اكتب الرد الرسمي الذي سيصل فوراً لبريد وحساب صاحب السنتر..."
                  }
                  className="w-full rounded-xl border border-line bg-surface p-3 text-xs sm:text-sm text-ink focus:border-brand-400 focus:outline-none resize-none"
                />

                {/* Drag and drop for replies */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border border-dashed rounded-xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5",
                    isDragging ? "border-brand-500 bg-brand-500/5" : "border-line bg-elevated/10 hover:bg-elevated/30"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Paperclip className="h-5 w-5 text-muted" />
                  <p className="text-xs font-bold text-ink">اسحب وأفلت ملفاً هنا أو اضغط للاختيار</p>
                  <p className="text-[10px] text-faint">صورة، مستند أو لقطة شاشة بحد أقصى 2 ميجابايت</p>
                </div>

                {/* Attachments list */}
                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {replyAttachments.map((att, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 rounded bg-elevated px-2 py-1 text-[11px] font-semibold text-ink">
                        <Paperclip className="h-3.5 w-3.5 text-rose-500" />
                        <span className="max-w-xs truncate">{att.name}</span>
                        <button
                          onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="rounded-full p-0.5 text-rose-500 hover:bg-elevated transition cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={handleSendReply}
                    disabled={replyLoading || !replyBody.trim()}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-lg transition disabled:opacity-50 active:scale-95 cursor-pointer",
                      isInternalNote 
                        ? "bg-amber-600 hover:bg-amber-700" 
                        : "bg-brand-600 hover:bg-brand-700"
                    )}
                  >
                    {replyLoading ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {isInternalNote ? "حفظ الملاحظة الخاصة" : "إرسال الرد الرسمي"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Metadata update, Assign agent & Activity logs */}
            <div className="space-y-4">
              {/* Controls panel */}
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">التحكم الفني بالتذكرة</h3>
                
                {/* Status selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted">حالة التذكرة</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleUpdateMeta({ status: e.target.value as any })}
                    disabled={updatingMetadata}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                  >
                    <option value="open">مفتوحة (Open)</option>
                    <option value="in_progress">قيد المراجعة والمعالجة (In Progress)</option>
                    <option value="resolved">تم الحل (Resolved)</option>
                    <option value="closed">مغلقة (Closed)</option>
                  </select>
                </div>

                {/* Priority selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted">مستوى الأهمية</label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => handleUpdateMeta({ priority: e.target.value as any })}
                    disabled={updatingMetadata}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                  >
                    <option value="urgent">🔴 طارئ (Urgent)</option>
                    <option value="high">🟠 مرتفع (High)</option>
                    <option value="medium">🟡 متوسط (Medium)</option>
                    <option value="low">🟢 منخفض (Low)</option>
                  </select>
                </div>

                {/* Assign to support staff */}
                <div className="space-y-1.5 border-t border-line/60 pt-3">
                  <label className="text-xs font-bold text-muted">إسناد التذكرة لمشرف</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={assignedInput}
                      onChange={(e) => setAssignedInput(e.target.value)}
                      placeholder="بريد أو اسم المشرف"
                      className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
                    />
                    <button
                      onClick={handleAssignTicket}
                      disabled={updatingMetadata}
                      className="rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-2 text-xs font-bold transition hover:opacity-90 cursor-pointer"
                    >
                      تعيين
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">سجل الأنشطة وتتبع العمليات</h3>
                <div className="relative border-r-2 border-line/60 me-1 space-y-4 pt-2">
                  {selectedTicket.activityLog?.map((log) => (
                    <div key={log.id} className="relative pe-4 text-xs">
                      {/* Bullet icon */}
                      <span className="absolute -start-1.5 top-0.5 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-surface" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-ink leading-tight">{log.details}</p>
                        <div className="flex items-center justify-between text-[9px] text-faint">
                          <span>{log.userEmail}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Global Overview Board */
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-black text-ink">إدارة تذاكر الدعم الفني العام</h1>
              <p className="text-xs text-muted">مراقبة وحل مشاكل واستفسارات السناتر والمستخدمين المسجلين على المنصة بالكامل.</p>
            </div>
          </div>

          {/* KPI statistics cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "إجمالي المشكلات المرفوعة", value: tickets.length, tone: "border-line" },
              { label: "في انتظار الرد / مفتوحة", value: tickets.filter(t => t.status === "open").length, tone: "border-blue-200 text-blue-600" },
              { label: "قيد المتابعة حالياً", value: tickets.filter(t => t.status === "in_progress").length, tone: "border-amber-200 text-amber-600" },
              { label: "تم حلها وإغلاقها", value: tickets.filter(t => t.status === "closed" || t.status === "resolved").length, tone: "border-emerald-200 text-emerald-600" }
            ].map((st, i) => (
              <div key={i} className={cn("rounded-2xl border bg-surface p-4 shadow-xs", st.tone)}>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{st.label}</p>
                <p className="mt-1 text-xl font-extrabold">{st.value}</p>
              </div>
            ))}
          </div>

          {/* Filters area */}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-faint" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم السنتر، بريد العضو، عنوان المشكلة، المعرف..."
                className="h-10 w-full rounded-xl border border-line bg-surface pr-9 pl-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-40">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value="all">كافة الحالات</option>
                <option value="open">مفتوحة</option>
                <option value="in_progress">قيد المعالجة</option>
                <option value="resolved">تم الحل</option>
                <option value="closed">مغلقة</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="w-full sm:w-40">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value="all">كافة مستويات الأهمية</option>
                <option value="urgent">طارئ 🚨</option>
                <option value="high">مرتفع 🔥</option>
                <option value="medium">متوسط ⚡</option>
                <option value="low">منخفض 💤</option>
              </select>
            </div>
          </div>

          {/* Tickets List */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface py-16 text-center text-muted">
                <LifeBuoy className="mx-auto h-10 w-10 text-faint opacity-50 mb-2" />
                <p className="text-sm">لا توجد أي تذاكر مطابقة لمعايير البحث في المنصة حالياً.</p>
              </div>
            ) : (
              filteredTickets.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTicket(t)}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-sm hover:bg-elevated/30 transition cursor-pointer flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-faint">#{t.id}</span>
                      <span className="rounded bg-rose-600/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                        سنتر: {t.centerName}
                      </span>
                      {getStatusBadge(t.status)}
                      {getPriorityBadge(t.priority)}
                    </div>

                    <h3 className="font-bold text-ink text-sm sm:text-base truncate">{t.title}</h3>
                    <p className="text-xs text-muted truncate max-w-2xl">{t.description}</p>
                    
                    <div className="flex items-center gap-3 text-[10px] text-faint">
                      <span>المرسل: {t.creatorName} ({t.creatorEmail})</span>
                      {t.assignedTo && (
                        <span className="font-bold text-rose-600 dark:text-rose-300">
                          👤 المسؤول المعين: {t.assignedTo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row items-center justify-between border-t border-line/40 pt-3 sm:border-0 sm:pt-0 sm:flex-col sm:items-end gap-1 shrink-0">
                    <span className="text-[10px] text-faint flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      تعديل: {new Date(t.updatedAt).toLocaleDateString("ar-EG")}
                    </span>

                    <span className="text-[11px] font-semibold text-brand-600">
                      {t.messages?.length || 1} رسائل نقاش
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
