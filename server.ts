import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// Load .env file manually if it exists to populate process.env
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const firstEquals = trimmed.indexOf("=");
      if (firstEquals !== -1) {
        const key = trimmed.slice(0, firstEquals).trim();
        let value = trimmed.slice(firstEquals + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.warn("Failed to load .env file:", e);
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Set CORS and Cross-Origin-Opener-Policy to prevent OAuth popup block warnings and fetch failures
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Specialized AI system instruction for the Super Admin Assistant
const SYSTEM_INSTRUCTION = `
أنت "مساعد السوبر أدمن الذكي" (CPD Super Admin AI Co-Pilot).
مهمتك هي مساعدة مالك وموظفي لوحة تحكم السوبر أدمن في إدارة النظام وحل المشكلات الفنية والتقنية.

النظام هو "لوحة الإدارة الرئيسية لنظام إدارة السناتر التعليمية والمدارس (Ovidra / CPD)".

ميزات وقدرات مساعد السوبر أدمن:
1. استكشاف الأخطاء وإصلاحها (Troubleshooting):
   - مشاكل تسجيل دخول الموظفين (تم إصلاحها عبر رصد دور platform_staff أو super_admin).
   - مشاكل مزامنة الأجهزة أو تخطي الحد الأقصى للأجهزة (إعادة تعيين التراخيص أو زيادة حد الأجهزة).
   - التنبيهات الخاصة باقتراب انتهاء التراخيص (يتم رصدها تلقائياً وإخطار المستخدمين في السنتر وفي لوحة التحكم).
   
2. إدارة التراخيص والخطط:
   - تخصيص الخطط: النظام يدعم خطتين فقط هما "الخطة الاحترافية (Professional)" و"الخطة المؤسسية (Enterprise)".
   - التراخيص المشفرة: يتم إصدارها لأغراض متعددة: تنشيط خطة كاملة، فترة تجريبية مجانية، أو تطبيق كود خصم محدد القيمة والمدة.
   
3. التطوير البرمجي والدعم التقني:
   - يمكنك كتابة أكواد SQL للاستعلام البرمجي أو إصلاح البيانات.
   - تقديم حلول تقنية برمجية مباشرة وبجودة عالية جداً.

قواعد التنسيق والخصوصية الفائقة:
1. تنظيم وترتيب الردود (Formatting): نسّق ردودك دائماً باستخدام عناوين واضحة وجريئة (###)، مع استعمال الخطوط العريضة (**)، والقوائم النقطية (-)، لتسهيل القراءة وتوضيح الخطوات.
2. الخصوصية والأمان (Privacy & Security): تواصل فقط بخصوصية تامة حول إحصائيات ومعلومات هذا النظام. لا تشارك بيانات أو معلومات بين السوبر أدمن والسناتر العادية إلا لغرض الإصلاح الفني المصرح به.

تواصل دائماً باللغة العربية بأسلوب احترافي ومباشر، وقدم خطوات واضحة (Actionable Steps).
`;

// AI Troubleshooting Endpoint
app.post("/api/superadmin/ai-troubleshoot", async (req, res) => {
  try {
    const { message, history = [], systemContext = {} } = req.body;
    
    const key = process.env.GEMINI_API_KEY || "AQ.Ab8RN6Jbp8Au2T6bBGUKd1gT3g16pGnkYfOiR_dmOuMozQM_dA";
    const ai = new GoogleGenAI({ apiKey: key });

    // Build chat contents including history
    const contents = [];
    
    // Add history
    for (const msg of history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      });
    }

    // Add current context + message
    const contextPrompt = `
[معلومات النظام الحالية للسنتر]
- إجمالي السناتر المسجلة: ${systemContext.totalCenters || 0}
- إجمالي التراخيص النشطة: ${systemContext.activeLicenses || 0}
- البريد الإلكتروني للمدير الحالي: ${systemContext.adminEmail || "unknown"}
- التذاكر المفتوحة والمعلقة: ${systemContext.pendingTickets || 0}

رسالة السوبر أدمن: ${message}
`;

    contents.push({
      role: "user",
      parts: [{ text: contextPrompt }]
    });

    const fallbackModels = [
      "gemini-2.0-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro"
    ];

    let response;
    let lastError;
    for (const model of fallbackModels) {
      try {
        response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
          }
        });
        break; // Successfully got response
      } catch (err) {
        console.warn(`[SuperAdmin AI] Model ${model} failed, trying next fallback...`, err);
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error("All fallback models failed.");
    }

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("[SuperAdmin AI] Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ غير متوقع أثناء معالجة طلب الذكاء الاصطناعي." });
  }
});

// Client-side diagnostics logger route
app.post("/api/diagnostics/log", (req, res) => {
  try {
    const { type, message, stack } = req.body;
    const logFilePath = path.join(process.cwd(), "client_diagnostic_errors.log");
    const logMessage = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${message}${stack ? `\nStack: ${stack}` : ""}\n`;
    fs.appendFileSync(logFilePath, logMessage);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to write diagnostic log" });
  }
});

const GOOGLE_AUTH_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>تسجيل الدخول — Ovidra</title>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Tajawal', sans-serif;
      background: linear-gradient(135deg, #f4f5fb 0%, #e2e8f0 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      direction: rtl;
    }
    .card {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.4);
      padding: 40px;
      border-radius: 24px;
      box-shadow: 0 20px 40px rgba(109, 93, 252, 0.1);
      text-align: center;
      max-width: 420px;
      width: 100%;
      box-sizing: border-box;
    }
    h2 {
      color: #1e293b;
      margin-top: 0;
      font-size: 22px;
      font-weight: 900;
    }
    p {
      color: #64748b;
      font-size: 13px;
      line-height: 1.6;
    }
    .btn {
      background: linear-gradient(135deg, #6d5dfc 0%, #5a47f0 100%);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 14px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 24px;
      font-size: 14px;
      width: 100%;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(109, 93, 252, 0.3);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(109, 93, 252, 0.4);
    }
    .status {
      margin-top: 20px;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 40px; margin-bottom: 15px;">🌐</div>
    <h2>تسجيل الدخول الآمن مع Google</h2>
    <p>أهلاً بك! لإكمال عملية تسجيل الدخول إلى تطبيق Ovidra، يرجى النقر على الزر بالأسفل لاختيار حسابك وتأكيد المصادقة.</p>
    <button class="btn" id="loginBtn">تسجيل الدخول باستخدام Google</button>
    <div class="status" id="status">جاهز للمصادقة</div>
  </div>

  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyBy6VwqzN6HUYEmovYIGT6bS2N-wlRKQqU",
      authDomain: "nexora-windos-app.firebaseapp.com",
      projectId: "nexora-windos-app",
      storageBucket: "nexora-windos-app.firebasestorage.app",
      messagingSenderId: "869178537311",
      appId: "1:869178537311:web:452ea2c9dddf6d85f332ea",
      measurementId: "G-Y0TB8YHMDG"
    };

    firebase.initializeApp(firebaseConfig);
    
    const loginBtn = document.getElementById("loginBtn");
    const statusDiv = document.getElementById("status");

    loginBtn.addEventListener("click", () => {
      statusDiv.style.color = "#6d5dfc";
      statusDiv.innerText = "جاري فتح نافذة المصادقة في حسابات Google...";
      const provider = new firebase.auth.GoogleAuthProvider();
      
      firebase.auth().signInWithPopup(provider)
        .then(result => {
          statusDiv.style.color = "#059669";
          statusDiv.innerText = "تمت المصادقة بنجاح! جاري التوصيل بالتطبيق...";
          
          const user = result.user;
          user.getIdToken().then(idToken => {
            fetch("/auth/google-callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: idToken })
            }).then(() => {
              statusDiv.innerHTML = "<span style='color: #059669;'>تم التوصيل بنجاح! يمكنك الآن العودة إلى التطبيق وإغلاق هذه الصفحة.</span>";
              setTimeout(() => {
                window.close();
              }, 2500);
            }).catch(err => {
              statusDiv.style.color = "#dc2626";
              statusDiv.innerText = "تعذر إرسال بيانات الدخول للتطبيق: " + err.message;
            });
          });
        })
        .catch(err => {
          statusDiv.style.color = "#dc2626";
          
          // Send error to local server so Electron knows immediately
          fetch("/auth/google-error", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.code || err.message })
          }).catch(() => {});

          if (err.code === "auth/unauthorized-domain") {
            statusDiv.innerHTML = \`
              <div style="text-align: right; background: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 12px; margin-top: 15px; font-size: 13px; color: #991b1b; line-height: 1.6;">
                <strong style="font-size: 14px;">⚠️ خطأ في نطاق تسجيل الدخول (Unauthorized Domain):</strong><br/>
                هذا العنوان (127.0.0.1) غير مصرح به في مشروع Firebase الخاص بك.<br/><br/>
                <strong>💡 طريقة الحل الفوري:</strong><br/>
                1. افتح <a href="https://console.firebase.google.com/" target="_blank" style="color: #6d5dfc; font-weight: bold; text-decoration: underline;">Firebase Console</a>.<br/>
                2. اذهب إلى قسم <strong>Authentication</strong> من القائمة الجانبية.<br/>
                3. اختر تبويب <strong>Settings</strong> من الأعلى، ثم <strong>Authorized domains</strong>.<br/>
                4. اضغط على <strong>Add domain</strong> واكتب: <code style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #cbd5e1;">127.0.0.1</code> ثم اضغط <strong>Save</strong>.<br/>
                5. أعد محاولة تسجيل الدخول الآن وسيعمل مباشرة!
              </div>
            \`;
          } else {
            statusDiv.innerText = "فشلت المصادقة: " + err.message;
          }
        });
    });
  </script>
</body>
</html>
`;

let oauthResult: any = null;
let oauthError: any = null;

app.get("/auth/google", (req, res) => {
  res.send(GOOGLE_AUTH_HTML);
});

app.post("/auth/google-callback", (req, res) => {
  oauthResult = req.body;
  oauthError = null;
  res.sendStatus(200);
});

app.post("/auth/google-error", (req, res) => {
  oauthError = req.body.error;
  oauthResult = null;
  res.sendStatus(200);
});

app.get("/auth/google-status", (req, res) => {
  res.json({ result: oauthResult, error: oauthError });
});

app.post("/auth/google-clear", (req, res) => {
  oauthResult = null;
  oauthError = null;
  res.sendStatus(200);
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname.endsWith("dist") ? __dirname : path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
  });
}

startServer();
