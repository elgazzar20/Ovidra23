const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Disable Hardware Acceleration to prevent rendering failure/invisible windows in RDP/VMs
app.disableHardwareAcceleration();

let mainWindow;

// Enforce single instance lock to prevent duplicate process conflicts on port 3000
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Setup simple diagnostic log file
const logPath = path.join(app.getPath("userData"), "ovidra-server.log");
const log = (msg) => {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
};

log("--- OVIDRA STARTUP ---");
log(`app.isPackaged: ${app.isPackaged}`);
log(`process.env.NODE_ENV: ${process.env.NODE_ENV}`);
log(`__dirname: ${__dirname}`);

// Global exception/rejection tracking for diagnostics
process.on("unhandledRejection", (reason) => {
  log(`Unhandled Rejection: ${reason?.stack || reason?.message || String(reason)}`);
  dialog.showErrorBox(
    "خطأ غير معالج (Unhandled Rejection)",
    String(reason?.stack || reason?.message || reason)
  );
});
process.on("uncaughtException", (error) => {
  log(`Uncaught Exception: ${error?.stack || error?.message || String(error)}`);
  dialog.showErrorBox(
    "خطأ غير متوقع (Uncaught Exception)",
    String(error?.stack || error?.message || error)
  );
});

// Global User-Agent override to bypass Google OAuth blocks in embedded windows
app.on("web-contents-created", (event, contents) => {
  contents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
});

// Boot local Express server in production so that standard HTTP/localhost origin is used (enabling Google Sign-In)
const isDev = !app.isPackaged && process.env.NODE_ENV === "development";
if (!isDev) {
  process.env.NODE_ENV = "production";
  process.env.ELECTRON_BUILD = "true";
  try {
    log("Requiring dist/server.cjs...");
    require(path.join(__dirname, "dist", "server.cjs"));
    log("dist/server.cjs required successfully.");
  } catch (e) {
    log(`Failed to require dist/server.cjs: ${e.stack || e.message || String(e)}`);
    dialog.showErrorBox(
      "خطأ في تشغيل السيرفر المحلي",
      "تعذر بدء خادم الويب المحلي اللازم لتسجيل الدخول: \n\n" + (e.stack || e.message || String(e))
    );
  }
}

const AUTH_POPUP_HOSTS = new Set([
  "accounts.google.com",
  "nexora-windos-app.firebaseapp.com",
]);

function isAuthPopupUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      AUTH_POPUP_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".google.com") ||
      url.hostname.endsWith(".firebaseapp.com") ||
      url.hostname.endsWith(".firebase.com") ||
      url.hostname.endsWith(".gstatic.com")
    );
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: "Ovidra — Educational Center Management",
    show: true, // Show immediately on launch to ensure instant user feedback
    backgroundColor: "#f4f5fb",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const loadWithRetry = (attemptsLeft = 15) => {
    mainWindow.loadURL("http://127.0.0.1:3000").then(() => {
      log("loadURL succeeded: http://127.0.0.1:3000 loaded successfully.");
    }).catch((err) => {
      log(`loadURL attempt failed (attempts left: ${attemptsLeft}): ${err.message || String(err)}`);
      if (attemptsLeft > 0) {
        setTimeout(() => loadWithRetry(attemptsLeft - 1), 1000);
      } else {
        log("All loadURL attempts failed. Falling back to loadFile index.html");
        mainWindow.loadFile(path.join(__dirname, "dist", "index.html")).catch((fileErr) => {
          log(`loadFile fallback failed: ${fileErr.message || String(fileErr)}`);
        });
      }
    });
  };

  log(`Loading application (isDev: ${isDev})...`);
  loadWithRetry();
  
  // Open DevTools in production to assist in debugging/tracing console errors
  mainWindow.webContents.openDevTools();

  // Keep OAuth popups inside Electron so Firebase Google sign-in can complete.
  // Non-auth links still open in the user's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopupUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          title: "Ovidra Sign In",
          parent: mainWindow,
          modal: false,
          backgroundColor: "#ffffff",
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createMenu() {
  Menu.setApplicationMenu(null);
  return;
  const isMac = process.platform === "darwin";
  const template = [
    {
      label: "الملف" || "File",
      submenu: [
        {
          label: "تحديث الصفحة" || "Reload",
          accelerator: "CmdOrCtrl+R",
          role: "reload",
        },
        {
          label: "ملء الشاشة" || "Toggle Full Screen",
          accelerator: "F11",
          role: "togglefullscreen",
        },
        { type: "separator" },
        {
          label: "خروج" || "Exit",
          accelerator: "CmdOrCtrl+Q",
          click() {
            app.quit();
          },
        },
      ],
    },
    {
      label: "تعديل" || "Edit",
      submenu: [
        { label: "تراجع", role: "undo" },
        { label: "إعادة", role: "redo" },
        { type: "separator" },
        { label: "قص", role: "cut" },
        { label: "نسخ", role: "copy" },
        { label: "لصق", role: "paste" },
        { label: "تحديد الكل", role: "selectAll" },
      ],
    },
    {
      label: "عرض" || "View",
      submenu: [
        { label: "تكبير الخط", role: "zoomIn" },
        { label: "تصغير الخط", role: "zoomOut" },
        { label: "إعادة تعيين حجم الخط", role: "resetZoom" },
        { type: "separator" },
        {
          label: "أدوات المطور" || "Toggle Developer Tools",
          accelerator: "F12",
          role: "toggleDevTools",
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
