import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  Palette, Type, Image as ImageIcon, Upload, Trash2, Plus, Copy,
  ChevronLeft, ChevronRight, Check, Layers, Crosshair, Phone,
  QrCode, Barcode, ArrowUpDown, Crown, Sparkles, RotateCw, Calendar,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Modal, Button, Input, Field, Toggle, pushToast } from "./ui";
import { IdCard } from "./IdCard";
import { cn } from "../utils/cn";
import {
  defaultTheme, STYLE_PRESETS, mergeTheme, fileToDataUrl, resolveThemeForStudent,
  FONT_OPTIONS,
} from "../lib/cardTheme";
import type { CardTheme, Student } from "../lib/types";

type ScopeType = "all" | "stage" | "grade" | "teacher" | "student";
const SCOPE_AR: Record<ScopeType, string> = { all: "كل الطلاب", stage: "مرحلة", grade: "صف", teacher: "مدرس", student: "طالب" };
const STEPS = [
  { id: 1, ar: "الشكل والألوان", en: "Shape & Colors", icon: Palette },
  { id: 2, ar: "الهوية والشعار", en: "Branding & Logo", icon: Type },
  { id: 3, ar: "البيانات والـ QR", en: "Data & QR", icon: Layers },
  { id: 4, ar: "ظهر الكارت", en: "Back face", icon: ImageIcon },
] as const;

export function IdCardCustomizer({ open, onClose, previewStudent }: { open: boolean; onClose: () => void; previewStudent: Student | null }) {
  const { db, lang, cardThemes, activeCardTheme, setActiveCardTheme, upsert, remove } = useApp();
  const ar = lang === "ar";

  const themes = cardThemes;
  const active = themes.find((t) => t.id === activeCardTheme) ?? themes[0];
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<CardTheme | null>(null);
  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [scopeValue, setScopeValue] = useState("");
  // ALL hooks must be declared BEFORE any early return (Rules of Hooks)
  const fileRef = useRef<HTMLInputElement>(null);
  const frontImgRef = useRef<HTMLInputElement>(null);
  const backImgRef = useRef<HTMLInputElement>(null);

  // hydrate draft when opening or switching active theme
  useEffect(() => {
    if (open && active) { setDraft({ ...active, fields: { ...active.fields }, labels: { ...active.labels } }); setScopeType(active.scope?.type ?? "all"); setScopeValue(active.scope?.value ?? ""); setStep(1); }
  }, [open, active?.id]);

  const student = previewStudent ?? db.students[0] ?? ({ id: "X8Y2P4", name: "محمد أحمد", grade: "G4", teachers: [], groupIds: [] } as unknown as Student);
  // defer the preview theme so rapid color-picking stays smooth (no jank)
  const previewTheme = useDeferredValue(draft ?? resolveThemeForStudent(db, student));
  const flipped = step === 4; // auto-flip to back on the back-face step

  if (!open || !draft) return null;

  const patch = (p: Partial<CardTheme>) => setDraft((d) => d ? mergeTheme(d, p) : d);
  const setLabel = (k: string, v: string) => setDraft((d) => d ? mergeTheme(d, { labels: { ...d.labels, [k]: v } }) : d);
  const setField = (k: string, v: boolean) => setDraft((d) => d ? mergeTheme(d, { fields: { ...d.fields, [k]: v } }) : d);
  const moveField = (k: string, dir: -1 | 1) => setDraft((d) => {
    if (!d) return d;
    const order = d.fieldOrder?.length ? [...d.fieldOrder] : ["stage", "grade", "section", "teachers", "fee"];
    const i = order.indexOf(k); if (i < 0) return d;
    const j = i + dir; if (j < 0 || j >= order.length) return d;
    [order[i], order[j]] = [order[j], order[i]];
    return mergeTheme(d, { fieldOrder: order });
  });

  const onLogo = async (file?: File) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { pushToast("حجم الصورة كبير (الحد 1.5MB)", "error"); return; }
    patch({ logoImage: await fileToDataUrl(file), showLogo: true });
    pushToast("تم رفع الشعار");
  };

  const onFaceImage = async (face: "front" | "back", file?: File) => {
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) { pushToast(ar ? "حجم الصورة كبير (الحد 2.5MB)" : "Image too large (max 2.5MB)", "error"); return; }
    patch(face === "front" ? { frontImage: await fileToDataUrl(file) } : { backImage: await fileToDataUrl(file) });
    pushToast(ar ? "تم رفع صورة الكارت" : "Card image uploaded");
  };

  // dynamic back instructions
  const instructions = draft.instructions ?? [
    draft.labels.instructions0, draft.labels.instructions1, draft.labels.instructions2,
    draft.labels.instructions3, draft.labels.instructions4,
  ].filter(Boolean);
  const setInstruction = (i: number, val: string) => {
    const arr = [...instructions]; arr[i] = val; patch({ instructions: arr });
  };
  const addInstruction = () => { if (instructions.length < 6) patch({ instructions: [...instructions, ""] }); };
  const removeInstruction = (i: number) => { patch({ instructions: instructions.filter((_, j) => j !== i) }); };

  const save = () => {
    const finalTheme = { ...draft, scope: { type: scopeType, value: scopeValue || undefined } };
    upsert("cardThemes", finalTheme);
    setActiveCardTheme(finalTheme.id);
    pushToast("تم حفظ واعتماد التعديلات ✓");
    onClose();
  };
  const cancel = () => { pushToast("تم تجاهل التعديلات", "info"); onClose(); };

  const newTheme = () => { const t = defaultTheme(`قالب ${themes.length + 1}`); upsert("cardThemes", t); setActiveCardTheme(t.id); };
  const dupTheme = () => { if (!active) return; const base = defaultTheme(active.name + " (نسخة)"); const t = { ...base, ...active, id: base.id, name: active.name + " (نسخة)" }; upsert("cardThemes", t); setActiveCardTheme(t.id); };

  const fieldList = (draft.fieldOrder?.length ? draft.fieldOrder : ["stage", "grade", "section", "teachers", "fee"]);

  return (
    <Modal open={open} onClose={cancel} title={ar ? "استوديو تصميم الكارت" : "Card Design Studio"} size="xl">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* ===== LEFT: steps ===== */}
        <div className="space-y-4">
          {/* template bar */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={active?.id ?? ""} onChange={(e) => setActiveCardTheme(e.target.value)}
              className="h-9 max-w-[180px] flex-1 rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-ink">
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button size="sm" variant="subtle" onClick={newTheme}><Plus className="h-3.5 w-3.5" />{ar ? "قالب جديد" : "New"}</Button>
            <Button size="sm" variant="subtle" onClick={dupTheme}><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { if (themes.length > 1) { remove("cardThemes", active.id); } }} disabled={themes.length <= 1}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
          </div>

          {/* step tabs */}
          <div className="flex gap-1 rounded-xl border border-line bg-elevated/40 p-1">
            {STEPS.map((s) => (
              <button key={s.id} onClick={() => setStep(s.id)}
                className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition", step === s.id ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:text-ink")}>
                <s.icon className="h-3.5 w-3.5" />{ar ? s.ar : s.en}
              </button>
            ))}
          </div>

          <div className="max-h-[52vh] space-y-4 overflow-y-auto pe-1">
            {/* STEP 1: shape & colors */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold text-ink">{ar ? "النمط الأساسي" : "Base style"}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLE_PRESETS.map((p) => {
                      const on = draft.bodyBg?.toLowerCase() === p.patch.bodyBg?.toLowerCase();
                      return (
                        <button key={p.key} onClick={() => patch({ ...p.patch, accent: draft.accent })}
                          className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-2 transition", on ? "border-brand-500 ring-1 ring-brand-500/20" : "border-line hover:bg-elevated")}>
                          <span className="h-8 w-full overflow-hidden rounded-md ring-1 ring-black/10" style={{ background: `linear-gradient(135deg,${p.patch.bodyBg},${p.patch.backFrom})` }}>
                            <span className="block h-2 w-full" style={{ background: p.accent }} />
                          </span>
                          <span className="text-[10px] font-semibold text-ink">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-line p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink"><Palette className="h-4 w-4 text-brand-600" />{ar ? "اللون الأساسي (Accent)" : "Accent color"}</p>
                  <div className="flex items-center gap-2">
                    <input type="color" value={draft.accent} onChange={(e) => patch({ accent: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-1" />
                    <span className="font-mono text-xs text-muted">{draft.accent}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["#c9a227", "#0ea5e9", "#059669", "#4f46e5", "#e11d48", "#7c3aed", "#0f172a", "#b45309"].map((c) => (
                      <button key={c} onClick={() => patch({ accent: c })} className="h-6 w-6 rounded-full ring-1 ring-black/10 transition hover:scale-110" style={{ background: c }} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ColorPick label={ar ? "خلفية الوجه" : "Front bg"} v={draft.bodyBg} on={(v) => patch({ bodyBg: v })} />
                  <ColorPick label={ar ? "لون النص" : "Text color"} v={draft.bodyText} on={(v) => patch({ bodyText: v })} />
                  <ColorPick label={ar ? "لون العناوين" : "Label color"} v={draft.labelText} on={(v) => patch({ labelText: v })} />
                  <ColorPick label={ar ? "خلفية الشعار (Header)" : "Header from"} v={draft.headerFrom} on={(v) => patch({ headerFrom: v })} />
                </div>

                <Field label={ar ? "انحناء الزوايا" : "Corner radius"}>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={14} value={draft.cornerRadius} onChange={(e) => patch({ cornerRadius: +e.target.value })} className="flex-1 accent-brand-600" />
                    <span className="w-12 text-center text-xs font-bold text-ink">{draft.cornerRadius}<span className="text-faint">mm</span></span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {[{ l: ar ? "حاد" : "Sharp", v: 0 }, { l: ar ? "ناعم" : "Soft", v: 6 }, { l: ar ? "دائري" : "Round", v: 12 }].map((o) => (
                      <button key={o.v} onClick={() => patch({ cornerRadius: o.v })} className={cn("rounded-md border px-2 py-1 text-[10px] font-semibold", draft.cornerRadius === o.v ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15" : "border-line text-muted")}>{o.l}</button>
                    ))}
                  </div>
                </Field>

                <Field label={ar ? "نوع الخط" : "Font family"}>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FONT_OPTIONS.map((f) => (
                      <button key={f.key} onClick={() => patch({ fontKey: f.key })}
                        className={cn("rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition", draft.fontKey === f.key ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}
                        style={{ fontFamily: f.css }}>{f.ar}</button>
                    ))}
                  </div>
                </Field>

                <div className="rounded-xl border border-line p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink"><Sparkles className="h-4 w-4 text-brand-600" />{ar ? "خلفية / علامة مائية (Watermark)" : "Background / Watermark"}</p>
                  <div className="flex items-center gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                    <div className="h-10 w-10 overflow-hidden rounded-lg border border-line bg-white">{draft.bgImage && <img src={draft.bgImage} className="h-full w-full object-cover" alt="" />}</div>
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" />{ar ? "رفع خلفية" : "Upload"}</Button>
                    {draft.bgImage && <Button size="sm" variant="ghost" onClick={() => patch({ bgImage: undefined })}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
                  </div>
                  <Field label={ar ? "شفافية العلامة المائية (%)" : "Watermark opacity (%)"} className="mt-3">
                    <input type="range" min={0} max={20} value={draft.watermarkOpacity ?? 4} onChange={(e) => patch({ watermarkOpacity: +e.target.value })} className="w-full accent-brand-600" />
                  </Field>
                  <p className="mt-1 text-[10px] text-faint">{ar ? "0 = مخفي تمامًا · العلامة (قبعة التخرج) تتوسط الكارت دائمًا" : "0 = fully hidden · the cap watermark is always centered"}</p>
                </div>

                <Field label={ar ? "الإطار الخارجي (Border)" : "Outer border"}>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={3} step={0.5} value={draft.borderWidth ?? 0} onChange={(e) => patch({ borderWidth: +e.target.value })} className="flex-1 accent-brand-600" />
                    <input type="color" value={draft.borderColor ?? "#d4af37"} onChange={(e) => patch({ borderColor: e.target.value })} className="h-8 w-9 cursor-pointer rounded border border-line bg-transparent p-0" />
                  </div>
                </Field>
              </div>
            )}

            {/* STEP 2: branding & logo */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-ink"><Crown className="h-4 w-4 text-amber-500" />{ar ? "شعار السنتر" : "Center logo"}</span>
                    <Toggle checked={draft.showLogo} onChange={(v) => patch({ showLogo: v })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                      {draft.logoImage ? <img src={draft.logoImage} className="h-full w-full object-cover" alt="logo" /> : <Crown className="h-6 w-6 text-amber-500" />}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" />{ar ? "رفع صورة" : "Upload"}</Button>
                    {draft.logoImage && <Button size="sm" variant="ghost" onClick={() => patch({ logoImage: undefined })}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
                  </div>
                  <Input className="mt-2" value={draft.logoText} onChange={(e) => patch({ logoText: e.target.value })} placeholder={ar ? "حروف الشعار (إذا لا توجد صورة)" : "Logo letters"} />
                </div>

                <Field label={ar ? "حجم الشعار" : "Logo size"}>
                  <input type="range" min={5} max={14} value={draft.logoSize ?? 8} onChange={(e) => patch({ logoSize: +e.target.value })} className="w-full accent-brand-600" />
                </Field>

                <Field label={ar ? "اسم السنتر على الكارت" : "Center name on card"}>
                  <Input value={draft.customCenterName ?? ""} onChange={(e) => patch({ customCenterName: e.target.value })} placeholder={ar ? "اتركه فارغًا لاستخدام اسم المركز" : "Leave empty to use center name"} />
                </Field>

                <div className="flex items-center justify-between rounded-xl border border-line p-3">
                  <span className="text-xs font-bold text-ink">{ar ? "إظهار اسم الأكاديمية" : "Show academy name"}</span>
                  <Toggle checked={draft.showAcademyName !== false} onChange={(v) => patch({ showAcademyName: v })} />
                </div>

                {draft.showAcademyName !== false && (
                  <Field label={ar ? "العنوان الفرعي" : "Academy subtitle"}>
                    <Input value={draft.labels.academyRole} onChange={(e) => setLabel("academyRole", e.target.value)} placeholder="بطاقة هوية الطالب / Student ID Card" />
                  </Field>
                )}
                <div className="flex items-center justify-between rounded-xl border border-line p-3">
                  <span className="text-xs font-bold text-ink">{ar ? "إظهار العنوان العلوي" : "Show top title"}</span>
                  <Toggle checked={draft.showCardTitle !== false} onChange={(v) => patch({ showCardTitle: v })} />
                </div>
                {draft.showCardTitle !== false && (
                  <Field label={ar ? "نص العنوان العلوي" : "Top title text"}>
                    <Input value={draft.labels.cardTitle} onChange={(e) => setLabel("cardTitle", e.target.value)} placeholder="ID CARD" />
                  </Field>
                )}
              </div>
            )}

            {/* STEP 3: data & QR */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-line p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink"><Layers className="h-4 w-4 text-brand-600" />{ar ? "إظهار / إخفاء وترتيب الحقول" : "Show / hide & reorder fields"}</p>
                  <div className="space-y-1.5">
                    {fieldList.map((k) => (
                      <div key={k} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                        <Toggle checked={!!draft.fields[k]} onChange={(v) => setField(k, v)} />
                        <span className="flex-1 truncate text-xs font-medium text-ink">{draft.labels[k] ?? k}</span>
                        {k !== "teachers" && (
                          <div className="flex gap-0.5">
                            <button onClick={() => moveField(k, -1)} className="rounded p-1 text-muted hover:bg-elevated hover:text-ink" title={ar ? "أعلى" : "Up"}><ArrowUpDown className="h-3.5 w-3.5 rotate-180" /></button>
                            <button onClick={() => moveField(k, 1)} className="rounded p-1 text-muted hover:bg-elevated hover:text-ink" title={ar ? "أسفل" : "Down"}><ArrowUpDown className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(["stage", "grade", "section", "fee", "code", "status", "issueDate", "validUntil"] as const).map((k) => (
                    <Input key={k} value={draft.labels[k] ?? ""} onChange={(e) => setLabel(k, e.target.value)} placeholder={k} className="text-xs" />
                  ))}
                </div>

                <div className="rounded-xl border border-line p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink"><QrCode className="h-4 w-4 text-brand-600" />{ar ? "رمز QR والباركود" : "QR & Barcode"}</p>
                  <Field label={ar ? "حجم الـ QR" : "QR size"}>
                    <input type="range" min={11} max={18} value={draft.qrSize ?? 15} onChange={(e) => patch({ qrSize: +e.target.value })} className="w-full accent-brand-600" />
                  </Field>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-ink"><Barcode className="h-4 w-4 text-muted" />{ar ? "إظهار الباركود" : "Show barcode"}</span>
                    <Toggle checked={draft.showBarcode !== false} onChange={(v) => patch({ showBarcode: v })} />
                  </div>
                  <Input className="mt-2" value={draft.labels.scanHint} onChange={(e) => setLabel("scanHint", e.target.value)} placeholder={ar ? "نص أسفل QR" : "Scan hint"} />
                </div>

                {/* custom validity dates */}
                <div className="rounded-xl border border-line p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><Calendar className="h-4 w-4 text-brand-600" />{ar ? "تاريخ الصلاحية (اختياري)" : "Validity dates (optional)"}</p>
                  <p className="mb-2 text-[10px] text-faint">{ar ? "اتركها فارغة لاستخدام تاريخ التسجيل والمدفوعات تلقائيًا." : "Leave empty to auto-use registration & payment dates."}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={ar ? "تاريخ البداية" : "Start date"}>
                      <input type="date" value={draft.customStart ?? ""} onChange={(e) => patch({ customStart: e.target.value || undefined })} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink" />
                    </Field>
                    <Field label={ar ? "تاريخ النهاية" : "End date"}>
                      <input type="date" value={draft.customEnd ?? ""} onChange={(e) => patch({ customEnd: e.target.value || undefined })} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink" />
                    </Field>
                  </div>
                </div>

                {/* full-card image override */}
                <div className="rounded-xl border border-line p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><ImageIcon className="h-4 w-4 text-brand-600" />{ar ? "صورة كاملة للكارت (بديل التصميم)" : "Full card image (override)"}</p>
                  <p className="mb-2 text-[10px] text-faint">{ar ? "ارفع صورة جاهزة للوجه الأمامي/الخلفي بدل التصميم التلقائي." : "Upload a ready image for either face instead of the auto-design."}</p>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[11px] text-muted">{ar ? "ملاءمة الصورة" : "Fit"}</label>
                    <div className="flex gap-1">
                      {(["cover", "contain"] as const).map((f) => (
                        <button key={f} onClick={() => patch({ imageFit: f })} className={cn("rounded-md border px-2 py-1 text-[10px] font-semibold", (draft.imageFit ?? "cover") === f ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15" : "border-line text-muted")}>{f === "cover" ? (ar ? "تغطية" : "Cover") : (ar ? "احتواء" : "Contain")}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-line p-2">
                      <input ref={frontImgRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFaceImage("front", e.target.files?.[0])} />
                      <div className="mb-1 h-12 overflow-hidden rounded border border-line bg-white">{draft.frontImage && <img src={draft.frontImage} className="h-full w-full object-cover" alt="" />}</div>
                      <div className="flex items-center justify-between gap-1">
                        <Button size="sm" variant="secondary" onClick={() => frontImgRef.current?.click()} className="!px-2"><Upload className="h-3 w-3" />{ar ? "أمامي" : "Front"}</Button>
                        {draft.frontImage && <button onClick={() => patch({ frontImage: undefined })} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                    <div className="rounded-lg border border-line p-2">
                      <input ref={backImgRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFaceImage("back", e.target.files?.[0])} />
                      <div className="mb-1 h-12 overflow-hidden rounded border border-line bg-white">{draft.backImage && <img src={draft.backImage} className="h-full w-full object-cover" alt="" />}</div>
                      <div className="flex items-center justify-between gap-1">
                        <Button size="sm" variant="secondary" onClick={() => backImgRef.current?.click()} className="!px-2"><Upload className="h-3 w-3" />{ar ? "خلفي" : "Back"}</Button>
                        {draft.backImage && <button onClick={() => patch({ backImage: undefined })} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: back face */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-ink"><Type className="h-4 w-4 text-brand-600" />{ar ? "تعليمات الاستخدام" : "Usage instructions"}</p>
                    <Button size="sm" variant="subtle" onClick={addInstruction} disabled={instructions.length >= 6}><Plus className="h-3.5 w-3.5" />{ar ? "إضافة" : "Add"}</Button>
                  </div>
                  <div className="space-y-2">
                    {instructions.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="shrink-0 text-[10px] font-bold text-faint">{i + 1}.</span>
                        <Input value={t} onChange={(e) => setInstruction(i, e.target.value)} placeholder={`${ar ? "تعليمة" : "Rule"} ${i + 1}`} className="text-xs" />
                        <button onClick={() => removeInstruction(i)} className="shrink-0 rounded p-1 text-faint hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    {instructions.length === 0 && <p className="py-2 text-center text-[11px] text-faint">{ar ? "لا توجد تعليمات — أضف واحدة" : "No rules — add one"}</p>}
                  </div>
                  <Input className="mt-2" value={draft.labels.caption} onChange={(e) => setLabel("caption", e.target.value)} placeholder={ar ? "نص أسفل QR الخلفي" : "Back QR caption"} />
                </div>

                {/* extra free text */}
                <div className="rounded-xl border border-line p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><Sparkles className="h-4 w-4 text-brand-600" />{ar ? "نصوص إضافية (اختياري)" : "Extra text (optional)"}</p>
                  <p className="mb-2 text-[10px] text-faint">{ar ? "نصوص إضافية تظهر أسفل التعليمات — كل سطر في سطر." : "Extra lines shown below instructions — one per line."}</p>
                  <textarea rows={3} value={draft.labels.extraText ?? ""} onChange={(e) => setLabel("extraText", e.target.value)} placeholder={ar ? "اكتب كل نص في سطر منفصل..." : "Type each line separately..."} className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink focus:border-brand-400 focus:outline-none" />
                </div>

                <div className="rounded-xl border border-line p-3 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-ink"><Phone className="h-4 w-4 text-brand-600" />{ar ? "بيانات التواصل" : "Contact info"}</p>
                  <Input value={draft.labels.supportPhone} onChange={(e) => setLabel("supportPhone", e.target.value)} placeholder={ar ? "رقم الهاتف / الدعم" : "Phone / support"} className="text-xs" />
                  <Input value={draft.labels.website} onChange={(e) => setLabel("website", e.target.value)} placeholder={ar ? "الموقع الإلكتروني" : "Website"} className="text-xs" />
                  <Input value={draft.labels.address} onChange={(e) => setLabel("address", e.target.value)} placeholder={ar ? "العنوان" : "Address"} className="text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ColorPick label={ar ? "ظهر (من)" : "Back from"} v={draft.backFrom} on={(v) => patch({ backFrom: v })} />
                  <ColorPick label={ar ? "ظهر (إلى)" : "Back to"} v={draft.backTo} on={(v) => patch({ backTo: v })} />
                </div>
                <Field label={ar ? "حقوق النشر" : "Copyright footer"}>
                  <Input value={draft.labels.footer} onChange={(e) => setLabel("footer", e.target.value)} placeholder="© {year} — جميع الحقوق محفوظة" className="text-xs" />
                </Field>
              </div>
            )}
          </div>

          {/* scope (always available) */}
          <div className="rounded-xl border border-line p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><Crosshair className="h-4 w-4 text-brand-600" />{ar ? "نطاق التطبيق" : "Apply to"}</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SCOPE_AR) as ScopeType[]).map((st) => (
                <button key={st} onClick={() => setScopeType(st)}
                  className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition", scopeType === st ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "border-line text-muted hover:bg-elevated")}>
                  {SCOPE_AR[st]}
                </button>
              ))}
            </div>
            {scopeType === "stage" && <ScopeSelect value={scopeValue} onChange={setScopeValue} options={[["pre", "تمهيدي"], ["primary", "ابتدائي"], ["prep", "إعدادي"], ["secondary", "ثانوي"]]} />}
            {scopeType === "grade" && <ScopeSelect value={scopeValue} onChange={setScopeValue} options={Array.from(new Set(db.students.map((s) => s.grade).filter(Boolean))).map((g) => [g, g])} />}
            {scopeType === "teacher" && <ScopeSelect value={scopeValue} onChange={setScopeValue} options={db.teachers.map((t) => [t.id, t.name])} />}
            {scopeType === "student" && <ScopeSelect value={scopeValue} onChange={setScopeValue} options={db.students.map((s) => [s.id, `${s.name} — ${s.id}`])} />}
          </div>
        </div>

        {/* ===== RIGHT: live preview ===== */}
        <div className="lg:sticky lg:top-0">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-gradient-to-br from-elevated/40 to-bg p-5">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
              <Sparkles className="h-3 w-3" />{flipped ? (ar ? "الوجه الخلفي" : "Back face") : (ar ? "الوجه الأمامي" : "Front face")}
            </span>
            <div className="w-full max-w-[340px]">
              <IdCard db={db} student={student} theme={previewTheme} flipped={flipped} onFlip={() => setStep(flipped ? 1 : 4)} />
            </div>
            <button onClick={() => setStep(flipped ? 1 : 4)} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-600 hover:underline">
              <RotateCw className="h-3.5 w-3.5" />{ar ? "اقلب الكارت" : "Flip card"}
            </button>
            <p className="flex items-center gap-1 text-center text-[10px] text-faint"><Check className="h-3 w-3 text-emerald-500" />{ar ? "تُحفظ التغييرات محليًا كمسودة حتى الضغط على «حفظ واعتماد»" : "Edits are a local draft until you Save"}</p>
          </div>
        </div>
      </div>

      {/* footer nav */}
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />{ar ? "السابق" : "Back"}
        </Button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => (
            <span key={s.id} className={cn("h-1.5 rounded-full transition-all", step === s.id ? "w-6 bg-brand-600" : step > s.id ? "w-1.5 bg-brand-400" : "w-1.5 bg-line")} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {step < 4 ? (
            <Button onClick={() => setStep((s) => Math.min(4, s + 1))}>{ar ? "التالي" : "Next"}<ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
          ) : (
            <>
              <Button variant="secondary" onClick={cancel}>{ar ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={save}><Check className="h-4 w-4" />{ar ? "حفظ واعتماد" : "Save"}</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ColorPick({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2 py-1.5">
      <input type="color" value={v} onChange={(e) => on(e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
      <span className="truncate text-[11px] text-muted">{label}</span>
    </label>
  );
}
function ScopeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs text-ink">
      <option value="">— اختر —</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
