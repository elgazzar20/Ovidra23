import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy, Plus, Search, Clock, AlertCircle, X, Send,
  CheckCircle2, User, Paperclip, ArrowLeft, AlertTriangle, Download
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  fetchSupportTickets,
  createSupportTicket,
  addTicketMessage,
  updateTicketMetadata,
  type SupportTicket,
  type TicketAttachment
} from "../lib/superadmin";
import { cn } from "../utils/cn";
import { pushToast } from "../components/ui";

export function Tickets() {
  const { lang, user, db } = useApp();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Detail View State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<TicketAttachment[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);

  // New Ticket Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newAttachments, setNewAttachments] = useState<TicketAttachment[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const centerId = user?.centerId || "demo-center-futureminds";
  const centerName = db?.profile?.name || "مركز تعليمي";

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await fetchSupportTickets(centerId);
      setTickets(data);
      // If we are currently viewing a ticket, refresh its contents as well
      if (selectedTicket) {
        const fresh = data.find(t => t.id === selectedTicket.id);
        if (fresh) setSelectedTicket(fresh);
      }
    } catch (e) {
      console.error("[Tickets] Failed to load tickets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [centerId]);

  // Handle Drag & Drop File Uploads
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File, target: "create" | "reply") => {
    if (file.size > 2 * 1024 * 1024) {
      alert(lang === "ar" ? "الحد الأقصى لحجم الملف هو 2 ميجابايت." : "Maximum file size is 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const attachment: TicketAttachment = {
        name: file.name,
        base64: reader.result as string
      };
      if (target === "create") {
        setNewAttachments(prev => [...prev, attachment]);
      } else {
        setReplyAttachments(prev => [...prev, attachment]);
      }
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

  const handleDrop = (e: React.DragEvent, target: "create" | "reply") => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], target);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: "create" | "reply") => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], target);
    }
  };

  // Submit New Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newTitle.trim() || !newDesc.trim()) {
      setFormError(lang === "ar" ? "يرجى كتابة عنوان التذكرة وتفاصيل المشكلة." : "Please fill in the ticket title and description.");
      return;
    }

    setCreateLoading(true);
    try {
      const ticketPayload = {
        centerId,
        centerName,
        creatorUid: user?.uid || "demo-uid",
        creatorEmail: user?.email || "demo@example.com",
        creatorName: user?.displayName || "مالك السنتر",
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        status: "open" as const,
        attachments: newAttachments.length > 0 ? newAttachments : undefined
      };

      await createSupportTicket(ticketPayload, newDesc.trim(), newAttachments);
      
      pushToast(
        lang === "ar" ? "تم فتح تذكرة الدعم بنجاح. سيتواصل معك فريق الدعم قريباً." : "Support Ticket Opened Successfully. Our support team will contact you shortly.",
        "success"
      );

      setIsCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      setNewAttachments([]);
      loadTickets();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Submit Reply to Selected Ticket
  const handleSendReply = async () => {
    if (!selectedTicket || !replyBody.trim()) return;

    setReplyLoading(true);
    try {
      const replyPayload = {
        senderId: user?.uid || "demo-uid",
        senderEmail: user?.email || "demo@example.com",
        senderRole: "user" as const,
        senderName: user?.displayName || "مالك السنتر",
        body: replyBody.trim(),
        attachments: replyAttachments.length > 0 ? replyAttachments : undefined
      };

      // Auto-reopen ticket if it was resolved or closed
      const nextStatus = selectedTicket.status === "closed" || selectedTicket.status === "resolved" 
        ? "open" 
        : selectedTicket.status;

      await addTicketMessage(selectedTicket.id, replyPayload, nextStatus);

      setReplyBody("");
      setReplyAttachments([]);
      pushToast(
        lang === "ar" ? "تم إرسال الرد بنجاح وتحديث حالة التذكرة." : "Your comment was added and ticket updated successfully.",
        "success"
      );
      loadTickets();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setReplyLoading(false);
    }
  };

  // Close Ticket Directly
  const handleCloseTicket = async (ticketId: string) => {
    if (!window.confirm(lang === "ar" ? "هل أنت متأكد من رغبتك في إغلاق هذه التذكرة؟" : "Are you sure you want to close this ticket?")) return;

    try {
      await updateTicketMetadata(
        ticketId, 
        { status: "closed" }, 
        { 
          uid: user?.uid || "demo-uid", 
          email: user?.email || "demo@example.com", 
          name: user?.displayName || "مالك السنتر" 
        }
      );
      pushToast(
        lang === "ar" ? "تم إغلاق التذكرة وتحديث حالتها بنجاح." : "Ticket was closed successfully.",
        "success"
      );
      loadTickets();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Filtered Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
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
            {lang === "ar" ? "مفتوحة" : "Open"}
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {lang === "ar" ? "قيد المعالجة" : "In Progress"}
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {lang === "ar" ? "تم الحل" : "Resolved"}
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-500/10 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {lang === "ar" ? "مغلقة" : "Closed"}
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
            🔴 {lang === "ar" ? "طارئ" : "Urgent"}
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
            🟠 {lang === "ar" ? "مرتفع" : "High"}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            🟡 {lang === "ar" ? "متوسط" : "Medium"}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-500/15 dark:text-slate-300">
            🟢 {lang === "ar" ? "منخفض" : "Low"}
          </span>
        );
      default:
        return null;
    }
  };

  // Download Base64 File
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
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4">
      {/* Detail view of a selected ticket */}
      {selectedTicket ? (
        <motion.div
          initial={{ opacity: 0, x: lang === "ar" ? 30 : -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Header row with back button */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <button
              onClick={() => { setSelectedTicket(null); loadTickets(); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition cursor-pointer"
            >
              <ArrowLeft className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
              {lang === "ar" ? "العودة لجميع البطاقات" : "Back to all tickets"}
            </button>

            <div className="flex gap-2">
              {selectedTicket.status !== "closed" && (
                <button
                  onClick={() => handleCloseTicket(selectedTicket.id)}
                  className="rounded-xl border border-rose-200 bg-rose-50/10 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 cursor-pointer"
                >
                  {lang === "ar" ? "إغلاق التذكرة" : "Close Ticket"}
                </button>
              )}
            </div>
          </div>

          {/* Ticket Information Panel */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Col: Main thread & Chat replies */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono text-faint">ID: #{selectedTicket.id}</span>
                    <h1 className="text-lg font-extrabold text-ink">{selectedTicket.title}</h1>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                </div>

                <div className="text-xs text-muted leading-relaxed bg-elevated/20 p-4 rounded-xl whitespace-pre-wrap border border-line/40 select-text">
                  {selectedTicket.description}
                </div>

                {/* Primary Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted">{lang === "ar" ? "المرفقات الأساسية:" : "Primary Attachments:"}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.attachments.map((att, i) => (
                        <button
                          key={i}
                          onClick={() => downloadAttachment(att)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated/40 px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-elevated transition cursor-pointer"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-brand-500" />
                          <span className="truncate max-w-xs">{att.name}</span>
                          <Download className="h-3 w-3 text-faint" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Thread */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                  {lang === "ar" ? "سجل المناقشات والردود" : "Discussion Thread"}
                </h3>

                <div className="space-y-4">
                  {/* Messages from Firestore - filter out isInternalNote! */}
                  {selectedTicket.messages?.filter(m => !m.isInternalNote).map((msg) => {
                    const isAdmin = msg.senderRole === "admin" || msg.senderRole === "staff";
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col gap-1.5 max-w-[85%] rounded-2xl p-4 shadow-xs",
                          isAdmin
                            ? cn(
                                "border border-brand-200/60 bg-brand-500/5",
                                lang === "ar" ? "me-auto rounded-tr-none" : "ms-auto rounded-tl-none"
                              )
                            : cn(
                                "border border-line bg-surface",
                                lang === "ar" ? "ms-auto rounded-tl-none" : "me-auto rounded-tr-none"
                              )
                        )}
                      >
                        <div className="flex items-center justify-between gap-4 text-[10px] text-faint">
                          <span className="font-bold text-ink inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {msg.senderName}
                            {isAdmin && (
                              <span className="rounded bg-rose-600/10 px-1 py-0.5 text-[8px] font-extrabold text-rose-700 dark:text-rose-300">
                                {lang === "ar" ? "الدعم الفني للمنصة" : "Platform Support"}
                              </span>
                            )}
                          </span>
                          <span>{new Date(msg.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                        </div>

                        <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap select-text">{msg.body}</p>

                        {/* Message attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/50 pt-2">
                            {msg.attachments.map((att, index) => (
                              <button
                                key={index}
                                onClick={() => downloadAttachment(att)}
                                className="inline-flex items-center gap-1 rounded bg-elevated/50 px-2 py-1 text-[10px] font-semibold text-ink hover:bg-elevated transition cursor-pointer"
                              >
                                <Paperclip className="h-3 w-3 text-brand-500" />
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

              {/* Reply Box */}
              {selectedTicket.status !== "closed" ? (
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3">
                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={lang === "ar" ? "اكتب ردك أو استفسارك هنا..." : "Type your reply or question here..."}
                    className="w-full rounded-xl border border-line bg-surface p-3 text-xs sm:text-sm text-ink focus:border-brand-400 focus:outline-none resize-none"
                  />

                  {/* Drag & Drop Upload Area for Replies */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, "reply")}
                    className={cn(
                      "border border-dashed rounded-xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5",
                      isDragging ? "border-brand-500 bg-brand-500/5" : "border-line bg-elevated/10 hover:bg-elevated/30"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileSelect(e, "reply")}
                      className="hidden"
                    />
                    <Paperclip className="h-5 w-5 text-muted" />
                    <p className="text-xs font-semibold text-ink">
                      {lang === "ar" ? "اسحب وأفلت ملفاً هنا أو اضغط للاختيار" : "Drag & drop a file here or click to choose"}
                    </p>
                    <p className="text-[10px] text-faint">{lang === "ar" ? "الحد الأقصى للمرفق: 2 ميجابايت" : "Max size: 2MB"}</p>
                  </div>

                  {/* List of pending attachments for reply */}
                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {replyAttachments.map((att, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 rounded bg-elevated px-2 py-1 text-[11px] font-semibold text-ink">
                          <Paperclip className="h-3.5 w-3.5 text-brand-500" />
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
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                      {replyLoading ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {lang === "ar" ? "إرسال الرد" : "Send Reply"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-line bg-elevated/40 p-4 text-center text-xs text-muted flex items-center justify-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  {lang === "ar"
                    ? "هذه التذكرة مغلقة حالياً. كتابة أي رد جديد ستقوم بإعادة فتح التذكرة تلقائياً للدراسة."
                    : "This ticket is currently closed. Writing a reply will automatically reopen it for review."}
                  <button
                    onClick={() => {
                      // Re-open empty reply form state
                      setSelectedTicket(prev => prev ? { ...prev, status: "open" } : null);
                    }}
                    className="text-brand-600 font-extrabold hover:underline"
                  >
                    {lang === "ar" ? "إعادة فتح الآن" : "Re-open now"}
                  </button>
                </div>
              )}
            </div>

            {/* Right Col: Ticket activity logs & Meta Info */}
            <div className="space-y-4">
              {/* Ticket Details summary card */}
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3.5">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">{lang === "ar" ? "معلومات البطاقة" : "Ticket Details"}</h3>
                <div className="divide-y divide-line text-xs">
                  <div className="flex py-2 justify-between">
                    <span className="text-muted">{lang === "ar" ? "الرقم التعريفي:" : "ID:"}</span>
                    <span className="font-mono text-ink">#{selectedTicket.id}</span>
                  </div>
                  <div className="flex py-2 justify-between">
                    <span className="text-muted">{lang === "ar" ? "تاريخ الفتح:" : "Opened Date:"}</span>
                    <span className="text-ink">{new Date(selectedTicket.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                  </div>
                  <div className="flex py-2 justify-between">
                    <span className="text-muted">{lang === "ar" ? "آخر تحديث:" : "Last Update:"}</span>
                    <span className="text-ink">{new Date(selectedTicket.updatedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                  </div>
                  <div className="flex py-2 justify-between">
                    <span className="text-muted">{lang === "ar" ? "السنتر:" : "Center:"}</span>
                    <span className="text-ink">{selectedTicket.centerName}</span>
                  </div>
                  <div className="flex py-2 justify-between">
                    <span className="text-muted">{lang === "ar" ? "المسؤول المعين:" : "Assigned Agent:"}</span>
                    <span className="text-ink font-bold text-rose-600 dark:text-rose-300">
                      {selectedTicket.assignedTo || (lang === "ar" ? "في انتظار التعيين" : "Unassigned")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Activity Log / History */}
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                  {lang === "ar" ? "سجل الأنشطة والمتابعة" : "Activity Log"}
                </h3>

                <div className="relative border-s-2 border-line/60 ms-1 space-y-4 pt-2">
                  {selectedTicket.activityLog?.map((log) => (
                    <div key={log.id} className="relative ps-4 text-xs">
                      {/* Bullet icon */}
                      <span className="absolute -start-1.5 top-0.5 flex h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-surface" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-ink leading-tight">{log.details}</p>
                        <div className="flex items-center justify-between text-[9px] text-faint">
                          <span>{log.userEmail}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
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
        /* Normal tickets overview list view */
        <div className="space-y-6">
          {/* Top banner summary */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-black text-ink">{lang === "ar" ? "مركز الدعم الفني وتذاكر الخدمة" : "Support Ticket Center"}</h1>
              <p className="text-xs text-muted">
                {lang === "ar"
                  ? "تواصل مع مهندسي ومطوري المنصة مباشرة، قم بفتح بطاقة جديدة وتابع الردود وحالة التذكرة."
                  : "Interact with developers and support directly, open a ticket and track resolutions in real-time."}
              </p>
            </div>

            <button
              onClick={() => { setIsCreateOpen(true); setFormError(""); }}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-brand-700 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {lang === "ar" ? "إنشاء تذكرة دعم جديدة" : "Open New Support Ticket"}
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: lang === "ar" ? "إجمالي التذاكر" : "All Tickets", value: tickets.length, color: "border-line" },
              { label: lang === "ar" ? "نشطة ومفتوحة" : "Active & Open", value: tickets.filter(t => t.status === "open").length, color: "border-blue-200 text-blue-600" },
              { label: lang === "ar" ? "قيد الدراسة" : "In Progress", value: tickets.filter(t => t.status === "in_progress").length, color: "border-amber-200 text-amber-600" },
              { label: lang === "ar" ? "مغلقة / تم الحل" : "Closed / Resolved", value: tickets.filter(t => t.status === "closed" || t.status === "resolved").length, color: "border-emerald-200 text-emerald-600" }
            ].map((st, i) => (
              <div key={i} className={cn("rounded-2xl border bg-surface p-4 shadow-xs", st.color)}>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{st.label}</p>
                <p className="mt-1 text-xl font-extrabold">{st.value}</p>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-faint" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={lang === "ar" ? "ابحث برقم التذكرة أو العنوان أو المحتوى..." : "Search by ticket ID, subject..."}
                className="h-10 w-full rounded-xl border border-line bg-surface pr-9 pl-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none"
              />
            </div>

            {/* Status Selector */}
            <div className="w-full sm:w-40">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value="all">{lang === "ar" ? "كافة الحالات" : "All Statuses"}</option>
                <option value="open">{lang === "ar" ? "مفتوحة" : "Open"}</option>
                <option value="in_progress">{lang === "ar" ? "قيد الدراسة" : "In Progress"}</option>
                <option value="resolved">{lang === "ar" ? "تم الحل" : "Resolved"}</option>
                <option value="closed">{lang === "ar" ? "مغلقة" : "Closed"}</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div className="w-full sm:w-40">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value="all">{lang === "ar" ? "كافة مستويات الأهمية" : "All Priorities"}</option>
                <option value="urgent">{lang === "ar" ? "طارئ" : "Urgent"}</option>
                <option value="high">{lang === "ar" ? "مرتفع" : "High"}</option>
                <option value="medium">{lang === "ar" ? "متوسط" : "Medium"}</option>
                <option value="low">{lang === "ar" ? "منخفض" : "Low"}</option>
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
                <p className="text-sm">
                  {lang === "ar" ? "لم يتم العثور على أي تذاكر دعم تطابق معايير البحث." : "No support tickets found matching your criteria."}
                </p>
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
                      <span className="font-mono text-[10px] text-faint">ID: #{t.id}</span>
                      {getStatusBadge(t.status)}
                      {getPriorityBadge(t.priority)}
                    </div>

                    <h3 className="font-bold text-ink text-sm sm:text-base truncate">{t.title}</h3>
                    <p className="text-xs text-muted truncate max-w-2xl">{t.description}</p>
                  </div>

                  {/* Right information block */}
                  <div className="flex flex-row items-center justify-between border-t border-line/40 pt-3 sm:border-0 sm:pt-0 sm:flex-col sm:items-end gap-1 shrink-0">
                    <span className="text-[10px] text-faint flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {lang === "ar" ? "آخر تحديث:" : "Last Update:"} {new Date(t.updatedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
                    </span>

                    <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                      {t.messages?.length || 1} {lang === "ar" ? "رسائل في النقاش" : "Messages"}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Creation Dialog Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-line bg-elevated/40 px-5 py-4">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="h-5 w-5 text-brand-600" />
                  <h3 className="font-bold text-ink text-sm sm:text-base">
                    {lang === "ar" ? "فتح تذكرة دعم فني جديدة" : "Open New Support Ticket"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto p-5 space-y-4 cp-scroll">
                {formError && (
                  <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {formError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">
                    {lang === "ar" ? "عنوان المشكلة / ملخص الاستفسار" : "Subject / Summary"}
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={lang === "ar" ? "مثال: مشكلة في حساب رواتب المعلمين لشهر يونيو" : "e.g. Error in calculating teacher salaries for June"}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none"
                    required
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">
                    {lang === "ar" ? "مستوى الأولوية أو الأهمية" : "Priority level"}
                  </label>
                  <div className="flex gap-2">
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewPriority(p)}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-bold transition border capitalize",
                          newPriority === p
                            ? p === "urgent"
                              ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-200"
                              : p === "high"
                                ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-200"
                                : p === "medium"
                                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-200"
                                  : "border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-200"
                            : "border-line bg-surface text-muted hover:bg-elevated/40"
                        )}
                      >
                        {p === "urgent" ? "🚨 طارئ" : p === "high" ? "🔥 مرتفع" : p === "medium" ? "⚡ متوسط" : "💤 منخفض"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details / description */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">
                    {lang === "ar" ? "تفاصيل المشكلة والخطوات المطلوبة" : "Description / Full details"}
                  </label>
                  <textarea
                    rows={5}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder={lang === "ar" ? "اكتب تفاصيل المشكلة هنا بوضوح وسنقوم بمراجعتها فوراً..." : "Please describe your issue or question in detail here..."}
                    className="w-full rounded-xl border border-line bg-surface p-3 text-xs sm:text-sm text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none resize-none"
                    required
                  />
                </div>

                {/* Attachment upload */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted">
                    {lang === "ar" ? "إرفاق مستند أو صورة (اختياري)" : "Attach Screenshot / Document (Optional)"}
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, "create")}
                    className={cn(
                      "border border-dashed rounded-xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5",
                      isDragging ? "border-brand-500 bg-brand-500/5" : "border-line bg-elevated/10 hover:bg-elevated/30"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      onChange={(e) => handleFileSelect(e, "create")}
                      className="hidden"
                    />
                    <Paperclip className="h-6 w-6 text-muted" />
                    <p className="text-xs font-bold text-ink">
                      {lang === "ar" ? "اسحب وأفلت الملف هنا أو اضغط للاختيار" : "Drag & drop a file here or click to choose"}
                    </p>
                    <p className="text-[10px] text-faint">{lang === "ar" ? "صورة، مستند أو ملف PDF بحد أقصى 2 ميجابايت" : "Images, docs, or PDFs up to 2MB"}</p>
                  </div>

                  {/* Upload list */}
                  {newAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {newAttachments.map((att, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 rounded bg-elevated px-2 py-1 text-[11px] font-semibold text-ink">
                          <Paperclip className="h-3.5 w-3.5 text-brand-500" />
                          <span className="max-w-xs truncate">{att.name}</span>
                          <button
                            type="button"
                            onClick={() => setNewAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="rounded-full p-0.5 text-rose-500 hover:bg-elevated transition cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer buttons inside form */}
                <div className="border-t border-line bg-elevated/40 -mx-5 -mb-5 px-5 py-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-muted hover:bg-elevated transition cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {createLoading ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {lang === "ar" ? "فتح تذكرة الدعم الآن" : "Submit Ticket"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
