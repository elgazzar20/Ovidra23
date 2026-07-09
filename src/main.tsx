import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Global client diagnostics logger
const logToDiagnosticFile = (type: string, message: string, stack?: string) => {
  fetch("http://127.0.0.1:3000/api/diagnostics/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, message, stack }),
  }).catch(() => {});
};

// Log application startup
logToDiagnosticFile("info", `Ovidra client started at ${new Date().toISOString()}`);

// Listen to unhandled exceptions
window.addEventListener("error", (event) => {
  logToDiagnosticFile("error", event.message, event.error?.stack);
});

// Listen to unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  logToDiagnosticFile("rejection", reason?.message || String(reason), reason?.stack);
});

// Intercept console.error to log Firestore & firebase errors
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError.apply(console, args);
  const msg = args.map(arg => typeof arg === "object" ? JSON.stringify(cleanErr(arg)) : String(arg)).join(" ");
  logToDiagnosticFile("console_error", msg);
};

function cleanErr(obj: any): any {
  try {
    return JSON.parse(JSON.stringify(obj, Object.getOwnPropertyNames(obj)));
  } catch {
    return String(obj);
  }
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
