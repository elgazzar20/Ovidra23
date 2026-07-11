import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, HelpCircle, Loader2, Send, Sparkles, Trash2, User } from "lucide-react";
import { pushToast } from "../../components/ui";
import { cn } from "../../utils/cn";
import { DEFAULT_GEMINI_KEY, geminiChat, getEffectiveApiKey } from "../../lib/ai";
import { type CenterRecord, fetchGlobalSettings } from "../../lib/superadmin";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface AiCopilotTabProps {
  admin: { uid: string; email: string };
  centers: CenterRecord[];
}

const welcomeMessage =
  "أهلاً بك في مساعد السوبر أدمن الذكي. أستطيع مساعدتك في تشخيص مشاكل السناتر، الاشتراكات، التراخيص، Firebase، وصلاحيات الموظفين بخطوات عملية واضحة.";

function AiRichText({ text }: { text: string }) {
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

export function AiCopilotTab({ admin, centers }: AiCopilotTabProps) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: welcomeMessage }]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState(() => getEffectiveApiKey("", DEFAULT_GEMINI_KEY));

  useEffect(() => {
    const loadKey = () => {
      fetchGlobalSettings().then((settings) => {
        setApiKey(getEffectiveApiKey("", settings?.geminiApiKey));
      });
    };
    loadKey();
    window.addEventListener("platform_settings_updated", loadKey);
    return () => window.removeEventListener("platform_settings_updated", loadKey);
  }, []);

  const systemContext = useMemo(() => ({
    totalCenters: centers.length,
    activeLicenses: centers.filter((c) => c.subscriptionStatus === "active").length,
    trialCenters: centers.filter((c) => c.subscriptionStatus === "trialing").length,
    suspendedCenters: centers.filter((c) => c.status !== "active").length,
    adminEmail: admin.email,
  }), [admin.email, centers]);

  const suggestions = [
    "افحص سبب عدم ظهور سنتر جديد في لوحة السوبر أدمن بعد تسجيل Google",
    "ما خطوات حل مشكلة permission-denied في Firestore؟",
    "كيف أراجع اشتراك سنتر انتهت صلاحيته؟",
    "اقترح خطة فحص لمشكلة الحضور الذكي والكروت",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || loading) return;

    const currentMessages = [...messages, { role: "user" as const, text: clean }];
    setMessages(currentMessages);
    setInputValue("");
    setLoading(true);

    try {
      const historyText = currentMessages
        .slice(-10)
        .map((msg) => `${msg.role === "user" ? "Super Admin" : "Assistant"}: ${msg.text}`)
        .join("\n");

      const prompt = `
سياق لوحة السوبر أدمن:
- إجمالي السناتر: ${systemContext.totalCenters}
- التراخيص النشطة: ${systemContext.activeLicenses}
- السناتر التجريبية: ${systemContext.trialCenters}
- السناتر غير النشطة: ${systemContext.suspendedCenters}
- بريد المشرف الحالي: ${systemContext.adminEmail}

آخر المحادثة:
${historyText}

طلب السوبر أدمن:
${clean}
`;

      const systemInstruction = `
أنت مساعد السوبر أدمن الذكي داخل Ovidra.
مهمتك مساعدة مالك المنصة في تشخيص مشاكل السناتر، الاشتراكات، التراخيص، الموظفين، Firebase، وسير عمل النظام.
أجب بالعربية الواضحة والمباشرة، وقدّم خطوات عملية مختصرة.
هذا المساعد مستقل عن مساعد المستخدم العادي داخل السنتر.
إذا احتجت لبيانات غير موجودة في السياق، وضح بالضبط أين يتم فحصها داخل لوحة السوبر أدمن أو Firebase.
`;

      const text = await geminiChat(prompt, systemInstruction, apiKey);
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } catch (e) {
      const message = (e as Error).message || "تعذر الاتصال بالمساعد الذكي";
      pushToast(message, "error");
      
      let errorText = `تعذر الاتصال بمحرك الذكاء الاصطناعي الآن: ${message}\n\nيمكنك متابعة الفحص يدويا من Firebase Console ثم إعادة المحاولة.`;
      if (
        message.includes("403") ||
        message.includes("400") ||
        message.includes("401") ||
        message.toLowerCase().includes("key") ||
        message.toLowerCase().includes("disabled") ||
        message.toLowerCase().includes("project") ||
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("unauthenticated")
      ) {
        errorText = `⚠️ **تنبيه:** يبدو أن مفتاح Gemini API الحالي غير مفعل أو غير صالح (أو تم تعطيله في مشروع Google Cloud).\n\n` +
          `**لتشغيل المساعد الذكي للسوبر أدمن:**\n` +
          `1. انتقل إلى **إعدادات النظام العامة** (تبويب الإعدادات هنا في لوحة السوبر أدمن).\n` +
          `2. قم بإدخال مفتاح Gemini API الخاص بك (Gemini API Key) في حقل مفتاح الذكاء الاصطناعي وتفعيل خيار المساعد الذكي.\n` +
          `3. احفظ التغييرات وستعمل الخدمة فوراً.`;
      }
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: errorText,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", text: welcomeMessage }]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 text-right lg:grid-cols-4" dir="rtl">
      <div className="space-y-4 lg:col-span-1">
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-brand-600">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-ink">مساعد السوبر أدمن</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            مساعد منفصل للمنصة، مخصص للدعم الفني، الاشتراكات، التراخيص، Firebase، ومتابعة السناتر.
          </p>
          <div className="space-y-2 border-t border-line pt-3">
            <Metric label="إجمالي السناتر" value={systemContext.totalCenters} />
            <Metric label="تراخيص نشطة" value={systemContext.activeLicenses} />
            <Metric label="سناتر تجريبية" value={systemContext.trialCenters} />
            <Metric label="غير نشطة" value={systemContext.suspendedCenters} />
          </div>
          <div className="rounded-xl bg-elevated/50 p-3 text-[11px] font-semibold text-muted">
            <span className="block text-faint">المشرف الحالي</span>
            <span className="font-mono text-ink">{admin.email}</span>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h4 className="text-xs font-bold text-ink">موضوعات سريعة</h4>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              disabled={loading}
              className="flex w-full items-start gap-2 rounded-xl border border-line bg-elevated/30 p-2 text-right text-[11px] font-bold text-muted transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-60"
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>{s}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:col-span-3">
        <div className="flex items-center justify-between border-b border-line bg-elevated/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-brand-600" />
            <div>
              <h3 className="text-sm font-bold text-ink sm:text-base">دردشة الدعم والتحليل الذكي</h3>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                متصل بمحرك Gemini
              </span>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>مسح</span>
          </button>
        </div>

        <div className="cp-scroll flex-1 space-y-4 overflow-y-auto bg-elevated/10 p-4">
          {messages.map((msg, idx) => {
            const isAi = msg.role === "assistant";
            return (
              <div key={idx} className={cn("flex max-w-[88%] gap-3", isAi ? "ml-auto" : "mr-auto flex-row-reverse")}>
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", isAi ? "bg-brand-600" : "bg-slate-800")}>
                  {isAi ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={cn("rounded-2xl border p-4 text-sm leading-relaxed shadow-sm", isAi ? "border-line bg-surface text-ink" : "border-slate-950 bg-slate-900 text-white")}>
                  {isAi ? <AiRichText text={msg.text} /> : <div className="whitespace-pre-line">{msg.text}</div>}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="ml-auto flex max-w-[80%] gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-xs font-semibold text-muted">
                <span>جاري تحليل الطلب...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-elevated/20 p-3">
          <span className="flex items-center gap-1 text-[10px] font-bold text-muted">
            <HelpCircle className="h-3.5 w-3.5 text-brand-500" />
            اقتراحات:
          </span>
          {suggestions.slice(0, 2).map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              disabled={loading}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-60"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="border-t border-line bg-surface p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSend(inputValue);
              }}
              placeholder="اكتب رسالتك لمساعد السوبر أدمن..."
              className="h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-xs text-ink focus:border-brand-400 focus:outline-none sm:text-sm"
              disabled={loading}
            />
            <button
              onClick={() => handleSend(inputValue)}
              disabled={loading || !inputValue.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md transition hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}
