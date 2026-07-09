import { cn } from "../utils/cn";
import type { Student } from "../lib/types";
import type { PaymentStatus } from "../lib/analytics";

const isAr = (lang: string) => lang === "ar";

/**
 * Colored box (مربع ملون) showing whether the student pays
 * in advance (مقدم) or deferred (مؤخر).
 */
export function PaymentTypeBadge({
  student,
  lang,
  className,
}: {
  student: Student;
  lang: string;
  className?: string;
}) {
  const ar = isAr(lang);
  if (student.paymentType === "deferred") {
    return (
      <span
        title={ar ? "يدفع في نهاية الشهر" : "Pays at month end"}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
          className,
        )}
      >
        {ar ? "مؤخر" : "Deferred"}
      </span>
    );
  }
  return (
    <span
      title={ar ? "يدفع في بداية الشهر" : "Pays at month start"}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200",
        className,
      )}
    >
      {ar ? "مقدم" : "Advance"}
    </span>
  );
}

/**
 * Mark shown next to the name: a private (خاص) student gets a violet badge,
 * a group (مجموعة) student gets a sky badge. Pass `onlyPrivate` to render the
 * badge only for private students (matches "علامه بجانب الاسم لو هو خاص فقط").
 */
export function EnrollmentBadge({
  student,
  lang,
  onlyPrivate = false,
  className,
}: {
  student: Student;
  lang: string;
  onlyPrivate?: boolean;
  className?: string;
}) {
  const ar = isAr(lang);
  if (student.enrollmentType === "private") {
    return (
      <span
        title={ar ? "حصة خاصة" : "Private session"}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
          className,
        )}
      >
        {ar ? "خاص" : "Private"}
      </span>
    );
  }
  if (!onlyPrivate && student.enrollmentType === "group") {
    return (
      <span
        title={ar ? "مجموعة" : "Group session"}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300",
          className,
        )}
      >
        {ar ? "مجموعة" : "Group"}
      </span>
    );
  }
  return null;
}

/**
 * Payment status pill: paid / unpaid / overdue (+ day-7 warning).
 */
export function PaymentStatusBadge({
  status,
  lang,
  exempt = false,
  className,
}: {
  status: PaymentStatus;
  lang: string;
  exempt?: boolean;
  className?: string;
}) {
  const ar = isAr(lang);
  if (exempt) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-elevated px-2 py-0.5 text-[10px] font-semibold leading-5 text-muted",
          className,
        )}
      >
        {ar ? "معفو" : "Exempt"}
      </span>
    );
  }
  if (status.status === "paid") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          className,
        )}
      >
        {ar ? "مدفوع" : "Paid"}
      </span>
    );
  }
  if (status.status === "overdue") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
          className,
        )}
      >
        {ar ? `متأخر ${status.monthsLate} شهور` : `${status.monthsLate}mo late`}
      </span>
    );
  }
  if (status.warningDay7) {
    return (
      <span
        title={ar ? "مر يوم 7 ولم يدفع" : "Past day 7, still unpaid"}
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold leading-5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          className,
        )}
      >
        {ar ? "غير مدفوع" : "Unpaid"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold leading-5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        className,
      )}
    >
      {ar ? "غير مدفوع" : "Unpaid"}
    </span>
  );
}
