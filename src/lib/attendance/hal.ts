/**
 * Hardware Abstraction Layer (HAL)
 * =================================
 * One unified event stream for ALL input devices. The rest of the system never
 * cares *how* a scan arrived — it just listens to `onScan`.
 *
 * Supported, auto-detected sources (no configuration required):
 *   1. USB HID scanners (Zebra, Honeywell, Netum, Tera, Eyoyo, Symcode…)
 *   2. Bluetooth HID scanners
 *   3. 2.4GHz wireless dongle scanners
 *   → All of the above present as **Keyboard Wedge** devices: they "type" the
 *     code very fast, then press Enter. We detect this rapid typed burst.
 *   4. Web Serial / COM scanners (opt-in via navigator.serial)
 *   5. Camera scanning (BarcodeDetector) — provided by the caller component.
 *   6. NFC / manual entry — pushed in by the caller via `inject()`.
 *
 * The wedge detector distinguishes a scanner from a human typing by measuring
 * the average interval between keystrokes (scanners are < 30ms; humans > 80ms).
 */
import type { InputSource, ScanEvent } from "./types";

type Listener = (e: ScanEvent) => void;

/** Tunables for the wedge heuristic. */
const MAX_AVG_INTERVAL_MS = 35; // scanner-like cadence
const MIN_CHARS = 3; // ignore trivial inputs
const BURST_TIMEOUT_MS = 80; // gap that ends a burst

export class HardwareLayer {
  private listeners = new Set<Listener>();
  private buffer = "";
  private timestamps: number[] = [];
  private burstTimer: number | null = null;
  private wedgeEnabled = false;
  private active = false;
  private serialPort: any = null;
  private serialReader: any = null;
  private serialLine = "";

  /** Start listening for wedge + (optionally) serial input. */
  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.startWedge();
    await this.startSerial().catch(() => {/* serial optional */});
  }

  /** Stop all listeners and release hardware. */
  stop(): void {
    this.active = false;
    this.stopWedge();
    this.stopSerial();
    this.buffer = "";
    this.timestamps = [];
  }

  /** Subscribe to decoded scans. Returns an unsubscribe function. */
  onScan(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Push a payload from a non-wedge source (camera, NFC, manual). */
  inject(payload: string, source: InputSource = "manual"): void {
    const clean = payload.trim();
    if (!clean) return;
    this.emit(clean, source);
  }

  /** Enable/disable the keyboard-wedge listener (so text inputs can type freely). */
  setWedgeEnabled(enabled: boolean): void {
    this.wedgeEnabled = enabled;
  }

  /** Is the wedge listener currently armed? */
  get isWedgeEnabled(): boolean {
    return this.wedgeEnabled;
  }

  // ----------------------------- wedge -----------------------------
  private startWedge(): void {
    this.wedgeEnabled = true;
    window.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("blur", this.resetBurst);
  }

  private stopWedge(): void {
    this.wedgeEnabled = false;
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("blur", this.resetBurst);
    if (this.burstTimer) { clearTimeout(this.burstTimer); this.burstTimer = null; }
  }

  private resetBurst = (): void => {
    this.buffer = "";
    this.timestamps = [];
    if (this.burstTimer) { clearTimeout(this.burstTimer); this.burstTimer = null; }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.wedgeEnabled) return;

    // Enter completes a wedge burst.
    if (e.key === "Enter") {
      if (this.buffer.length >= MIN_CHARS) {
        this.flush("wedge");
      } else {
        this.resetBurst();
      }
      return;
    }

    // Ignore modifier-only / function keys / navigation keys.
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    // Accumulate the character + its timestamp.
    this.buffer += e.key;
    this.timestamps.push(performance.now());

    // Extend the burst window.
    if (this.burstTimer) clearTimeout(this.burstTimer);
    this.burstTimer = window.setTimeout(() => {
      // If the burst died before Enter, still try to flush if it looks scanner-like.
      if (this.buffer.length >= MIN_CHARS && this.cadenceIsScannerLike()) {
        this.flush("wedge");
      } else {
        this.resetBurst();
      }
    }, BURST_TIMEOUT_MS);
  };

  /** True if the collected keystrokes came faster than a human could type. */
  private cadenceIsScannerLike(): boolean {
    if (this.timestamps.length < 2) return this.buffer.length >= MIN_CHARS;
    const span = this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
    const avg = span / (this.timestamps.length - 1);
    return avg <= MAX_AVG_INTERVAL_MS;
  }

  private flush(source: InputSource): void {
    const payload = this.buffer.trim();
    this.resetBurst();
    if (payload) this.emit(payload, source);
  }

  // ----------------------------- serial -----------------------------
  /** Web Serial API (Chrome/Edge). Returns true if a port was opened. */
  async startSerial(): Promise<boolean> {
    const nav = navigator as any;
    if (!nav.serial) return false;
    try {
      const port = await nav.serial.requestPort?.();
      if (!port) return false;
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
      this.serialPort = port;
      this.serialLine = "";
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(() => {});
      this.serialReader = decoder.readable.getReader();
      this.readSerialLoop();
      return true;
    } catch {
      return false;
    }
  }

  private async readSerialLoop(): Promise<void> {
    if (!this.serialReader) return;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (!value) continue;
        this.serialLine += value;
        let nl: number;
        while ((nl = this.serialLine.indexOf("\n")) >= 0 || (nl = this.serialLine.indexOf("\r")) >= 0) {
          const line = this.serialLine.slice(0, nl).trim();
          this.serialLine = this.serialLine.slice(nl + 1);
          if (line) this.emit(line, "serial");
        }
      }
    } catch {
      /* port disconnected */
    }
  }

  private stopSerial(): void {
    try { this.serialReader?.cancel?.(); } catch { /* ignore */ }
    try { this.serialPort?.close?.(); } catch { /* ignore */ }
    this.serialReader = null;
    this.serialPort = null;
    this.serialLine = "";
  }

  // ----------------------------- emit -----------------------------
  private emit(payload: string, source: InputSource): void {
    const evt: ScanEvent = { payload, source, at: Date.now() };
    this.listeners.forEach((fn) => fn(evt));
  }
}

/** Process-wide singleton (a single physical input bus). */
export const hardware = new HardwareLayer();
