import { Lock, Crown } from "lucide-react";
import { Button } from "./ui";

interface FeatureLockOverlayProps {
  title: string;
  description: string;
  requiredPlan?: "pro" | "enterprise";
}

export function FeatureLockOverlay({
  title,
  description,
  requiredPlan = "pro",
}: FeatureLockOverlayProps) {
  const handleUpgradeClick = () => {
    window.dispatchEvent(new CustomEvent("navigate", { detail: "upgrade" }));
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface/75 backdrop-blur-md p-6 text-center select-none animate-fade-in">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/15 animate-bounce">
        <Lock className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
        {title}
      </h3>
      <p className="mt-3 max-w-md text-xs leading-relaxed text-muted sm:text-sm">
        {description}
      </p>
      <div className="mt-4 flex items-center gap-1.5 justify-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Crown className="h-4 w-4 text-amber-500" />
        <span>
          {requiredPlan === "enterprise"
            ? "تتطلب الباقة المؤسسية (Enterprise)"
            : "تتطلب الباقة الاحترافية (Pro) أو المؤسسية"}
        </span>
      </div>
      <Button
        onClick={handleUpgradeClick}
        className="mt-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-amber-600/20 px-6 py-3 rounded-xl transition hover:-translate-y-0.5 cursor-pointer"
      >
        ترقية الاشتراك الآن
      </Button>
    </div>
  );
}
