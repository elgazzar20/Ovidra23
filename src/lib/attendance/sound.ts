/**
 * Sound system (Web Audio API)
 * ============================
 * Generates crisp, instant tones with zero audio-file dependencies. Each outcome
 * has a distinct, recognizable jingle. Honours the user's `soundEnabled` flag.
 */
import type { CaptureErrorReason } from "./types";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  /** Lazily create the AudioContext (must follow a user gesture). */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Resume the context after a user gesture (autoplay policy). */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  /** Play a single tone at a given frequency/duration. */
  private tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.15, delayMs = 0): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationMs / 1000 + 0.02);
  }

  /** Pleasant ascending two-note chime. */
  success(): void {
    this.tone(880, 120, "sine", 0.18, 0);
    this.tone(1320, 160, "sine", 0.16, 90);
  }

  /** Same as success but softer (a re-scan that was already recorded). */
  info(): void {
    this.tone(660, 140, "triangle", 0.12, 0);
  }

  /** Descending error tone. */
  error(): void {
    this.tone(320, 180, "sawtooth", 0.14, 0);
    this.tone(220, 260, "sawtooth", 0.12, 140);
  }

  /** Short buzz for duplicate scans. */
  duplicate(): void {
    this.tone(420, 90, "square", 0.1, 0);
    this.tone(420, 90, "square", 0.1, 140);
  }

  /** Speak a custom phrase using native SpeechSynthesis. */
  speak(text: string, lang: "ar" | "en"): void {
    if (!this.enabled) return;
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const synth = window.speechSynthesis;
        synth.cancel(); // Cancel any current or queued speech to prevent lagging
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === "ar" ? "ar-EG" : "en-US";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
        
        // Find best local voice matching language preference
        const voices = synth.getVoices();
        const preferredVoice = voices.find((v) => v.lang.startsWith(lang === "ar" ? "ar" : "en"));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        synth.speak(utterance);
      }
    } catch {
      // Graceful fallback for environments with disabled speech engines
    }
  }

  /** Dispatch the right sound for an outcome reason. */
  playFor(reason: CaptureErrorReason | "ok" | "duplicate" | "info"): void {
    switch (reason) {
      case "ok": this.success(); break;
      case "duplicate": this.duplicate(); break;
      case "info": this.info(); break;
      default: this.error();
    }
  }
}

export const sound = new SoundEngine();
