import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, RefreshCw, Lock, ArrowLeft } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { createAndSendOTP, verifyOTP } from "../../lib/superadmin";

/**
 * OTP Gate — shown ONLY to super_admin users after Firebase login.
 * Hidden from all other users.
 */
export function OTPGate({
  userUid,
  userEmail,
  onSuccess,
  onCancel,
}: {
  userUid: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useApp();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 min countdown
  const [canResend, setCanResend] = useState(false);

  // Send OTP on mount
  useEffect(() => {
    sendOTP();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const sendOTP = useCallback(async () => {
    setSending(true);
    setError("");
    setSecondsLeft(300);
    setCanResend(false);
    setCode(["", "", "", "", "", ""]);
    const res = await createAndSendOTP(userUid, userEmail);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "Failed to send OTP");
      setCanResend(true);
    }
  }, [userUid, userEmail]);

  const handleInput = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[idx] = val;
    setCode(next);
    setError("");
    // auto-advance
    if (val && idx < 5) {
      const el = document.getElementById(`otp-${idx + 1}`) as HTMLInputElement;
      el?.focus();
    }
    // auto-submit when complete
    if (val && idx === 5) {
      submit(next.join(""));
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      const el = document.getElementById(`otp-${idx - 1}`) as HTMLInputElement;
      el?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      submit(pasted);
    }
  };

  const submit = async (fullCode?: string) => {
    const otp = fullCode ?? code.join("");
    if (otp.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    const res = await verifyOTP(userUid, otp);
    setLoading(false);
    if (res.ok) {
      onSuccess();
    } else {
      setError(res.error ?? "Verification failed");
      setCode(["", "", "", "", "", ""]);
      const el = document.getElementById("otp-0") as HTMLInputElement;
      el?.focus();
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* back */}
        <button onClick={onCancel} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("action.back")}
        </button>

        <div className="glass-panel rounded-3xl border border-line p-8 shadow-2xl">
          {/* lock icon */}
          <div className="mb-6 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30"
            >
              <ShieldCheck className="h-8 w-8" />
            </motion.div>

            <h2 className="text-xl font-bold tracking-tight text-ink">Secure Verification</h2>
            <p className="mt-1.5 text-sm text-muted">
              Enter the 6-digit code sent to
            </p>
            <p className="text-sm font-semibold text-brand-600">{userEmail}</p>
          </div>

          {/* OTP inputs */}
          <div className="mb-5 flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInput(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading || sending}
                className="h-14 w-12 rounded-xl border-2 border-line bg-surface text-center text-xl font-bold text-ink transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:opacity-50"
              />
            ))}
          </div>

          {/* error */}
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-600 dark:bg-rose-500/10">
              {error}
            </motion.p>
          )}

          {/* timer / resend */}
          <div className="mb-5 flex items-center justify-center gap-2 text-xs text-muted">
            {!canResend ? (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Code expires in <span className="font-mono font-bold text-ink">{fmtTime(secondsLeft)}</span>
              </span>
            ) : (
              <button onClick={sendOTP} disabled={sending} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
                Resend code
              </button>
            )}
          </div>

          {/* verify button */}
          <button
            onClick={() => submit()}
            disabled={loading || sending || code.join("").length !== 6}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending code...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Verify & Access
              </>
            )}
          </button>

          <p className="mt-4 text-center text-[10px] text-faint">
            Maximum 5 attempts · Lockout after failures · Single use
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
