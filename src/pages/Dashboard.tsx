import { useMemo, useState, useEffect } from "react";
import {
  GraduationCap, Boxes, TrendingUp, TrendingDown, Wallet, Coins,
  Clock, AlertCircle, ArrowRight, Crown, Building2, Sparkles, Users, Banknote,
  ShieldCheck, RefreshCw
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../utils/cn";
import { PageHeader, Card, Badge, EmptyState, Modal, Input, Field, Button } from "../components/ui";
import { StatCard, ChartCard } from "../components/widgets";
import { LineAreaChart, BarChart } from "../components/charts";
import {
  monthlyRevenue, monthlyExpenses, monthlyCenterIncome, monthlySeries,
  attendanceRate, attendanceTrend, gradeDistribution, balanceDue,
  teacherRevenue, currencySymbol, formatMoney,
} from "../lib/analytics";
import { dayOfWeekOf } from "../lib/db";
import { GRADES, formatTime12 } from "../lib/constants";

// Secure Clock Widget Component to isolate ticking from main Dashboard
function SecureClockWidget({
  timeOffset,
  isAr,
  onClick,
}: {
  timeOffset: number;
  isAr: boolean;
  onClick: () => void;
}) {
  const [currentTime, setCurrentTime] = useState(() => Date.now() + timeOffset);

  useEffect(() => {
    setCurrentTime(Date.now() + timeOffset);
    const interval = setInterval(() => {
      setCurrentTime(Date.now() + timeOffset);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeOffset]);

  const formattedTime = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(currentTime));

  const formattedDate = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(currentTime));

  return (
    <div className="flex flex-col items-end gap-1">
      <div 
        onClick={onClick}
        className={cn(
          "group flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-1.5 shadow-[var(--shadow-sm)] transition-all hover:bg-elevated hover:border-brand-500/30",
          timeOffset !== 0 && "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
        )}
        title={isAr ? "تعديل وقت وتاريخ النظام محلياً" : "Adjust local system time"}
      >
        <div className="flex items-center gap-1.5">
          <Clock className={cn("h-3.5 w-3.5 text-brand-500", timeOffset !== 0 ? "text-amber-500" : "animate-pulse")} />
          <span className="font-mono text-xs font-bold text-ink tracking-wider">
            {formattedTime}
          </span>
        </div>
        <div className="h-3 w-px bg-line" />
        <span className="text-[11px] font-medium text-muted group-hover:text-ink">
          {formattedDate}
        </span>
        {timeOffset !== 0 ? (
          <Badge tone="warning" className="text-[9px] px-1.5 py-0 font-bold">
            {isAr ? "تعديل نشط" : "Offset Active"}
          </Badge>
        ) : (
          <Badge tone="success" className="text-[9px] px-1.5 py-0 gap-0.5 font-bold">
            <ShieldCheck className="h-2.5 w-2.5" />
            {isAr ? "محمي" : "Secure"}
          </Badge>
        )}
      </div>
    </div>
  );
}

function LiveSimulatedTime({ timeOffset, isAr }: { timeOffset: number; isAr: boolean }) {
  const [time, setTime] = useState(() => Date.now() + timeOffset);
  useEffect(() => {
    setTime(Date.now() + timeOffset);
    const interval = setInterval(() => {
      setTime(Date.now() + timeOffset);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeOffset]);

  return (
    <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-2 py-1 rounded-md">
      {new Date(time).toLocaleString(isAr ? "ar-EG" : "en-US")}
    </span>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { db, staff, t, lang, can } = useApp();
  const sym = currencySymbol(db);
  const isAr = lang === "ar";
  // revenue visibility is gated by RBAC permissions
  const showCenterRevenue = can("revenue.center");
  const showTeacherRevenue = can("revenue.teachers");

  // Secure Clock State
  const [timeOffset, setTimeOffset] = useState<number>(() => {
    const saved = localStorage.getItem("center_simulated_time_offset");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");

  const handleSetCustomTime = (targetIsoString: string) => {
    if (!targetIsoString) return;
    const targetMs = new Date(targetIsoString).getTime();
    const newOffset = targetMs - Date.now();
    setTimeOffset(newOffset);
    localStorage.setItem("center_simulated_time_offset", String(newOffset));
  };

  const handleResetToRealTime = () => {
    setTimeOffset(0);
    localStorage.removeItem("center_simulated_time_offset");
  };

  const stats = useMemo(() => {
    const totalCollected = monthlyRevenue(db);
    const exp = monthlyExpenses(db);
    const centerIncome = monthlyCenterIncome(db);
    const teacherRevenues = totalCollected - centerIncome;
    const net = centerIncome - exp;
    
    return {
      students: db.students.length,
      groups: db.groups.length,
      attRate: attendanceRate(db, { days: 30 }),
      totalCollected, exp, centerIncome, teacherRevenues, net,
      collections: db.payments.filter((p) => p.month === monthKeyOf(now2())).length,
      totalTeachers: db.teachers.length,
      totalSalaries: staff.reduce((s, u) => s + (u.salary || 0), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, staff, timeOffset]);

  const series = useMemo(() => monthlySeries(db, 6), [db]);
  const attTrend = useMemo(() => attendanceTrend(db, 14), [db]);
  const grades = useMemo(() => gradeDistribution(db), [db]);

  const byGrade = useMemo(() => {
    return GRADES.map((g) => ({
      label: (isAr ? g.ar : g.en).replace(/Grade |الصف |Primary|الابتدائي|Preparatory|الإعدادي|Secondary|الثانوي|Kindergarten |التمهيدي/g, "").trim() || g.id,
      value: db.students.filter((s) => s.grade === g.id).length,
    })).filter((x) => x.value > 0);
  }, [db.students, isAr]);

  const stageDistribution = useMemo(() => {
    let primary = 0, prep = 0, secondary = 0, other = 0;
    for (const s of db.students) {
      const g = GRADES.find((g) => g.id === s.grade);
      if (!g) { other++; continue; }
      if (g.stage === "primary") primary++;
      else if (g.stage === "prep") prep++;
      else if (g.stage === "secondary") secondary++;
      else other++;
    }
    const total = primary + prep + secondary + other;
    return { primary, prep, secondary, other, total };
  }, [db.students]);

  const topTeachers = useMemo(
    () => db.teachers
      .map((tc) => ({ tc, rev: teacherRevenue(db, tc.id) }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5),
    [db],
  );

  const feeStatus = useMemo(() => {
    let full = 0, outstanding = 0, exempt = 0;
    for (const s of db.students) {
      if (s.isExempt) { exempt++; continue; }
      if (balanceDue(db, s) > 0) outstanding++; else full++;
    }
    return { full, outstanding, exempt };
  }, [db]);

  const todayEvents = useMemo(() => {
    const today = dayOfWeekOf(Date.now() + timeOffset);
    return db.scheduleEvents
      .filter((e) => e.dayOfWeek === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((e) => ({ ...e, group: db.groups.find((g) => g.id === e.groupId), room: db.classrooms.find((c) => c.id === e.classroomId) }));
  }, [db, timeOffset]);

  const pendingFees = useMemo(
    () => db.students.map((s) => ({ s, due: balanceDue(db, s) })).filter((x) => x.due > 0).sort((a, b) => b.due - a.due).slice(0, 5),
    [db],
  );
  const recentPayments = useMemo(
    () => [...db.payments].sort((a, b) => b.date - a.date).slice(0, 6).map((p) => ({ ...p, student: db.students.find((s) => s.id === p.studentId) })),
    [db],
  );

  const fmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);
  const feeTotal = feeStatus.full + feeStatus.outstanding + feeStatus.exempt || 1;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader 
        title={t("dash.title")} 
        subtitle={t("dash.subtitle")} 
        actions={
          <SecureClockWidget
            timeOffset={timeOffset}
            isAr={isAr}
            onClick={() => {
              const d = new Date(Date.now() + timeOffset);
              const tzOffset = d.getTimezoneOffset() * 60000;
              const localIsotime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
              setCustomDateTime(localIsotime);
              setShowEditModal(true);
            }}
          />
        }
      />

      {/* Subscription Status Banner */}
      <SubscriptionBanner />

      {/* hero banner: center income (gated by revenue.center permission) */}
      {showCenterRevenue ? (
      <Card className="mesh-brand relative overflow-hidden border-0 text-white shadow-[var(--shadow-brand)]">
        <div className="orb float-soft -right-8 -top-12 h-40 w-40 bg-white/12" />
        <div className="orb float-soft -bottom-16 right-1/3 h-44 w-44 bg-accent-400/20" style={{ animationDelay: "1s" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/70">
              <Building2 className="h-3.5 w-3.5" />
              {t("dash.centerIncome")} · {monthKeyOf(now2())}
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(stats.totalCollected, sym)}</p>
            <p className="mt-1 text-xs text-white/70">
              {t("dash.collections")}: {stats.collections} · {t("dash.netProfit")}: {formatMoney(stats.net, sym)}
            </p>
          </div>
          <div className="relative flex gap-2">
            <div className="rounded-xl bg-white/12 px-4 py-2 text-center ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
              <p className="text-lg font-bold">{stats.students}</p>
              <p className="text-[10px] text-white/70">{t("dash.totalStudents")}</p>
            </div>
            <div className="rounded-xl bg-white/12 px-4 py-2 text-center ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
              <p className="text-lg font-bold">{stats.groups}</p>
              <p className="text-[10px] text-white/70">{t("dash.activeGroups")}</p>
            </div>
            <div className="rounded-xl bg-white/12 px-4 py-2 text-center ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
              <p className="text-lg font-bold">{Math.round(stats.attRate)}%</p>
              <p className="text-[10px] text-white/70">{t("dash.attendanceRate")}</p>
            </div>
          </div>
        </div>
      </Card>
      ) : null}

      {/* KPI cards */}
      <div className="stagger grid grid-cols-1 min-[340px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} tone="brand" label={t("dash.totalStudents")} value={stats.students} />
        <StatCard icon={Users} tone="sky" label={isAr ? "إجمالي المعلمين" : "Total Teachers"} value={stats.totalTeachers} />
        <StatCard icon={Boxes} tone="violet" label={t("dash.activeGroups")} value={stats.groups} />
        {showCenterRevenue && <StatCard icon={Banknote} tone="rose" label={isAr ? "مرتبات الموظفين" : "Staff Salaries"} value={formatMoney(stats.totalSalaries, sym)} />}
        {showCenterRevenue && <StatCard icon={Building2} tone="emerald" label={isAr ? "دخل السنتر" : "Center Income"} value={formatMoney(stats.totalCollected, sym)} />}
        {showTeacherRevenue && <StatCard icon={Wallet} tone="sky" label={isAr ? "مستحقات المعلمين" : "Teacher Rev"} value={formatMoney(stats.teacherRevenues, sym)} />}
        {showCenterRevenue && <StatCard icon={Coins} tone="amber" label={t("dash.monthlyExpenses")} value={formatMoney(stats.exp, sym)} />}
        {showCenterRevenue && <StatCard icon={stats.net >= 0 ? TrendingUp : TrendingDown} tone={stats.net >= 0 ? "emerald" : "rose"} label={t("dash.netProfit")} value={formatMoney(stats.net, sym)} />}
      </div>

      {/* charts row 1 */}
      {showCenterRevenue && (
        <div className="grid grid-cols-1 gap-4">
          <ChartCard title={isAr ? "الربح والمصروفات" : "Income vs Expenses"} subtitle={isAr ? "آخر ٦ أشهر" : "Last 6 months"}>
            <div className="mb-4 grid grid-cols-1 min-[450px]:grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/60 p-2.5 dark:bg-emerald-500/10 min-w-0">
                <p className="truncate text-[10px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-300">{isAr ? "دخل السنتر" : "Center Income"}</p>
                <p className="truncate text-sm sm:text-base font-bold text-emerald-600">{formatMoney(stats.totalCollected, sym)}</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-50/60 p-2.5 dark:bg-rose-500/10 min-w-0">
                <p className="truncate text-[10px] sm:text-xs font-medium text-rose-700 dark:text-rose-300">{t("dash.monthlyExpenses")}</p>
                <p className="truncate text-sm sm:text-base font-bold text-rose-600">{formatMoney(stats.exp, sym)}</p>
              </div>
              <div className={cn("rounded-xl border p-2.5 min-w-0", stats.net >= 0 ? "border-brand-500/20 bg-brand-50/60 dark:bg-brand-500/10" : "border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/10")}>
                <p className={cn("truncate text-[10px] sm:text-xs font-medium", stats.net >= 0 ? "text-brand-700 dark:text-brand-300" : "text-rose-700 dark:text-rose-300")}>{t("dash.netProfit")}</p>
                <p className={cn("truncate text-sm sm:text-base font-bold", stats.net >= 0 ? "text-brand-600" : "text-rose-600")}>{formatMoney(stats.net, sym)}</p>
              </div>
            </div>
            <LineAreaChart
              labels={series.map((s) => s.month.slice(5))}
              series={[
                { name: isAr ? "دخل السنتر" : "Center Income", color: "#10b981", values: series.map((s) => s.revenue) },
                { name: t("fin.expenses"), color: "#f43f5e", values: series.map((s) => s.expenses) },
                { name: isAr ? "صافي الربح" : "Net Profit", color: "#6366f1", values: series.map((s) => s.centerIncome - s.expenses) },
              ]}
              formatY={fmt}
            />
          </ChartCard>
        </div>
      )}

      {/* Circular Charts Row (Fee Status + Educational Stages) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("dash.feeStatus")} subtitle={`${feeStatus.full + feeStatus.outstanding + feeStatus.exempt} ${t("dash.totalStudents")}`}>
          {feeTotal === 0 ? <EmptyState title={t("students.empty")} /> : (() => {
            const feePieData = [
              { name: t("dash.full"), value: feeStatus.full, color: "#10b981" },
              { name: t("dash.outstanding"), value: feeStatus.outstanding, color: "#f43f5e" },
              { name: t("dash.exempt"), value: feeStatus.exempt, color: "#38bdf8" }
            ].filter(d => d.value > 0);

            const size = 130;
            const stroke = 12;
            const r = (size - stroke) / 2;
            const c = 2 * Math.PI * r;
            let accumulatedPercent = 0;

            const segments = feePieData.map((d) => {
              const percentage = d.value / feeTotal;
              const currentAccumulated = accumulatedPercent;
              accumulatedPercent += percentage;
              return {
                ...d,
                percentage,
                accumulatedDegrees: currentAccumulated * 360,
              };
            });

            return (
              <div 
                className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-5 sm:gap-8 py-5 px-1 sm:px-4 w-full select-none" 
                dir={isAr ? "rtl" : "ltr"}
              >
                {/* Circle Chart */}
                <div className="relative h-[130px] w-[130px] shrink-0 flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
                  <svg width={size} height={size} className="overflow-visible">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={r}
                      fill="none"
                      className="stroke-slate-100 dark:stroke-slate-800"
                      strokeWidth={stroke}
                    />
                    {segments.map((seg, idx) => {
                      const offset = c - (seg.percentage * c);
                      return (
                        <circle
                          key={idx}
                          cx={size / 2}
                          cy={size / 2}
                          r={r}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={stroke}
                          strokeDasharray={c}
                          strokeDashoffset={offset}
                          transform={`rotate(${seg.accumulatedDegrees - 90} ${size / 2} ${size / 2})`}
                          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                          className="hover:opacity-80 transition duration-150"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-ink">{feeStatus.full + feeStatus.outstanding + feeStatus.exempt}</span>
                    <span className="text-[10px] text-muted">{isAr ? "طالب" : "students"}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 w-full sm:max-w-[170px] flex flex-col justify-center gap-3">
                  {feePieData.map((entry, idx) => {
                    const percentage = Math.round((entry.value / feeTotal) * 100);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-4 border-b border-slate-100/50 dark:border-slate-800/50 pb-2 last:border-0 last:pb-0">
                        {/* Label + Color Indicator */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span 
                            className="h-2.5 w-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: entry.color }} 
                          />
                          <span className="text-[11px] min-[380px]:text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {entry.name}
                          </span>
                        </div>

                        {/* Value & Percentage */}
                        <span className="text-[11px] min-[380px]:text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0">
                          {entry.value} ({percentage}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </ChartCard>

        <ChartCard title={isAr ? "المراحل التعليمية" : "Educational Stages"} subtitle={isAr ? "نسبة وتوزيع الطلاب" : "Student distribution"}>
          {stageDistribution.total === 0 ? <EmptyState title={t("students.empty")} /> : (() => {
            const pieData = [
              { name: isAr ? "الثانوية" : "Secondary", value: stageDistribution.secondary, color: "#A78BFA" },
              { name: isAr ? "الإعدادية" : "Preparatory", value: stageDistribution.prep, color: "#F472B6" },
              { name: isAr ? "الابتدائية" : "Primary", value: stageDistribution.primary, color: "#FCD34D" },
              { name: isAr ? "أخرى" : "Other", value: stageDistribution.other, color: "#86EFAC" }
            ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

            const size = 130;
            const stroke = 12;
            const r = (size - stroke) / 2;
            const c = 2 * Math.PI * r;
            let accumulatedPercent = 0;

            const segments = pieData.map((d) => {
              const percentage = d.value / stageDistribution.total;
              const currentAccumulated = accumulatedPercent;
              accumulatedPercent += percentage;
              return {
                ...d,
                percentage,
                accumulatedDegrees: currentAccumulated * 360,
              };
            });

            return (
              <div 
                className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-5 sm:gap-8 py-5 px-1 sm:px-4 w-full select-none" 
                dir={isAr ? "rtl" : "ltr"}
              >
                {/* Circle Chart */}
                <div className="relative h-[130px] w-[130px] shrink-0 flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
                  <svg width={size} height={size} className="overflow-visible">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={r}
                      fill="none"
                      className="stroke-slate-100 dark:stroke-slate-800"
                      strokeWidth={stroke}
                    />
                    {segments.map((seg, idx) => {
                      const offset = c - (seg.percentage * c);
                      return (
                        <circle
                          key={idx}
                          cx={size / 2}
                          cy={size / 2}
                          r={r}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={stroke}
                          strokeDasharray={c}
                          strokeDashoffset={offset}
                          transform={`rotate(${seg.accumulatedDegrees - 90} ${size / 2} ${size / 2})`}
                          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                          className="hover:opacity-80 transition duration-150"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-ink">{stageDistribution.total}</span>
                    <span className="text-[10px] text-muted">{isAr ? "طالب" : "students"}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 w-full sm:max-w-[170px] flex flex-col justify-center gap-3">
                  {pieData.map((entry, idx) => {
                    const percentage = Math.round((entry.value / stageDistribution.total) * 100);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-4 border-b border-slate-100/50 dark:border-slate-800/50 pb-2 last:border-0 last:pb-0">
                        {/* Label + Color Indicator */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span 
                            className="h-2.5 w-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: entry.color }} 
                          />
                          <span className="text-[11px] min-[380px]:text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {entry.name}
                          </span>
                        </div>

                        {/* Value & Percentage */}
                        <span className="text-[11px] min-[380px]:text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0">
                          {entry.value} ({percentage}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </ChartCard>
      </div>

      {/* charts row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("dash.attendanceTrends")} subtitle={isAr ? "آخر ١٤ يوماً" : "Last 14 days"}>
          <LineAreaChart height={180} labels={attTrend.map((d) => d.label)} series={[{ name: t("dash.attendanceRate"), color: "#6366f1", values: attTrend.map((d) => d.rate) }]} formatY={(v) => `${Math.round(v)}%`} />
        </ChartCard>
        <ChartCard title={t("dash.gradeDistribution")} subtitle={isAr ? "كل الامتحانات" : "Across all exams"}>
          <BarChart data={grades.map((g) => ({ label: g.label, value: g.count }))} color="#8b5cf6" />
        </ChartCard>
      </div>

      {/* by grade + top teachers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title={t("dash.byGrade")} subtitle={isAr ? "توزيع الطلاب" : "Student distribution"}>
          {byGrade.length === 0 ? <EmptyState title={t("students.empty")} /> : <BarChart data={byGrade} color="#0ea5e9" />}
        </ChartCard>

        <Card className="p-5 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-semibold text-ink">{t("dash.topTeachers")}</h3></div>
          {topTeachers.length === 0 ? <EmptyState title={t("teachers.empty")} /> : (
            <div className="space-y-2">
              {topTeachers.map(({ tc, rev }, i) => (
                <div key={tc.id} className="flex items-center gap-2.5">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-elevated text-muted"}`}>{i + 1}</span>
                  <div className="h-7 w-7 shrink-0 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: tc.color ?? "#6366f1" }}>
                    {tc.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{tc.name}</p>
                    <p className="truncate text-[10px] text-faint">{tc.subjects.join(" · ")}</p>
                  </div>
                  {showTeacherRevenue && <span className="text-xs font-bold text-emerald-600">{formatMoney(rev, sym)}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* schedule + fees + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-hover p-5">
          <div className="mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-brand-600" /><h3 className="text-sm font-semibold text-ink">{t("dash.upcoming")}</h3></div>
          {todayEvents.length === 0 ? <p className="py-6 text-center text-xs text-muted">{t("dash.noSchedule")}</p> : (
            <div className="space-y-2">
              {todayEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
                  <div className="flex h-9 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                    <span className="text-[10px] font-bold leading-none">{formatTime12(e.startTime, lang)}</span>
                    <span className="text-[9px] leading-none opacity-70">{formatTime12(e.endTime, lang)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{e.group?.name ?? "—"}</p>
                    <p className="truncate text-[11px] text-muted">{e.room?.name ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-semibold text-ink">{t("dash.pendingFees")}</h3></div>
            <button onClick={() => onNavigate("finance")} className="text-[11px] font-medium text-brand-600 hover:underline">{t("dash.viewReport")}</button>
          </div>
          {pendingFees.length === 0 ? <p className="py-6 text-center text-xs text-muted">{t("fin.empty")}</p> : (
            <div className="space-y-2">
              {pendingFees.map(({ s, due }) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-ink">{s.name}</p><p className="text-[10px] text-faint">{s.id}</p></div>
                  {showCenterRevenue ? <Badge tone="danger">{formatMoney(due, sym)}</Badge> : <Badge tone="warning">{t("dash.outstanding")}</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{t("dash.recentActivity")}</h3>
            <button onClick={() => onNavigate("finance")} className="text-[11px] font-medium text-brand-600 hover:underline">{t("action.view")}</button>
          </div>
          {recentPayments.length === 0 ? <EmptyState title={t("fin.empty")} /> : (
            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15"><ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-ink">{p.student?.name ?? "—"}</p><p className="text-[10px] text-faint">{t(`fin.type.${p.type}`)}</p></div>
                  {showCenterRevenue && <span className="text-xs font-bold text-emerald-600">+{formatMoney(p.amount, sym)}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Secure Clock Adjustment Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={isAr ? "ضبط تاريخ وساعة العرض" : "Adjust Display Time & Date"}
        description={isAr ? "تعديل عرض الوقت والتاريخ لمعاينة الجدولة والتقارير في لوحة التحكم" : "Simulate system date/time for schedule testing and report previews"}
        size="md"
      >
        <div className="space-y-4">
          {/* Time Picker Controls */}
          <div className="rounded-xl border border-line bg-elevated/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink">
                {isAr ? "التوقيت الحالي للمحاكاة:" : "Current Simulated Time:"}
              </span>
              <LiveSimulatedTime timeOffset={timeOffset} isAr={isAr} />
            </div>

            <Field label={isAr ? "اختر التاريخ والوقت يدوياً" : "Select Custom Date & Time"}>
              <Input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
              />
            </Field>

            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1 text-xs font-bold"
                onClick={() => {
                  handleSetCustomTime(customDateTime);
                  setShowEditModal(false);
                }}
              >
                {isAr ? "تطبيق التعديل" : "Apply Offset"}
              </Button>
              {timeOffset !== 0 && (
                <Button
                  variant="secondary"
                  className="gap-1.5 text-xs font-bold border-amber-500/20 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/15"
                  onClick={() => {
                    handleResetToRealTime();
                    setShowEditModal(false);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isAr ? "إعادة للوقت الفعلي" : "Reset to Real Time"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ====================== Subscription Banner ====================== */
function SubscriptionBanner() {
  const { subscriptionPlan } = useApp();
  const planLabels: Record<string, string> = { free: "مجاني", pro: "احترافي", enterprise: "مؤسسي" };
  const planLabel = planLabels[subscriptionPlan] || "مجاني";
  const isFree = subscriptionPlan === "free";

  if (!isFree) {
    // Show active plan banner
    return (
      <Card className="flex items-center justify-between gap-3 border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:border-emerald-500/20 dark:from-emerald-500/5 dark:to-teal-500/5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted">اشتراكك الحالي</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">الخطة {planLabel}</p>
          </div>
        </div>
        <Badge tone="success">نشط</Badge>
      </Card>
    );
  }

  // Show upgrade prompt for free users
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 p-4 dark:border-amber-500/20 dark:from-amber-500/5 dark:to-orange-500/5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted">خطتك الحالية</p>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">مجاني (محدود)</p>
        </div>
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "upgrade" }))}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
      >
        <Crown className="h-4 w-4" />
        ترقية الآن
      </button>
    </Card>
  );
}

/* tiny local helpers to avoid importing time utils repeatedly */
function now2() {
  const saved = localStorage.getItem("center_simulated_time_offset");
  const offset = saved ? parseInt(saved, 10) : 0;
  return Date.now() + offset;
}
function monthKeyOf(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
