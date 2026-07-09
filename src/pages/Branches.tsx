import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, MapPin, Phone, ArrowRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PageHeader, Button, Card, Input, Field, Badge, Modal, EmptyState, pushToast } from "../components/ui";
import { FeatureLockOverlay } from "../components/FeatureLockOverlay";
import type { Branch } from "../lib/types";
import { now, uid, seedDb, emptyDb, persistDb } from "../lib/db";
import { cn } from "../utils/cn";

export function Branches() {
  const { db, t, upsert, remove, switchBranch, currentBranchId, canUseFeature } = useApp();
  const isLocked = !canUseFeature("multi_branch");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<Branch>({ id: "", name: "", address: "", phone: "", manager: "", isMain: false, lastUpdated: now() });

  const openCreate = () => {
    setForm({ id: "", name: "", address: "", phone: "", manager: "", isMain: false, lastUpdated: now() });
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (b: Branch) => {
    setForm({ ...b });
    setEditing(b);
    setOpen(true);
  };
  const save = () => {
    if (!form.name.trim()) return;
    const isNew = !editing;
    const branchId = form.id || uid("branch");
    const branch: Branch = { ...form, id: branchId, lastUpdated: now() };
    upsert("branches", branch);
    // Seed fresh isolated data for the new branch
    if (isNew) {
      const isDemo = db.profile.centerId === "demo-center-futureminds";
      const seed = isDemo ? seedDb(branchId) : emptyDb(`${db.profile.centerId}_${branchId}`, form.name);
      seed.profile.name = form.name;
      persistDb(`${db.profile.centerId}_${branchId}`, seed);
    }
    pushToast(t("toast.saved"));
    setOpen(false);
  };
  const set = <K extends keyof Branch>(k: K, v: Branch[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="relative">
      <div className={cn("animate-fade-in space-y-5", isLocked && "pointer-events-none blur-sm select-none")}>
      <PageHeader title={t("branch.title")} subtitle={t("branch.subtitle")}
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />{t("branch.new")}</Button>} />

      {/* info banner */}
      <div className="flex items-center gap-3 rounded-xl border border-brand-200/50 bg-brand-50/60 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10">
        <Building2 className="h-5 w-5 shrink-0 text-brand-500" />
        <p className="text-xs text-brand-700 dark:text-brand-300">
          {t("branch.subtitle")} — {t("privacy.isolation")}
        </p>
      </div>

      {db.branches.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Building2 className="h-6 w-6" />} title={t("branch.empty")} action={<Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />{t("branch.new")}</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {db.branches.map((b) => {
            const isActive = b.id === currentBranchId;
            return (
              <Card key={b.id} className={cn("card-hover p-5", isActive && "ring-2 ring-brand-400")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-ink">{b.name}</p>
                        {b.isMain && <Badge tone="brand">{t("branch.main")}</Badge>}
                        {isActive && <Badge tone="success">●</Badge>}
                      </div>
                      {b.manager && <p className="truncate text-[11px] text-muted">{b.manager}</p>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  {b.address && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-faint" />{b.address}</p>}
                  {b.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-faint" />{b.phone}</p>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  {!isActive ? (
                    <Button size="sm" variant="subtle" onClick={() => switchBranch(b.id)}>
                      {t("action.view")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  ) : (
                    <Badge tone="success">{t("status.online")}</Badge>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    {!b.isMain && <Button variant="ghost" size="icon" onClick={() => { remove("branches", b.id); pushToast(t("toast.deleted")); }}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("branch.edit") : t("branch.new")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button onClick={save}>{t("action.save")}</Button></>}>
        <div className="space-y-3">
          <Field label={t("branch.name")} required><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Branch / Downtown" /></Field>
          <Field label={t("branch.manager")}><Input value={form.manager ?? ""} onChange={(e) => set("manager", e.target.value)} /></Field>
          <Field label={t("branch.address")}><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label={t("branch.phone")}><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
      </Modal>
      </div>

      {isLocked && (
        <FeatureLockOverlay
          title="إدارة الفروع مغلقة"
          description="إدارة فروع متعددة معزولة بيانات كل فرع تتطلب الباقة المؤسسية (Enterprise). طوّر اشتراكك لفتح إدارة الفروع والمزامنة متعددة المواقع."
          requiredPlan="enterprise"
        />
      )}
    </div>
  );
}
