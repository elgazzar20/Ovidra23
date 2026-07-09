import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, Bot, Loader2, FileText,
  Send, UserPlus, Plus, UserCheck, CreditCard,
  ClipboardCheck, HelpCircle, Check, X,
  ChevronRight, Landmark
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  PageHeader, Button, Card, Input,
} from "../components/ui";
import { FeatureLockOverlay } from "../components/FeatureLockOverlay";
import { generateStudentPdf } from "../lib/pdf";
import { generateInsight, geminiChat, DEFAULT_GEMINI_KEY } from "../lib/ai";
import { uid, now, nextTeacherCode, nextStudentCode } from "../lib/db";
import { cn } from "../utils/cn";

const isPositiveResponse = (text: string) => {
  const lower = text.toLowerCase().trim();
  return /تأكيد|تاكيد|نعم|أجل|اجل|حفظ|أوك|اوك|تم|تمام|موافق|حسنا|حسناً|موافقة|موافقه|موافق|confirm|yes|y|ok|okay|approve|sure/i.test(lower);
};

/* ─────────── types ─────────── */

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
}

type WizardStep =
  | null
  | { type: "add_student"; step: "name" | "grade" | "phone" | "confirm"; draft: Record<string, string> }
  | { type: "delete_student"; step: "search" | "confirm"; draft: Record<string, string> }
  | { type: "add_teacher"; step: "name" | "subject" | "pay_type" | "commission_rate" | "fixed_amount" | "confirm"; draft: Record<string, string> }
  | { type: "add_group"; step: "name" | "teacher" | "grade" | "subject" | "confirm"; draft: Record<string, string> }
  | { type: "record_payment"; step: "student_search" | "type" | "amount" | "confirm"; draft: Record<string, string> }
  | { type: "add_exam"; step: "group_select" | "name" | "max_grade" | "confirm"; draft: Record<string, string> }
  | { type: "add_homework"; step: "group_select" | "title" | "due_date" | "confirm"; draft: Record<string, string> }
  | { type: "record_attendance"; step: "group_select" | "student_search" | "status" | "confirm"; draft: Record<string, string> }
  | { type: "export_student"; step: "search" }
  | { type: "gemini_query"; step: "select_student" };

/* ─────────── helpers ─────────── */

function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink text-right" dir="rtl">
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        const isHeading = trimmed.startsWith("###") || trimmed.startsWith("####") || (trimmed.startsWith("**") && trimmed.endsWith("**")) || (trimmed.startsWith("**") && trimmed.endsWith("**:"));
        let cleanText = trimmed;
        if (cleanText.startsWith("###")) cleanText = cleanText.replace(/^###\s*/, "");
        if (cleanText.startsWith("####")) cleanText = cleanText.replace(/^####\s*/, "");

        const isBullet = trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ");
        const isNumbered = /^\d+\.\s+/.test(trimmed);

        let listContent = trimmed;
        if (isBullet) {
          listContent = trimmed.replace(/^[\*\-\•]\s+/, "");
        } else if (isNumbered) {
          listContent = trimmed.replace(/^\d+\.\s+/, "");
        }

        const formatInline = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              const inner = part.slice(2, -2);
              return (
                <strong key={j} className="font-extrabold text-brand-600 dark:text-brand-400 mx-0.5">
                  {inner}
                </strong>
              );
            }
            return <span key={j}>{part}</span>;
          });
        };

        if (isHeading) {
          let headingText = cleanText;
          if (headingText.startsWith("**") && headingText.endsWith("**")) headingText = headingText.slice(2, -2);
          if (headingText.startsWith("**") && headingText.endsWith("**:")) headingText = headingText.slice(2, -3) + ":";
          
          return (
            <h4 key={idx} className="text-sm font-black text-brand-600 dark:text-brand-400 mt-4 mb-2 border-r-4 border-brand-500 pr-2">
              {formatInline(headingText)}
            </h4>
          );
        }

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pr-4 my-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
              <div className="flex-1 text-ink">{formatInline(listContent)}</div>
            </div>
          );
        }

        if (isNumbered) {
          const match = trimmed.match(/^(\d+)\.\s+/);
          const num = match ? match[1] : "1";
          return (
            <div key={idx} className="flex items-start gap-2 pr-2 my-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-500/15 text-[10px] font-black text-brand-600 dark:text-brand-400 shrink-0">
                {num}
              </span>
              <div className="flex-1 text-ink">{formatInline(listContent)}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-ink">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/* ─────────── main component ─────────── */

export function AIAssistant() {
  const { db, t, upsert, remove, lang, canUseFeature, subscriptionPlan, staff, staffActivity } = useApp();
  const isLocked = !canUseFeature("ai_assistant");
  const isAr = lang === "ar";

  const welcomeMessage = isAr
    ? "مرحباً! أنا مساعدك الذكي الشامل لإدارة السنتر 🎓✨\n\nأنا مدرب على مساعدتك في تنفيذ أي إجراء أو الوصول لأي مكان داخل النظام. جرّب كتابة أو الضغط على أحد الأوامر التالية:\n\n" +
      "• **إضافة طالب جديد** — أرسل \"أضف طالب\"\n" +
      "• **تسجيل حضور غياب** — أرسل \"تسجيل حضور\"\n" +
      "• **تسجيل عملية دفع** — أرسل \"دفع مصاريف\"\n" +
      "• **إضافة معلم جديد** — أرسل \"أضف معلم\"\n" +
      "• **إضافة مجموعة** — أرسل \"أضف مجموعة\"\n" +
      "• **إضافة امتحان** — أرسل \"أضف امتحان\"\n" +
      "• **إضافة واجب** — أرسل \"أضف واجب\"\n" +
      "• **تحليل أداء طالب** — أرسل \"تحليل طالب\"\n" +
      "• **تصدير تقرير طالب** — أرسل \"تقرير طالب\"\n" +
      "• **عرض الإحصائيات** — أرسل \"إحصائيات\"\n\n" +
      "💡 **ميزة الذكاء الاصطناعي الفائق:** يمكنك التحدث معي بلغة عامية تماماً مثل: *'عايز افتح صفحة الحسابات'*، *'وريني جدول الحصص'*، أو *'ممكن تحلل أداء الطالب محمد؟'* وسأقوم بالتنقل وتطبيق الإجراء فوراً!"
    : "Hello! I'm your comprehensive smart assistant for center management 🎓✨\n\nI can execute actions and take you anywhere in the system. Try typing or clicking one of the actions:\n\n" +
      "• **Add Student** — type \"add student\"\n" +
      "• **Record Attendance** — type \"record attendance\"\n" +
      "• **Record Payment** — type \"record payment\"\n" +
      "• **Add Teacher** — type \"add teacher\"\n" +
      "• **Add Group** — type \"add group\"\n" +
      "• **Add Exam** — type \"add exam\"\n" +
      "• **Add Homework** — type \"add homework\"\n" +
      "• **Analyze Student** — type \"analyze student\"\n" +
      "• **Export Report** — type \"student report\"\n" +
      "• **Center Statistics** — type \"statistics\"\n\n" +
      "💡 **AI Command Center:** Talk to me naturally like: *'show me the finance page'*, *'add a new quiz'*, or *'evaluate Ahmed'* and I will instantly navigate or start the wizard!";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [wizard, setWizard] = useState<WizardStep>(null);
  const [loading, setLoading] = useState(false);
  const apiKey = db.profile.geminiApiKey || DEFAULT_GEMINI_KEY;
  const hasGemini = !!apiKey;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize messages with welcome if empty
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: welcomeMessage,
          ts: Date.now(),
        },
      ]);
    }
  }, [lang, messages.length, welcomeMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const push = useCallback((role: "user" | "assistant", text: string) => {
    setMessages((prev) => [...prev, { id: uid("msg"), role, text, ts: Date.now() }]);
  }, []);

  const navigateTo = (route: string) => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: route }));
  };

  /* ─── Start a Wizard ─── */
  const startWizard = (type: string) => {
    setWizard(null);
    switch (type) {
      case "add_student":
        setWizard({ type: "add_student", step: "name", draft: {} });
        push("assistant", isAr ? "حسناً! لنقم بإضافة طالب جديد 📝\nما هو اسم الطالب بالكامل؟" : "Alright! Let's add a new student 📝\nWhat is the student's full name?");
        break;
      case "delete_student":
        setWizard({ type: "delete_student", step: "search", draft: {} });
        push("assistant", isAr ? "أرسل اسم أو كود الطالب المراد حذفه 🔍" : "Send the student name or code to delete 🔍");
        break;
      case "add_teacher":
        setWizard({ type: "add_teacher", step: "name", draft: {} });
        push("assistant", isAr ? "ممتاز! لنقم بإضافة معلم جديد 👨‍🏫\nما هو اسم المعلم بالكامل؟" : "Excellent! Let's add a new teacher 👨‍🏫\nWhat is the teacher's full name?");
        break;
      case "add_group":
        setWizard({ type: "add_group", step: "name", draft: {} });
        push("assistant", isAr ? "رائع! لنقم بإنشاء مجموعة دراسية جديدة 👥\nما هو اسم المجموعة؟ (مثال: مجموعة السبت والأربعاء)" : "Great! Let's create a new study group 👥\nWhat is the name of the group? (e.g. Saturday & Wednesday Group)");
        break;
      case "record_payment":
        setWizard({ type: "record_payment", step: "student_search", draft: {} });
        push("assistant", isAr ? "جاري تسجيل دفعة مالية 💵\nأرسل اسم الطالب أو الكود الخاص به للبحث عنه:" : "Recording student payment 💵\nSend the student name or code to search:");
        break;
      case "add_exam":
        setWizard({ type: "add_exam", step: "group_select", draft: {} });
        const groupsList = db.groups.map(g => `• ${g.name} (كود: ${g.id})`).join("\n");
        push("assistant", isAr 
          ? `لنقم بإضافة امتحان جديد 📝\nأرسل اسم أو كود المجموعة المراد إضافة الامتحان لها من القائمة التالية:\n\n${groupsList || "لا توجد مجموعات بعد"}`
          : `Let's add a new exam 📝\nSend the group name or code from the list below to add the exam:\n\n${groupsList || "No groups available"}`
        );
        break;
      case "add_homework":
        setWizard({ type: "add_homework", step: "group_select", draft: {} });
        const groupsListHw = db.groups.map(g => `• ${g.name} (كود: ${g.id})`).join("\n");
        push("assistant", isAr 
          ? `لنقم بإضافة واجب جديد 📚\nأرسل اسم أو كود المجموعة المراد إضافة الواجب لها:\n\n${groupsListHw || "لا توجد مجموعات بعد"}`
          : `Let's add a new homework 📚\nSend the group name or code from the list below:\n\n${groupsListHw || "No groups available"}`
        );
        break;
      case "record_attendance":
        setWizard({ type: "record_attendance", step: "group_select", draft: {} });
        const groupsListAtt = db.groups.map(g => `• ${g.name} (كود: ${g.id})`).join("\n");
        push("assistant", isAr 
          ? `لنقم بتسجيل حضور طالب ⏰\nأرسل اسم أو كود المجموعة التي ينتمي إليها الطالب:\n\n${groupsListAtt || "لا توجد مجموعات بعد"}`
          : `Let's record student attendance ⏰\nSend the group name or code from the list below:\n\n${groupsListAtt || "No groups available"}`
        );
        break;
      case "export_student":
        setWizard({ type: "export_student", step: "search" });
        push("assistant", isAr ? "أرسل اسم أو كود الطالب لتصدير تقريره 📄" : "Send the student name or code to export their report 📄");
        break;
      case "gemini_query":
        setWizard({ type: "gemini_query", step: "select_student" });
        push("assistant", isAr ? "أرسل اسم أو كود الطالب لتحليل أدائه بالذكاء الاصطناعي 🤖" : "Send the student name or code for AI analysis 🤖");
        break;
      default:
        break;
    }
  };

  /* ─── intent parser ─── */
  const handleSend = async () => {
    if (loading) return;
    const raw = input.trim();
    if (!raw) return;
    push("user", raw);
    setInput("");
    const lower = raw.toLowerCase();

    // if wizard is active, route to wizard handler
    if (wizard) {
      handleWizardInput(raw);
      return;
    }

    // 0. SECURITY & DEVELOPER LOCAL INTERCEPTORS
    const isSecurityOrBugQuestion = (text: string): boolean => {
      const t = text.toLowerCase();
      const keywords = [
        "كسر الأمان", "كسر الامان", "كسر الحماية", "كسر الحمايه", "كسر حماية", "كسر حمايه",
        "اختراق", "تخطي الأمان", "تخطي الامان", "تخطي الحماية", "تخطي الحمايه",
        "تهكير", "هكر", "مهكر", "هاكر", "ثغرة", "ثغره", "ثغرات", 
        "أخطاء في البرنامج", "اخطاء في البرنامج", "أخطاء البرنامج", "اخطاء البرنامج", "أخطاء النظام", "اخطاء النظام",
        "عيوب في البرنامج", "عيوب البرنامج", "مشاكل في البرنامج", "مشاكل البرنامج", "مشكلة في البرنامج", "مشكله في البرنامج",
        "ثغرات الأمان", "ثغرات الامان", "عيوب الأمان", "عيوب الامان", "أخطاء الأمان", "اخطاء الامان",
        "أخطاء برمجية", "اخطاء برمجية", "أخطاء برمجيه", "اخطاء برمجيه", "عيوب النظام", "عيوب الكود",
        "أخطاء الكود", "اخطاء الكود", "تخطي الحماية", "كيف اخترق", "كيف اهكر", "كيف أهكر",
        "break security", "bypass security", "security bypass", "crack security", "hack security", "security vulnerability", 
        "vulnerabilities", "exploit", "exploits", "program error", "program errors", "bugs in", "vulnerability", 
        "penetration test", "penetration testing", "bypass safe", "bypass protection", "crack the app", "hack the app",
        "app bugs", "system bug", "system bugs", "program bug", "program bugs", "source code errors", "source code bugs"
      ];
      return keywords.some(kw => t.includes(kw));
    };

    const isDeveloperQuestion = (text: string): boolean => {
      const t = text.toLowerCase();
      const keywords = [
        "المطور", "المصمم", "المبرمج", "صاحب البرنامج", "صانع البرنامج", "من صمم", "من طور", "من برمج", "مين طور", "مين برمج", "مين صمم", "مين اللي عمل", "مين الي عمل", "مين عمل", "من صنع", "فريق التطوير", "الشركة المطورة", "الشركه المطوره",
        "developer", "designer", "programmer", "who built", "who created", "who made", "who coded", "who is the owner", "creator of"
      ];
      return keywords.some(kw => t.includes(kw));
    };

    if (isSecurityOrBugQuestion(raw)) {
      push("assistant", isAr
        ? "عذراً، لا يمكنني تقديم أي معلومات حول أخطاء البرنامج، الثغرات، أو كيفية كسر أمان النظام. بصفتي المساعد الذكي لـ Center Plus، ينصب تركيزي بالكامل على مساعدتك في إدارة السنتر والمجموعات التعليمية والطلاب بكل أمان واحترافية! 😊"
        : "Sorry, I cannot provide any information regarding program errors, vulnerabilities, or how to break/bypass system security. As the AI Assistant for Center Plus, my entire focus is on helping you manage the educational center, classes, and students securely and professionally! 😊"
      );
      return;
    }

    if (isDeveloperQuestion(raw)) {
      push("assistant", isAr
        ? "مطور ومصمم هذا البرنامج بالكامل هو **مستر محمد الجزار المطور**، مدرس مادة الرياضيات بشربين. تم بناء وتطوير هذا النظام بأعلى مستويات الجودة والاحترافية لتلبية كافة احتياجات إدارة السنتر التعليمي والطلاب! 📐📊"
        : "The developer and designer of this program is **Mr. Mohamed Elgazzar, Developer** - Mathematics Teacher in Sherbin. This system was built and developed to the highest standards of professionalism to meet all educational center and student management needs! 📐📊"
      );
      return;
    }

    // 1. OFFLINE DIRECT RULE MATCHING
    const isDirectCmd = raw.length < 15 || 
      /افتح|اذهب|توجه|وريني|شغل|عرض|ادخل|روح|انتقل|أريد|اريد|عايز|حابب|أضف|اضف|سجل|احذف|حذف|تصدير|تحليل|open|go to|show|navigate|add|create|delete|remove|record|export|analyze/i.test(lower);

    if (isDirectCmd) {
      // A. Wizards
      if (/أضف طالب|اضف طالب|إضافة طالب|add student/i.test(lower)) {
        startWizard("add_student");
        return;
      }
      if (/احذف طالب|حذف طالب|delete student/i.test(lower)) {
        startWizard("delete_student");
        return;
      }
      if (/أضف معلم|اضف معلم|إضافة معلم|أضف مدرس|اضف مدرس|add teacher/i.test(lower)) {
        startWizard("add_teacher");
        return;
      }
      if (/أضف مجموعة|اضف مجموعة|إضافة مجموعة|أضف صف|اضف صف|add group|add class/i.test(lower)) {
        startWizard("add_group");
        return;
      }
      if (/سجل دفعة|تسجيل دفعة|دفع مصاريف|سجل مالي|record payment|add payment/i.test(lower)) {
        startWizard("record_payment");
        return;
      }
      if (/أضف امتحان|اضف امتحان|إضافة امتحان|add exam/i.test(lower)) {
        startWizard("add_exam");
        return;
      }
      if (/أضف واجب|اضف واجب|إضافة واجب|add assignment|add homework/i.test(lower)) {
        startWizard("add_homework");
        return;
      }
      if (/سجل حضور|تسجيل حضور|سجل غياب|record attendance/i.test(lower)) {
        startWizard("record_attendance");
        return;
      }
      if (/تقرير طالب|تصدير تقرير|student report|export report/i.test(lower)) {
        startWizard("export_student");
        return;
      }
      if (/تحليل طالب|analyze student|تحليل أداء/i.test(lower)) {
        startWizard("gemini_query");
        return;
      }
      if (/إحصائيات|احصائيات|statistics|stats/i.test(lower)) {
        const stats = buildStats();
        push("assistant", stats);
        return;
      }

      // B. Direct Navigations
      if (/الرئيسية|الرئيسيه|لوحة التحكم|dashboard/i.test(lower)) {
        navigateTo("dashboard");
        push("assistant", isAr ? "تم فتح لوحة التحكم الرئيسية بنجاح! 📊" : "Opened the main dashboard successfully! 📊");
        return;
      }
      if (/صفحة الطلاب|شغل الطلاب|عرض الطلاب|go to students|open students/i.test(lower)) {
        navigateTo("students");
        push("assistant", isAr ? "تم فتح صفحة الطلاب بنجاح! 👥" : "Opened the students page successfully! 👥");
        return;
      }
      if (/صفحة المعلمين|المدرسين|عرض المدرسين|go to teachers|open teachers/i.test(lower)) {
        navigateTo("teachers");
        push("assistant", isAr ? "تم فتح صفحة المعلمين بنجاح! 👨‍🏫" : "Opened the teachers page successfully! 👨‍🏫");
        return;
      }
      if (/صفحة المجموعات|عرض المجموعات|الحصص|go to classes|go to groups/i.test(lower)) {
        navigateTo("classes");
        push("assistant", isAr ? "تم فتح صفحة المجموعات بنجاح! 👥" : "Opened the groups/classes page successfully! 👥");
        return;
      }
      if (/جدول الحصص|الجدول|عرض الجدول|open schedule|show schedule/i.test(lower)) {
        navigateTo("schedule");
        push("assistant", isAr ? "تم فتح جدول الحصص والتحضير بنجاح! 📅" : "Opened the schedule successfully! 📅");
        return;
      }
      if (/صفحة الغياب|صفحة الحضور|التحضير|open attendance|show attendance/i.test(lower)) {
        navigateTo("attendance");
        push("assistant", isAr ? "تم فتح صفحة الحضور والغياب بنجاح! ⏰" : "Opened the attendance page successfully! ⏰");
        return;
      }
      if (/التحضير الذكي|الباركود|smart-attendance|barcode/i.test(lower)) {
        navigateTo("smart-attendance");
        push("assistant", isAr ? "تم تشغيل وضع التحضير الذكي والباركود! ⚡" : "Opened the Smart Attendance / Barcode mode! ⚡");
        return;
      }
      if (/المالية|الحسابات|المصاريف|الخزنة|open finance|show finance/i.test(lower)) {
        navigateTo("finance");
        push("assistant", isAr ? "تم فتح الحسابات والمالية بنجاح! 💵" : "Opened the finance page successfully! 💵");
        return;
      }
      if (/صفحة الامتحانات|الامتحانات|عرض الامتحانات|open exams|show exams/i.test(lower)) {
        navigateTo("exams");
        push("assistant", isAr ? "تم فتح صفحة الامتحانات بنجاح! 📝" : "Opened the exams page successfully! 📝");
        return;
      }
      if (/التقارير|الاحصائيات|تحليل السنتر|open reports|show reports/i.test(lower)) {
        navigateTo("reports");
        push("assistant", isAr ? "تم فتح التقارير والتحليلات بنجاح! 📊" : "Opened the reports page successfully! 📊");
        return;
      }
      if (/الرسائل|ارسال رسائل|open messages|show messages/i.test(lower)) {
        navigateTo("messages");
        push("assistant", isAr ? "تم فتح مركز الرسائل بنجاح! 💬" : "Opened the messages center successfully! 💬");
        return;
      }
      if (/الكروت|كروت الطلاب|idcards|id cards/i.test(lower)) {
        navigateTo("idcards");
        push("assistant", isAr ? "تم فتح مصمم ومطبع كروت الطلاب! 📇" : "Opened the ID cards designer page! 📇");
        return;
      }
      if (/الاعدادات|الإعدادات|open settings|go to settings/i.test(lower)) {
        navigateTo("settings");
        push("assistant", isAr ? "تم فتح الإعدادات بنجاح! ⚙️" : "Opened settings successfully! ⚙️");
        return;
      }
    }

    // 2. GEMINI ONLINE COGNITION
    if (hasGemini) {
      setLoading(true);
      try {
        // Calculate Top/Bottom performing students
        const studentGradesMap: Record<string, { total: number; count: number }> = {};
        if (db.examGrades && Array.isArray(db.examGrades)) {
          db.examGrades.forEach(g => {
            if (!studentGradesMap[g.studentId]) {
              studentGradesMap[g.studentId] = { total: 0, count: 0 };
            }
            const exam = db.exams?.find(e => e.id === g.examId);
            if (exam && exam.maxGrade > 0) {
              const pct = (g.obtainedGrade / exam.maxGrade) * 100;
              studentGradesMap[g.studentId].total += pct;
              studentGradesMap[g.studentId].count += 1;
            }
          });
        }

        const studentAverages = (db.students || []).map(s => {
          const entry = studentGradesMap[s.id];
          const avg = entry && entry.count > 0 ? Math.round(entry.total / entry.count) : null;
          
          // Calculate attendance rate for this student
          const atts = (db.attendance || []).filter(a => a.studentId === s.id);
          const totalAtt = atts.length;
          const presentAtt = atts.filter(a => a.status === "PRESENT" || a.status === "LATE").length;
          const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null;

          return { s, avg, attRate };
        });

        const studentsWithAverages = studentAverages.filter(item => item.avg !== null);
        const topStudents = [...studentsWithAverages].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)).slice(0, 3);
        
        // Warnings (attendance < 75% or grade average < 60%)
        const warningStudents = studentAverages.filter(item => 
          (item.attRate !== null && item.attRate < 75) || 
          (item.avg !== null && item.avg < 60)
        );

        // Staff stats
        const staffList = (staff || []).map(member => {
          const act = (staffActivity && staffActivity[member.uid]) || { count: 0, lastAt: 0, lastOp: "None" };
          return {
            name: member.displayName,
            role: member.role,
            title: member.title || "None",
            salary: member.salary || 0,
            activityCount: act.count,
            lastOp: act.lastOp,
          };
        });

        // Find highest/lowest active staff
        const sortedStaff = [...staffList].sort((a, b) => b.activityCount - a.activityCount);
        const highestActiveStaff = sortedStaff[0] || null;
        const lowestActiveStaff = sortedStaff.length > 1 ? sortedStaff[sortedStaff.length - 1] : null;

        // Financial summary
        const totalRevenue = (db.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const totalExpenses = (db.expenses || []).reduce((acc, e) => acc + e.amount, 0);
        const netProfit = totalRevenue - totalExpenses;

        const dbSummary = JSON.stringify({
          students: (db.students || []).map(s => ({ id: s.id || "", name: s.name || "", grade: s.grade || "", phone: s.parentPhone || "", teachers: s.teachers || [] })),
          teachers: (db.teachers || []).map(t => ({ id: t.id || "", name: t.name || "", payType: t.payType || "", commissionRate: t.commissionRate || 0, fixedAmount: t.fixedAmount || 0 })),
          groups: (db.groups || []).map(g => ({ id: g.id || "", name: g.name || "", teacherId: g.teacherId || "", grade: g.grade || "", subject: g.subject || "", days: g.days || [] })),
          classrooms: (db.classrooms || []).map(c => ({ id: c.id || "", name: c.name || "", capacity: c.capacity || 0 })),
          schedule: (db.scheduleEvents || []).map(e => ({ id: e.id || "", groupId: e.groupId || "", classroomId: e.classroomId || "", dayOfWeek: e.dayOfWeek || "", startTime: e.startTime || "", endTime: e.endTime || "" })),
          payments: (db.payments || []).slice(-15).map(p => ({ id: p.id || "", studentId: p.studentId || "", amount: p.amount || 0, type: p.type || "", month: p.month || "" }))
        });

        const systemPrompt = `You are an incredibly smart, helpful, polite and fully autonomous Arabic/English bilingual AI Agent and virtual assistant for "Center Plus" (educational center management app).
You have FULL READ and WRITE access to the center's database files and documents (students, teachers, classes/groups, classrooms, and schedules).

⚠️ IMPORTANT MANDATES:
1. THE SYSTEM DEVELOPER: If the user asks who developed, designed, created, or built this app, or anything related to its development/design, you MUST reply proudly in Arabic/English that the developer is "مستر محمد الجزار المطور - مدرس مادة الرياضيات بشربين" (Mr. Mohamed Elgazzar, Developer - Mathematics Teacher in Sherbin). You must state this proudly and do NOT mention any other developer or company under any circumstances.
2. SECURITY AND BUG RESTRICTIONS: If the user asks about any errors, bugs, or flaws in the program, or how to break/crack, bypass security, or safety measures ("اخطاء البرنامج" or "كيفية كسر الأمان" or "كيفية اختراق الأمان" or security bypass/hacks), you MUST absolutely and politely refuse to answer or discuss these topics under any circumstances.
3. STRICT EDUCATIONAL CENTER BOUNDS: You MUST always respond within the context and scope of the educational center ("السنتر") and its management. If the user asks about unrelated general knowledge or non-center topics, politely steer them back to managing their center.
4. ADVICES AND WARNINGS: You must analyze the center's real-time statistics below, proactively offer strategic advice, and give warnings about struggling students (low attendance or low exam marks) and employee activity.
5. RESPONSE SIZE & TONE: 
   - If the user asks for a detailed report, customized view, or a huge message/table ("رسالة كبيرة جداً" / "تقرير مفصل"), write an incredibly deep, rich, comprehensive report with Markdown tables and thorough breakdowns.
   - If the user asks a quick question, wants a simple advice or a short summary ("رسالة قصيرة" / "رد سريع"), keep your response concise, fast, and to the point.

⚡ AUTONOMOUS CRUD OPERATIONS (تسجيل وحذف أي شيء):
You can directly add, update, or delete any record in the database on behalf of the user. To perform an operation, explain what you did politely and append one or more executable [ACTION: ...] tags at the very end of your response. Each tag must be in its own bracket on its own line.

Supported actions:
- [ACTION: upsert | students | {"id": "STU_xxx", "name": "...", "grade": "...", "parentPhone": "...", "groupIds": [], "teachers": [], "discount": 0, "isExempt": false, "qrCode": "QR_xxx", "registrationDate": ${Date.now()}}]
- [ACTION: upsert | teachers | {"id": "TCH_xxx", "name": "...", "subjects": ["..."], "payType": "percentage", "commissionRate": 20, "fixedAmount": 0, "notesList": []}]
- [ACTION: upsert | groups | {"id": "GRP_xxx", "name": "...", "teacherId": "TCH_xxx", "grade": "...", "subject": "...", "days": [1,3]}]
- [ACTION: upsert | classrooms | {"id": "RM_xxx", "name": "...", "capacity": 30}]
- [ACTION: upsert | scheduleEvents | {"id": "SCH_xxx", "groupId": "GRP_xxx", "classroomId": "RM_xxx", "dayOfWeek": 1, "startTime": "14:00", "endTime": "15:30"}]
- [ACTION: upsert | payments | {"id": "PAY_xxx", "studentId": "STU_xxx", "amount": 150, "type": "MONTHLY_FEE", "month": "2026-07"}]
- [ACTION: upsert | expenses | {"id": "EXP_xxx", "title": "...", "amount": 100, "category": "Rent", "date": ${Date.now()}}]
- [ACTION: upsert | exams | {"id": "EXM_xxx", "groupId": "GRP_xxx", "name": "...", "maxGrade": 100, "date": ${Date.now()}}]
- [ACTION: upsert | examGrades | {"id": "GRD_xxx", "examId": "EXM_xxx", "studentId": "STU_xxx", "obtainedGrade": 90}]
- [ACTION: upsert | assignments | {"id": "HW_xxx", "groupId": "GRP_xxx", "title": "...", "dueDate": ${Date.now()}}]
- [ACTION: delete | collectionName | recordId]  (e.g., delete | students | STU_123 or delete | teachers | TCH_01)
- [ACTION: send_all_reports]  (to generate and export/download/send reports to parents of all students)
- [ACTION: send_report | STU_xxx]  (to generate and export/download/send report to parent of a specific student by student code)
- [ACTION: navigate | dashboard] (or other routes: students, teachers, classes, schedule, attendance, smart-attendance, finance, exams, reports, messages, idcards, settings)

ID GENERATION GUIDELINE:
- When creating any new record, generate a random unique ID with the prefix above (e.g. STU_xyz or GRP_abc, SCH_123, etc.) or match existing ones if updating/deleting them.

DATABASE STATUS & REAL-TIME STATISTICS:
- Active Students: ${db.students.length}
- Active Teachers: ${db.teachers.length}
- Study Groups: ${db.groups.length}
- Graded Exams: ${db.exams.length}
- Payments Registered: ${db.payments.length}
- Attendance Records: ${db.attendance.length}

💰 FINANCIAL REPORT:
- Total Revenue: EGP ${totalRevenue}
- Total Expenses: EGP ${totalExpenses}
- Net Profit: EGP ${netProfit}

🏆 TOP PERFORMING STUDENTS (Highest average exam grades):
${topStudents.map((item, i) => `${i + 1}. ${item.s.name} (Code: ${item.s.id}) - Average Grade: ${item.avg}%`).join("\n") || "No exam grades data available yet."}

⚠️ STUDENTS NEEDING IMMEDIATE ATTENTION / WARNINGS (Attendance < 75% or Average Grade < 60%):
${warningStudents.map((item) => `- Student: ${item.s.name} (Code: ${item.s.id}) [Attendance: ${item.attRate !== null ? item.attRate + "%" : "N/A"} | Average Grade: ${item.avg !== null ? item.avg + "%" : "N/A"}]`).slice(0, 5).join("\n") || "All students are performing beautifully!"}

🕵️ STAFF/EMPLOYEE MONITORING & PERFORMANCE:
${staffList.map((item) => `- Staff: ${item.name} (Role: ${item.role}) - Actions Executed: ${item.activityCount} - Last Action: ${item.lastOp}`).join("\n") || "No staff records."}
* Highest Performing Employee: ${highestActiveStaff ? `${highestActiveStaff.name} with ${highestActiveStaff.activityCount} actions executed` : "None"}
* Lowest Performing Employee: ${lowestActiveStaff ? `${lowestActiveStaff.name} with ${lowestActiveStaff.activityCount} actions executed` : "None"}

📅 SUBSCRIPTION AND PLANS:
- Current Plan: ${subscriptionPlan.toUpperCase()}

DATABASE DUMP (LIVE FILES):
${dbSummary}

RULES:
1. Speak warmly, professionally, and encouragingly in Arabic (by default) or English.
2. ORGANIZE AND OUTLINE RESPONSES: Always structure your replies using clear, clean headers (###), bold text/outlines (**), bulleted lists (-), and tables where appropriate. Avoid blocks of unformatted text.
3. PRIVACY & ISOLATION: This session is fully isolated and private to this specific Center's users. Never leak, reference, or mix database information with any other center or Super Admin systems.
4. If the user asks to add, record, delete, reschedule, or send reports, output the corresponding matching [ACTION: ...] tags.
5. Keep the markdown beautiful and extremely tidy.`;

        // Build chat history context for memory (including current message raw)
        const historyText = (messages || [])
          .filter((m) => m && m.text)
          .slice(-10)
          .map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.text}`)
          .join("\n");

        const promptWithHistory = `سجل المحادثة السابقة بينك وبين المستخدم للمتابعة والذاكرة:
${historyText}
المستخدم: ${raw}

أجب بناءً على السجل والسياق الحاليين:`;

        const answer = await geminiChat(promptWithHistory, systemPrompt, apiKey);
        
        // Parse the [ACTION: ...] tags
        const actionLinesRegex = /\[ACTION:\s*([^\]\n]+)\]/g;
        let actionMatch;
        const matchedActions: string[] = [];
        if (typeof answer === "string") {
          while ((actionMatch = actionLinesRegex.exec(answer)) !== null) {
            matchedActions.push(actionMatch[1]);
          }
        }

        let cleanAnswer = typeof answer === "string" ? answer.replace(/\[ACTION:\s*([^\]]+)\]/g, "").trim() : "";
        
        if (matchedActions.length > 0) {
          let hasNavigated = false;
          let executedActionsMsg = "";
          
          for (const actionStr of matchedActions) {
            const parts = actionStr.split("|");
            const actionType = parts[0].trim();
            
            if (actionType === "upsert") {
              const collection = parts[1].trim() as any;
              const payloadStr = parts.slice(2).join("|").trim();
              try {
                const payload = JSON.parse(payloadStr);
                upsert(collection, payload);
                executedActionsMsg += isAr 
                  ? `\n✅ تم حفظ في جدول ${collection}: **${payload.name || payload.title || payload.id}**`
                  : `\n✅ Saved in ${collection}: **${payload.name || payload.title || payload.id}**`;
              } catch (e) {
                console.error("Failed to parse upsert payload", e);
              }
            } else if (actionType === "delete") {
              const collection = parts[1].trim() as any;
              const id = parts[2].trim();
              try {
                remove(collection, id);
                executedActionsMsg += isAr 
                  ? `\n❌ تم حذف سجل بالكود \`${id}\` من جدول ${collection}`
                  : `\n❌ Deleted record \`${id}\` from ${collection}`;
              } catch (e) {
                console.error("Failed to execute delete action", e);
              }
            } else if (actionType === "navigate") {
              const route = parts[1].trim();
              navigateTo(route);
              hasNavigated = true;
            } else if (actionType === "send_all_reports") {
              executedActionsMsg += isAr 
                ? `\n📄 جاري تصدير وإرسال التقارير لجميع أولياء الأمور (${db.students.length} طالب)...`
                : `\n📄 Exporting and sending reports to all parents (${db.students.length} students)...`;
              db.students.forEach((s, idx) => {
                setTimeout(() => {
                  generateStudentPdf(db, s, lang);
                }, idx * 150);
              });
            } else if (actionType === "send_report") {
              const studentId = parts[1].trim();
              const found = db.students.find(s => s.id === studentId);
              if (found) {
                generateStudentPdf(db, found, lang);
                executedActionsMsg += isAr 
                  ? `\n📄 تم تصدير وإرسال تقرير الطالب **${found.name}** إلى ولي أمره بنجاح!`
                  : `\n📄 Exported and sent report for **${found.name}** to parent successfully!`;
              } else {
                executedActionsMsg += isAr 
                  ? `\n⚠️ لم يتم العثور على الطالب بالكود ${studentId} لإرسال التقرير.`
                  : `\n⚠️ Student not found with code ${studentId} for report generation.`;
              }
            } else if (actionType.startsWith("navigate_")) {
              const route = actionType.replace("navigate_", "");
              navigateTo(route);
              hasNavigated = true;
            } else if (actionType.startsWith("wizard_")) {
              const wizardType = actionType.replace("wizard_", "");
              setTimeout(() => {
                startWizard(wizardType);
              }, 500);
            }
          }
          
          let responseText = cleanAnswer;
          if (executedActionsMsg) {
            responseText += isAr 
              ? `\n\n⚙️ **إجراءات الوكيل الذكي المنفذة تلقائياً:**${executedActionsMsg}`
              : `\n\n⚙️ **AI Agent Actions Executed:**${executedActionsMsg}`;
          }
          if (hasNavigated) {
            responseText += "\n\n" + (isAr ? "⚡ جاري نقلك إلى الصفحة المطلوبة..." : "⚡ Navigating you to the requested page...");
          }
          push("assistant", responseText);
        } else {
          push("assistant", answer || (isAr ? "لم أتمكن من فهم طلبك بالشكل المطلوب." : "I couldn't process your request."));
        }
      } catch (err) {
        const errMsg = (err as Error).message || "";
        let finalMsg = isAr 
          ? `حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: ${errMsg}. جاري العمل بالذكاء المحلي للأوامر الأساسية.` 
          : `AI connection error: ${errMsg}. Falling back to offline commands.`;
          
        if (
          errMsg.includes("403") ||
          errMsg.includes("400") ||
          errMsg.toLowerCase().includes("key") ||
          errMsg.toLowerCase().includes("disabled") ||
          errMsg.toLowerCase().includes("project")
        ) {
          finalMsg = isAr
            ? `⚠️ **تنبيه:** يبدو أن مفتاح Gemini API الحالي غير مفعل أو غير صالح (أو تم تعطيله في مشروع Google Cloud).\n\n` +
              `**لتشغيل الذكاء الاصطناعي في السنتر:**\n` +
              `1. يرجى التوجه إلى صفحة **الإعدادات** في القائمة الجانبية للسنتر.\n` +
              `2. قم بإدخال مفتاح Gemini API الخاص بك (Gemini API Key) في حقل مفتاح الذكاء الاصطناعي.\n` +
              `3. احفظ الإعدادات وسيعمل المساعد الذكي فوراً وبدون أي مشاكل! 🎉`
            : `⚠️ **Notice:** The current Gemini API key is invalid, disabled, or not activated in the Google Cloud project.\n\n` +
              `**To enable AI features:**\n` +
              `1. Go to the **Settings** page in your center's sidebar.\n` +
              `2. Enter your custom **Gemini API Key** in the API Key field.\n` +
              `3. Save settings, and the Smart Assistant will be fully operational! 🎉`;
        }
        push("assistant", finalMsg);
      }
      setLoading(false);
      return;
    }

    push("assistant", isAr
      ? "لم أفهم طلبك. جرّب أحد الأوامر:\n• أضف طالب\n• تسجيل حضور\n• دفع مصاريف\n• أضف معلم\n• أضف مجموعة\n• إحصائيات"
      : "I didn't understand. Try one of these commands:\n• add student\n• record attendance\n• record payment\n• add teacher\n• add group\n• statistics");
  };

  /* ─── wizard state machine ─── */
  const handleWizardInput = (raw: string) => {
    if (!wizard) return;
    const lower = raw.toLowerCase();

    // cancel
    if (/إلغاء|cancel|الغاء|خروج|إيقاف/i.test(lower)) {
      setWizard(null);
      push("assistant", isAr ? "تم إلغاء العملية الجارية بنجاح ↩️" : "Operation cancelled successfully ↩️");
      return;
    }

    switch (wizard.type) {
      /* 1. ADD STUDENT WIZARD */
      case "add_student": {
        const w = wizard;
        if (w.step === "name") {
          setWizard({ ...w, step: "grade", draft: { ...w.draft, name: raw } });
          push("assistant", isAr 
            ? `اسم الطالب الجديد: **${raw}**\nما هي مرحلته الدراسية؟ (مثال: الصف الأول، الصف الثاني، الخ...)` 
            : `Student name: **${raw}**\nWhat is their grade level? (e.g. 1st Grade, 2nd Grade)`);
        } else if (w.step === "grade") {
          setWizard({ ...w, step: "phone", draft: { ...w.draft, grade: raw } });
          push("assistant", isAr 
            ? `المرحلة: **${raw}**\nما هو رقم هاتف ولي الأمر؟ (أرسل "تخطي" لتجاوز هذه الخطوة)` 
            : `Grade: **${raw}**\nWhat is the parent's phone number? (Send "skip" to skip)`);
        } else if (w.step === "phone") {
          const phone = /تخطي|skip/i.test(raw) ? "" : raw;
          const draft = { ...w.draft, phone } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **مراجعة وتأكيد بيانات الطالب:**\n\n` +
              `• الاسم: **${draft.name}**\n` +
              `• المرحلة: **${draft.grade}**\n` +
              `• الهاتف: **${phone || "لا يوجد"}**\n\n` +
              `أرسل **"تأكيد"** لحفظ الطالب الجديد أو **"إلغاء"** للتراجع.`
            : `📋 **Review and Confirm Student Details:**\n\n` +
              `• Name: **${draft.name}**\n` +
              `• Grade: **${draft.grade}**\n` +
              `• Phone: **${phone || "None"}**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newStudent = {
              id: nextStudentCode(db.students),
              name: d.name,
              grade: d.grade || "1-prep",
              groupIds: [],
              teachers: [],
              parentPhone: d.phone || "",
              discount: 0,
              isExempt: false,
              qrCode: uid("qr"),
              registrationDate: now(),
              lastUpdated: now(),
            };
            upsert("students", newStudent as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم إضافة الطالب الجديد **${d.name}** بنجاح! 🎉\nكود الطالب: \`${newStudent.id}\``
              : `Student **${d.name}** added successfully! 🎉\nStudent Code: \`${newStudent.id}\``);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء الحفظ." : "Saving cancelled.");
          }
        }
        break;
      }

      /* 2. DELETE STUDENT WIZARD */
      case "delete_student": {
        const w = wizard;
        if (w.step === "search") {
          const found = db.students.find(s => s.name.includes(raw) || s.id === raw || s.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "لم أجد طالباً بهذا الاسم أو الكود. أرسل الاسم مرة أخرى أو أرسل 'إلغاء' الخروج:" : "Student not found. Try searching again or send 'cancel':");
          } else {
            setWizard({ ...w, step: "confirm", draft: { id: found.id, name: found.name } });
            push("assistant", isAr
              ? `وجدت الطالب: **${found.name}** (${found.id})\n\n⚠️ **هل أنت متأكد تماماً من حذفه؟**\nأرسل **"تأكيد"** للحذف النهائي أو **"إلغاء"** للرجوع.`
              : `Found student: **${found.name}** (${found.id})\n\n⚠️ **Are you sure you want to delete them?**\nSend **"confirm"** to permanently delete or **"cancel"** to revert.`);
          }
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            remove("students", w.draft.id!);
            setWizard(null);
            push("assistant", isAr ? `تم حذف الطالب **${w.draft.name}** نهائياً من النظام. 🗑️` : `Student **${w.draft.name}** deleted successfully. 🗑️`);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء عملية الحذف." : "Deletion cancelled.");
          }
        }
        break;
      }

      /* 3. ADD TEACHER WIZARD */
      case "add_teacher": {
        const w = wizard;
        if (w.step === "name") {
          setWizard({ ...w, step: "subject", draft: { ...w.draft, name: raw } });
          push("assistant", isAr
            ? `اسم المعلم: **${raw}**\nما هي المادة التي يقوم بتدريسها؟ (مثال: رياضيات، فيزياء، لغة عربية)`
            : `Teacher name: **${raw}**\nWhat is the subject they teach? (e.g. Mathematics, Physics, Arabic)`);
        } else if (w.step === "subject") {
          setWizard({ ...w, step: "pay_type", draft: { ...w.draft, subject: raw } });
          push("assistant", isAr
            ? `المادة: **${raw}**\nما هو نظام حساب المعلم؟ أرسل **"نسبة"** (لحساب عمولة السنتر من الدفعات) أو **"ثابت"** (قيمة ثابتة يدفعها المعلم للسنتر شهرياً)`
            : `Subject: **${raw}**\nWhat is the teacher's payout system? Send **"percentage"** (center takes commission) or **"fixed"** (flat monthly fee paid by teacher)`);
        } else if (w.step === "pay_type") {
          const isPercentage = /نسبة|عمولة|نسبه|percent/i.test(raw);
          const payType = isPercentage ? "percentage" : "fixed";
          if (isPercentage) {
            setWizard({ ...w, step: "commission_rate", draft: { ...w.draft, payType } });
            push("assistant", isAr
              ? `النظام المالي: **عمولة مئوية**\nأدخل نسبة عمولة السنتر من كل دفعة (مثال: 20 لتمثل 20%):`
              : `Payout System: **Percentage**\nEnter center commission rate (e.g. 20 for 20%):`);
          } else {
            setWizard({ ...w, step: "fixed_amount", draft: { ...w.draft, payType } });
            push("assistant", isAr
              ? `النظام المالي: **قيمة ثابتة**\nما هي القيمة الثابتة التي يدفعها المعلم شهرياً للسنتر؟`
              : `Payout System: **Fixed**\nWhat is the flat fee the teacher pays monthly to the center?`);
          }
        } else if (w.step === "commission_rate") {
          const val = Number(raw.replace(/[^0-9.]/g, ""));
          const draft = { ...w.draft, commissionRate: String(val) } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **تأكيد بيانات المعلم:**\n\n` +
              `• الاسم: **${draft.name}**\n` +
              `• المادة: **${draft.subject}**\n` +
              `• النظام المالي: **نسبة مئوية (${val}%)**\n\n` +
              `أرسل **"تأكيد"** للحفظ أو **"إلغاء"** للرجوع.`
            : `📋 **Confirm Teacher Details:**\n\n` +
              `• Name: **${draft.name}**\n` +
              `• Subject: **${draft.subject}**\n` +
              `• System: **Percentage (${val}%)**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "fixed_amount") {
          const val = Number(raw.replace(/[^0-9.]/g, ""));
          const draft = { ...w.draft, fixedAmount: String(val) } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **تأكيد بيانات المعلم:**\n\n` +
              `• الاسم: **${draft.name}**\n` +
              `• المادة: **${draft.subject}**\n` +
              `• النظام المالي: **قيمة ثابتة (${val} ج.م)**\n\n` +
              `أرسل **"تأكيد"** للحفظ أو **"إلغاء"** للرجوع.`
            : `📋 **Confirm Teacher Details:**\n\n` +
              `• Name: **${draft.name}**\n` +
              `• Subject: **${draft.subject}**\n` +
              `• System: **Fixed Fee (${val} EGP)**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newTeacher = {
              id: nextTeacherCode(db.teachers),
              name: d.name,
              subjects: [d.subject],
              payType: d.payType === "percentage" ? "percentage" : "fixed",
              commissionRate: Number(d.commissionRate || 0),
              fixedAmount: Number(d.fixedAmount || 0),
              notesList: [],
              lastUpdated: now()
            };
            upsert("teachers", newTeacher as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم إضافة المعلم الجديد **${d.name}** بنجاح! 👨‍🏫🎉`
              : `Teacher **${d.name}** added successfully! 👨‍🏫🎉`);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء عملية الإضافة." : "Teacher addition cancelled.");
          }
        }
        break;
      }

      /* 4. ADD GROUP WIZARD */
      case "add_group": {
        const w = wizard;
        if (w.step === "name") {
          const teachersText = db.teachers.map(t => `• ${t.name} (كود: ${t.id})`).join("\n");
          setWizard({ ...w, step: "teacher", draft: { ...w.draft, name: raw } });
          push("assistant", isAr
            ? `اسم المجموعة: **${raw}**\nما هو كود أو اسم المعلم المسؤول عن هذه المجموعة؟ اختر من القائمة أدناه:\n\n${teachersText || "لا يوجد معلمين بعد"}`
            : `Group name: **${raw}**\nWhat is the teacher's name or code for this group? Select from below:\n\n${teachersText || "No teachers available"}`);
        } else if (w.step === "teacher") {
          const found = db.teachers.find(t => t.name.includes(raw) || t.id === raw || t.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "كود أو اسم المعلم غير صحيح. يرجى إرسال الكود بشكل دقيق:" : "Invalid teacher name or code. Please send the correct code:");
          } else {
            setWizard({ ...w, step: "grade", draft: { ...w.draft, teacherId: found.id, teacherName: found.name } });
            push("assistant", isAr
              ? `المعلم: **${found.name}**\nما هي المرحلة الدراسية المستهدفة؟ (مثال: الصف الأول، الصف الثالث مبرمج)`
              : `Teacher: **${found.name}**\nWhat is the target grade level? (e.g. 1st Grade, Pre-School)`);
          }
        } else if (w.step === "grade") {
          setWizard({ ...w, step: "subject", draft: { ...w.draft, grade: raw } });
          push("assistant", isAr
            ? `المرحلة: **${raw}**\nما هي المادة الدراسية لهذه المجموعة؟`
            : `Grade: **${raw}**\nWhat is the subject for this group?`);
        } else if (w.step === "subject") {
          const draft = { ...w.draft, subject: raw } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **تأكيد بيانات المجموعة الدراسية:**\n\n` +
              `• اسم المجموعة: **${draft.name}**\n` +
              `• المعلم: **${draft.teacherName}**\n` +
              `• المرحلة: **${draft.grade}**\n` +
              `• المادة: **${draft.subject}**\n\n` +
              `أرسل **"تأكيد"** للإنشاء النهائي أو **"إلغاء"** للتراجع.`
            : `📋 **Confirm Group Details:**\n\n` +
              `• Group Name: **${draft.name}**\n` +
              `• Teacher: **${draft.teacherName}**\n` +
              `• Grade: **${draft.grade}**\n` +
              `• Subject: **${draft.subject}**\n\n` +
              `Send **"confirm"** to create or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newGroup = {
              id: uid("grp"),
              name: d.name,
              teacherId: d.teacherId,
              grade: d.grade,
              subject: d.subject,
              days: [1, 3], // defaults
              lastUpdated: now()
            };
            upsert("groups", newGroup as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم إنشاء المجموعة الجديدة **${d.name}** بنجاح! 👥🎉`
              : `Group **${d.name}** created successfully! 👥🎉`);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء العملية." : "Cancelled.");
          }
        }
        break;
      }

      /* 5. RECORD PAYMENT WIZARD */
      case "record_payment": {
        const w = wizard;
        if (w.step === "student_search") {
          const found = db.students.find(s => s.name.includes(raw) || s.id === raw || s.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "لم أجد طالباً بهذا الاسم أو الكود. يرجى المحاولة مرة أخرى أو إرسال 'إلغاء' الخروج:" : "Student not found. Try searching again or send 'cancel':");
          } else {
            setWizard({ ...w, step: "type", draft: { ...w.draft, studentId: found.id, studentName: found.name } });
            push("assistant", isAr
              ? `الطالب: **${found.name}**\nما هو بند الدفع؟ أرسل رقم أو اسم الخيار:\n1. **MONTHLY_FEE** (اشتراك شهري)\n2. **EXAM_FEE** (رسوم امتحان)\n3. **BOOKS** (كتب ومذكرات)\n4. **OTHER** (بند آخر)`
              : `Student: **${found.name}**\nWhat is the payment type? Send number or option:\n1. **MONTHLY_FEE** (Monthly Tuition)\n2. **EXAM_FEE**\n3. **BOOKS**\n4. **OTHER**`);
          }
        } else if (w.step === "type") {
          let typeSelected = "MONTHLY_FEE";
          if (lower.includes("exam") || raw === "2" || raw.includes("امتحان")) typeSelected = "EXAM_FEE";
          else if (lower.includes("book") || raw === "3" || raw.includes("مذكر") || raw.includes("كتب")) typeSelected = "BOOKS";
          else if (lower.includes("other") || raw === "4" || raw.includes("آخر") || raw.includes("اخر")) typeSelected = "OTHER";

          setWizard({ ...w, step: "amount", draft: { ...w.draft, type: typeSelected } });
          push("assistant", isAr
            ? `نوع الدفعة: **${typeSelected}**\nما هو المبلغ المدفوع؟ (أرقام فقط):`
            : `Payment type: **${typeSelected}**\nWhat is the paid amount? (Numbers only):`);
        } else if (w.step === "amount") {
          const amt = Number(raw.replace(/[^0-9.]/g, ""));
          const currentMonth = new Date().toISOString().slice(0, 7);
          const draft = { ...w.draft, amount: String(amt), month: currentMonth } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **تأكيد المعاملة المالية السريعة:**\n\n` +
              `• الطالب: **${draft.studentName}**\n` +
              `• البند: **${draft.type}**\n` +
              `• المبلغ: **${amt} ج.م**\n` +
              `• الشهر الحالي: **${currentMonth}**\n\n` +
              `أرسل **"تأكيد"** لحفظ الإيصال والترحيل، أو **"إلغاء"** للتراجع.`
            : `📋 **Confirm Quick Transaction:**\n\n` +
              `• Student: **${draft.studentName}**\n` +
              `• Item: **${draft.type}**\n` +
              `• Amount: **${amt} EGP**\n` +
              `• Month: **${currentMonth}**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newPay = {
              id: uid("pay"),
              studentId: d.studentId,
              amount: Number(d.amount),
              date: now(),
              type: d.type as any,
              month: d.month || new Date().toISOString().slice(0, 7),
              lastUpdated: now()
            };
            upsert("payments", newPay as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم تسجيل الدفعة بنجاح! 💵✅\nرقم الإيصال: \`${newPay.id}\``
              : `Payment registered successfully! 💵✅\nReceipt No: \`${newPay.id}\``);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء عملية الدفع." : "Payment registration cancelled.");
          }
        }
        break;
      }

      /* 6. ADD EXAM WIZARD */
      case "add_exam": {
        const w = wizard;
        if (w.step === "group_select") {
          const found = db.groups.find(g => g.name.includes(raw) || g.id === raw || g.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "لم أجد تلك المجموعة. يرجى مراجعة الكود والمحاولة ثانية:" : "Group not found. Try again:");
          } else {
            setWizard({ ...w, step: "name", draft: { ...w.draft, groupId: found.id, groupName: found.name } });
            push("assistant", isAr
              ? `المجموعة المحددة: **${found.name}**\nما هو اسم الامتحان؟ (مثال: اختبار الباب الثاني، امتحان شامل)`
              : `Selected Group: **${found.name}**\nWhat is the exam name? (e.g. Chapter 2 Quiz, Midterm)`);
          }
        } else if (w.step === "name") {
          setWizard({ ...w, step: "max_grade", draft: { ...w.draft, name: raw } });
          push("assistant", isAr
            ? `اسم الامتحان: **${raw}**\nما هي الدرجة النهائية للاختبار؟ (مثال: 50 أو 100):`
            : `Exam name: **${raw}**\nWhat is the maximum grade for this exam? (e.g. 50, 100):`);
        } else if (w.step === "max_grade") {
          const max = Number(raw.replace(/[^0-9.]/g, ""));
          const draft = { ...w.draft, maxGrade: String(max) } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **تأكيد إضافة الامتحان الدراسي:**\n\n` +
              `• المجموعة: **${draft.groupName}**\n` +
              `• الاسم: **${draft.name}**\n` +
              `• الدرجة العظمى: **${max} درجة**\n\n` +
              `أرسل **"تأكيد"** لحفظ الاختبار وتوليد كشف الدرجات، أو **"إلغاء"** للعودة.`
            : `📋 **Confirm Adding Exam:**\n\n` +
              `• Group: **${draft.groupName}**\n` +
              `• Name: **${draft.name}**\n` +
              `• Max Grade: **${max} Marks**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newExam = {
              id: uid("ex"),
              groupId: d.groupId,
              name: d.name,
              maxGrade: Number(d.maxGrade),
              date: now(),
              lastUpdated: now()
            };
            upsert("exams", newExam as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم إضافة الامتحان الجديد **${d.name}** بنجاح! 📝🎉\nيمكنك الآن رصد الدرجات للطلاب.`
              : `Exam **${d.name}** added successfully! 📝🎉\nYou can now log grades for students.`);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء عملية الإضافة." : "Exam addition cancelled.");
          }
        }
        break;
      }

      /* 7. ADD HOMEWORK WIZARD */
      case "add_homework": {
        const w = wizard;
        if (w.step === "group_select") {
          const found = db.groups.find(g => g.name.includes(raw) || g.id === raw || g.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "لم أجد تلك المجموعة. يرجى كتابة الكود بدقة:" : "Group not found. Try again:");
          } else {
            setWizard({ ...w, step: "title", draft: { ...w.draft, groupId: found.id, groupName: found.name } });
            push("assistant", isAr
              ? `المجموعة: **${found.name}**\nما هو عنوان ومحتوى الواجب؟ (مثال: حل صفحة 5 و 6 في مذكرة الشرح)`
              : `Group: **${found.name}**\nWhat is the homework title/task? (e.g. Solve pages 5-6 in workbook)`);
          }
        } else if (w.step === "title") {
          setWizard({ ...w, step: "due_date", draft: { ...w.draft, title: raw } });
          push("assistant", isAr
            ? `الواجب: **${raw}**\nما هو آخر تاريخ للتسليم؟ أرسل عدد الأيام للحل (مثال: 3 لثلاثة أيام) أو 'غداً' أو تاريخاً مباشرة:`
            : `Task: **${raw}**\nWhen is it due? Send number of days (e.g. 3 for three days) or 'tomorrow':`);
        } else if (w.step === "due_date") {
          let dueMs = now() + 2 * 24 * 60 * 60 * 1000; // defaults 2 days
          if (raw.includes("غدا") || raw.includes("tomorrow")) {
            dueMs = now() + 24 * 60 * 60 * 1000;
          } else {
            const parsedDays = parseInt(raw.replace(/[^0-9]/g, ""));
            if (!isNaN(parsedDays) && parsedDays > 0) {
              dueMs = now() + parsedDays * 24 * 60 * 60 * 1000;
            }
          }

          const draft = { ...w.draft, dueDate: String(dueMs) } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **تأكيد إضافة الواجب الدراسي:**\n\n` +
              `• المجموعة: **${draft.groupName}**\n` +
              `• الواجب: **${draft.title}**\n` +
              `• تاريخ الاستحقاق: **${new Date(dueMs).toLocaleDateString()}**\n\n` +
              `أرسل **"تأكيد"** لحفظ الواجب أو **"إلغاء"** للرجوع.`
            : `📋 **Confirm Adding Homework:**\n\n` +
              `• Group: **${draft.groupName}**\n` +
              `• Homework: **${draft.title}**\n` +
              `• Due Date: **${new Date(dueMs).toLocaleDateString()}**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newAsg = {
              id: uid("asg"),
              groupId: d.groupId,
              title: d.title,
              dueDate: Number(d.dueDate),
              lastUpdated: now()
            };
            upsert("assignments", newAsg as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم إضافة الواجب الدراسي الجديد **${d.title}** بنجاح! 📚🎉`
              : `Homework **${d.title}** added successfully! 📚🎉`);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء العملية." : "Cancelled.");
          }
        }
        break;
      }

      /* 8. RECORD ATTENDANCE WIZARD */
      case "record_attendance": {
        const w = wizard;
        if (w.step === "group_select") {
          const found = db.groups.find(g => g.name.includes(raw) || g.id === raw || g.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "لم أجد المجموعة. يرجى مراجعة الكود:" : "Group not found. Try again:");
          } else {
            setWizard({ ...w, step: "student_search", draft: { ...w.draft, groupId: found.id, groupName: found.name } });
            push("assistant", isAr
              ? `المجموعة: **${found.name}**\nأرسل اسم أو كود الطالب المراد تسجيله حضور / غياب في المجموعة:`
              : `Group: **${found.name}**\nSend the name or code of the student to mark attendance:`);
          }
        } else if (w.step === "student_search") {
          const found = db.students.find(s => s.name.includes(raw) || s.id === raw || s.id.includes(raw));
          if (!found) {
            push("assistant", isAr ? "لم أجد طالباً بهذا الاسم أو الكود. حاول ثانية أو اكتب 'إلغاء':" : "Student not found. Try again or send 'cancel':");
          } else {
            setWizard({ ...w, step: "status", draft: { ...w.draft, studentId: found.id, studentName: found.name } });
            push("assistant", isAr
              ? `الطالب: **${found.name}**\nأرسل حالة الحضور الحالية:\n1. **حضور** (PRESENT)\n2. **غياب** (ABSENT)\n3. **عذر** (EXCUSED)\n4. **تأخير** (LATE)`
              : `Student: **${found.name}**\nSend attendance state:\n1. **PRESENT**\n2. **ABSENT**\n3. **EXCUSED**\n4. **LATE**`);
          }
        } else if (w.step === "status") {
          let statusSelected = "PRESENT";
          if (lower.includes("absent") || raw === "2" || raw.includes("غياب")) statusSelected = "ABSENT";
          else if (lower.includes("excused") || raw === "3" || raw.includes("عذر") || raw.includes("بإذن")) statusSelected = "EXCUSED";
          else if (lower.includes("late") || raw === "4" || raw.includes("تاخير") || raw.includes("تأخر")) statusSelected = "LATE";

          const draft = { ...w.draft, status: statusSelected } as any;
          setWizard({ ...w, step: "confirm", draft });
          push("assistant", isAr
            ? `📋 **مراجعة وتأكيد تسجيل الحضور اليومي:**\n\n` +
              `• المجموعة: **${draft.groupName}**\n` +
              `• الطالب: **${draft.studentName}**\n` +
              `• الحالة: **${statusSelected}**\n\n` +
              `أرسل **"تأكيد"** لإثبات وتأكيد الحالة فوراً، أو **"إلغاء"** للتراجع.`
            : `📋 **Confirm Daily Attendance Record:**\n\n` +
              `• Group: **${draft.groupName}**\n` +
              `• Student: **${draft.studentName}**\n` +
              `• Status: **${statusSelected}**\n\n` +
              `Send **"confirm"** to save or **"cancel"** to revert.`);
        } else if (w.step === "confirm") {
          if (isPositiveResponse(raw)) {
            const d = w.draft as any;
            const newRecord = {
              id: uid("att"),
              studentId: d.studentId,
              groupId: d.groupId,
              date: now(),
              status: d.status as any,
              lastUpdated: now()
            };
            upsert("attendance", newRecord as any);
            setWizard(null);
            push("assistant", isAr
              ? `تم تسجيل حضور **${d.studentName}** كـ **${d.status}** بنجاح! ⏰🎉`
              : `Recorded **${d.studentName}** as **${d.status}** successfully! ⏰🎉`);
          } else {
            setWizard(null);
            push("assistant", isAr ? "تم إلغاء الحفظ." : "Recording cancelled.");
          }
        }
        break;
      }

      /* 9. EXPORT STUDENT PDF WIZARD */
      case "export_student": {
        const found = db.students.find(s => s.name.includes(raw) || s.id === raw || s.id.includes(raw));
        if (!found) {
          push("assistant", isAr ? "لم أجد الطالب المطلوب. حاول ثانية أو أرسل 'إلغاء':" : "Student not found. Try searching again or send 'cancel':");
        } else {
          generateStudentPdf(db, found, lang);
          setWizard(null);
          push("assistant", isAr ? `تم تصدير وتحميل تقرير الطالب **${found.name}** بصيغة PDF بنجاح! 📄🚀` : `Exported and downloaded PDF report for **${found.name}** successfully! 📄🚀`);
        }
        break;
      }

      /* 10. GEMINI ANALYZE WIZARD */
      case "gemini_query": {
        const found = db.students.find(s => s.name.includes(raw) || s.id === raw || s.id.includes(raw));
        if (!found) {
          push("assistant", isAr ? "لم أجد الطالب المطلوب. حاول ثانية أو أرسل 'إلغاء':" : "Student not found. Try searching again or send 'cancel':");
        } else {
          setWizard(null);
          setLoading(true);
          generateInsight(db, found, apiKey, isAr ? "ar" : "en").then((res) => {
            push("assistant", `**تحليل الطالب: ${found.name}** — ${res.usedApi ? "مساعد الذكاء الاصطناعي الفائق ✨" : (isAr ? "تحليل محلي" : "Local analysis")}\n\n${res.text}`);
            setLoading(false);
          });
        }
        break;
      }
    }
  };

  /* ─── stats builder ─── */
  const buildStats = (): string => {
    const s = db.students.length;
    const te = db.teachers.length;
    const g = db.groups.length;
    const r = db.classrooms.length;
    const ex = db.exams.length;
    const hw = db.assignments.length;
    const payments = db.payments.length;

    return isAr
      ? `**📊 إحصائيات السنتر الفورية:**\n\n• عدد الطلاب المقيدين: **${s}** طالب\n• عدد المعلمين الكلي: **${te}** معلم\n• عدد مجموعات العمل الدراسية: **${g}** مجموعة\n• القاعات والفصول الدراسية: **${r}** قاعة\n• الاختبارات المسجلة: **${ex}** امتحان\n• الواجبات المطلوبة: **${hw}** واجب\n• إيصالات الحسابات والمعاملات المالية: **${payments}** معاملة`
      : `**📊 Live Center Statistics Summary:**\n\n• Enrolled Students: **${s}**\n• Active Teachers: **${te}**\n• Study Groups: **${g}**\n• Classrooms Available: **${r}**\n• Exams Logged: **${ex}**\n• Homework Assignments: **${hw}**\n• Finance/Payment Records: **${payments}**`;
  };

  /* ─── quick action chips ─── */
  const quickActions = [
    { label: isAr ? "إضافة طالب" : "Add Student", icon: <UserPlus className="h-3.5 w-3.5" />, type: "add_student" },
    { label: isAr ? "تسجيل حضور" : "Attendance", icon: <UserCheck className="h-3.5 w-3.5" />, type: "record_attendance" },
    { label: isAr ? "دفع مصاريف" : "Payment", icon: <CreditCard className="h-3.5 w-3.5" />, type: "record_payment" },
    { label: isAr ? "إضافة معلم" : "Add Teacher", icon: <Plus className="h-3.5 w-3.5" />, type: "add_teacher" },
    { label: isAr ? "إضافة مجموعة" : "Add Group", icon: <Plus className="h-3.5 w-3.5" />, type: "add_group" },
    { label: isAr ? "إضافة امتحان" : "Add Exam", icon: <ClipboardCheck className="h-3.5 w-3.5" />, type: "add_exam" },
    { label: isAr ? "تحليل طالب" : "Analyze Student", icon: <Sparkles className="h-3.5 w-3.5" />, type: "gemini_query" },
    { label: isAr ? "تصدير تقرير" : "Export PDF", icon: <FileText className="h-3.5 w-3.5" />, type: "export_student" },
  ];

  return (
    <div className="relative min-h-[500px]">
      <div className={cn("animate-fade-in flex flex-col h-[calc(100vh-8rem)]", isLocked && "pointer-events-none blur-sm select-none")}>
        {/* Header */}
        <PageHeader title={t("ai.title")} subtitle={t("ai.subtitle")} />

        <div className="flex flex-1 gap-4 min-h-0 mt-4">
          {/* Chat Area */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Messages */}
            <Card className="flex-1 flex flex-col overflow-hidden border border-line">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface/10 dark:bg-surface/5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-105",
                      msg.role === "user"
                        ? "bg-brand-500 text-white"
                        : "bg-gradient-to-br from-violet-500 via-brand-600 to-indigo-600 text-white",
                    )}>
                      {msg.role === "user" ? (
                        <span className="text-xs font-bold">{isAr ? "أنت" : "You"}</span>
                      ) : (
                        <Bot className="h-4.5 w-4.5" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border border-line/10",
                      msg.role === "user"
                        ? "bg-brand-500 text-white rounded-tr-sm"
                        : "bg-elevated rounded-tl-sm",
                    )}>
                      {msg.role === "user" ? (
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      ) : (
                        <RichText text={msg.text} />
                      )}
                      <p className={cn(
                        "mt-2 text-[10px]",
                        msg.role === "user" ? "text-white/60 text-end" : "text-faint",
                      )}>
                        {new Date(msg.ts).toLocaleTimeString(isAr ? "ar-EG" : undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white shadow-sm">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-elevated px-4 py-3 border border-line/15">
                      <div className="flex items-center gap-2.5 text-sm text-muted">
                        <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                        <span className="animate-pulse">{isAr ? "جاري التفكير وربط البيانات بالذكاء الاصطناعي..." : "Thinking & querying the databases..."}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Indicator HUD */}
              {wizard && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-t border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-400">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="uppercase text-[10px] tracking-wide bg-amber-500/15 px-2 py-0.5 rounded font-extrabold font-mono">
                      HUD: {wizard.type.replace("_", " ")}
                    </span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="opacity-90">
                      {isAr 
                        ? `الخطوة الحالية: [ ${wizard.step} ] — يرجى الرد على سؤال المساعد في الشات بالأسفل.`
                        : `Current step: [ ${wizard.step} ] — please respond to the assistant below.`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setWizard(null);
                      push("assistant", isAr ? "تم إلغاء المعالج بنجاح ✅" : "Cancelled the wizard successfully ✅");
                    }}
                    className="text-[10px] font-extrabold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    {isAr ? "إلغاء الإجراء" : "Cancel Action"}
                  </button>
                </div>
              )}

              {/* Quick Actions Panel */}
              <div className="border-t border-line px-4 py-2 bg-elevated/20 flex items-center gap-2 overflow-x-auto scrollbar-none">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  {isAr ? "المهام السريعة:" : "Quick Wizards:"}
                </span>
                {quickActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => startWizard(a.type)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition cursor-pointer shadow-sm shrink-0"
                  >
                    {a.icon}
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="border-t border-line p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isAr ? "اكتب رسالة أو اطلب إجراء مثل 'عايز افتح الحسابات'..." : "Type a message or request an action..."}
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || !input.trim()} className="shrink-0 rounded-xl px-5 h-10 flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800">
                    <Send className="h-4.5 w-4.5" />
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          {/* Sidebar Settings */}
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            {/* Gemini Status Card */}
            <Card className="p-4 space-y-4 border border-line">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-ink">Gemini Cognitive Engine</p>
                  <p className="text-[10px] font-mono font-bold text-muted">gemini-3.5-flash (Online)</p>
                </div>
              </div>

              <div className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-bold border flex items-center gap-2",
                hasGemini 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
              )}>
                {hasGemini ? (
                  <>
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{isAr ? "وضع الذكاء الفائق نشط ومرتبط ببيانات السنتر" : "Cognitive AI Online & Fully Integrated"}</span>
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-4 w-4 shrink-0" />
                    <span>{isAr ? "وضع محلي — الأوامر والوظائف الأساسية نشطة" : "Local mode — basic actions and wizards active"}</span>
                  </>
                )}
              </div>
            </Card>

            {/* Live Center Stats Card */}
            <Card className="p-4 space-y-3 border border-line">
              <p className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-brand-500" />
                <span>{isAr ? "ملخص بيانات السنتر" : "Center Overview Data"}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: isAr ? "طلاب" : "Students", value: db.students.length, color: "text-brand-600 dark:text-brand-400" },
                  { label: isAr ? "معلمين" : "Teachers", value: db.teachers.length, color: "text-violet-600 dark:text-violet-400" },
                  { label: isAr ? "مجموعات" : "Groups", value: db.groups.length, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: isAr ? "امتحانات" : "Exams", value: db.exams.length, color: "text-amber-600 dark:text-amber-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-elevated/40 border border-line/5 p-2 text-center">
                    <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                    <p className="text-[10px] font-bold text-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {isLocked && (
        <FeatureLockOverlay
          title="المساعد الذكي مغلق"
          description="استخدم الذكاء الاصطناعي لإدارة سنترك: إضافة وحذف الطلاب، تصدير التقارير، وتحليل الأداء الأكاديمي تلقائيًا."
          requiredPlan="enterprise"
        />
      )}
    </div>
  );
}
