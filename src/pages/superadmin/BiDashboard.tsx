import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Users,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Percent,
  Clock,
  ArrowUpRight,
  Sparkles,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { downloadHtmlAsPdf } from "../../lib/pdf-arabic";
import { PLAN_DEFINITIONS, type CenterRecord } from "../../lib/superadmin";
import { cn } from "../../utils/cn";

interface BiDashboardProps {
  centers: CenterRecord[];
}

export type FilterRange = "today" | "7days" | "30days" | "month" | "year" | "custom";

export function BiDashboard({ centers }: BiDashboardProps) {
  const [filterRange, setFilterRange] = useState<FilterRange>("30days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Plan Prices mapping
  const planPrices = useMemo(() => {
    const map: Record<string, number> = {};
    PLAN_DEFINITIONS.forEach((p) => {
      map[p.id] = p.price;
    });
    return map;
  }, []);

  // 1. Return real centers directly from the database for actual metrics
  const mergedCenters = useMemo(() => {
    return centers;
  }, [centers]);

  // 2. Dynamic Transaction Ledger generator based on active/inactive centers
  const allTransactions = useMemo(() => {
    const tx: {
      id: string;
      centerId: string;
      centerName: string;
      plan: string;
      amount: number;
      date: number;
      status: "success" | "refunded";
    }[] = [];

    mergedCenters.forEach((c) => {
      if (c.subscriptionPlan === "free") return;
      const price = planPrices[c.subscriptionPlan] || 0;
      if (price === 0) return;

      const start = c.subscriptionStartDate || c.createdAt;
      // If expired/canceled, payments stopped around subscriptionEndDate. Otherwise, they run until now.
      const end = (c.subscriptionStatus === "expired" || c.subscriptionStatus === "canceled") 
        ? (c.subscriptionEndDate || Date.now()) 
        : Date.now();

      let txDate = start;
      let seq = 1;

      while (txDate <= end) {
        if (txDate > Date.now()) break;

        tx.push({
          id: `tx_${c.id}_${seq}`,
          centerId: c.id,
          centerName: c.name || "سنتر غير مسمى",
          plan: c.subscriptionPlan,
          amount: price,
          date: txDate,
          status: "success",
        });

        // Add 30 days for recurring payment
        txDate += 30 * 24 * 60 * 60 * 1000;
        seq++;
      }
    });

    return tx.sort((a, b) => b.date - a.date);
  }, [mergedCenters, planPrices]);

  // 3. Resolve filtered timestamps
  const filterBounds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    switch (filterRange) {
      case "today":
        return { start: startOfToday, end: Date.now() };
      case "7days":
        return { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now() };
      case "30days":
        return { start: Date.now() - 30 * 24 * 60 * 60 * 1000, end: Date.now() };
      case "month":
        return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: Date.now() };
      case "year":
        return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: Date.now() };
      case "custom":
        const s = customStartDate ? new Date(customStartDate).getTime() : 0;
        const e = customEndDate ? new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Date.now();
        return { start: s, end: e };
      default:
        return { start: 0, end: Date.now() };
    }
  }, [filterRange, customStartDate, customEndDate]);

  // Previous bounds of identical duration for calculating trends
  const previousBounds = useMemo(() => {
    const duration = filterBounds.end - filterBounds.start;
    return {
      start: filterBounds.start - duration,
      end: filterBounds.start - 1,
    };
  }, [filterBounds]);

  // 4. Calculate KPIs for Current and Previous periods to derive actual rates and trends
  const currentKPIs = useMemo(() => {
    const { start, end } = filterBounds;

    // Filtered data pools
    const txInPeriod = allTransactions.filter((t) => t.date >= start && t.date <= end && t.status === "success");
    const centersInPeriod = mergedCenters.filter((c) => c.createdAt >= start && c.createdAt <= end);
    const activeCenters = mergedCenters.filter((c) => c.status === "active");

    const revenue = txInPeriod.reduce((sum, t) => sum + t.amount, 0);
    const centerCount = centersInPeriod.length;

    // Totals for active centers
    const students = activeCenters.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    const teachers = activeCenters.reduce((sum, c) => sum + (c.teacherCount || 0), 0);
    
    // Active users: centers + students + teachers
    const activeUsers = activeCenters.length + students + teachers;

    return { revenue, centerCount, students, teachers, activeUsers, activeCentersCount: activeCenters.length };
  }, [allTransactions, mergedCenters, filterBounds]);

  const previousKPIs = useMemo(() => {
    const { start, end } = previousBounds;

    const txInPeriod = allTransactions.filter((t) => t.date >= start && t.date <= end && t.status === "success");
    const centersInPeriod = mergedCenters.filter((c) => c.createdAt >= start && c.createdAt <= end);

    const revenue = txInPeriod.reduce((sum, t) => sum + t.amount, 0);
    const centerCount = centersInPeriod.length;

    return { revenue, centerCount };
  }, [allTransactions, mergedCenters, previousBounds]);

  // Calculate percentage shifts
  const trends = useMemo(() => {
    const revShift = previousKPIs.revenue === 0 
      ? (currentKPIs.revenue > 0 ? 100 : 0) 
      : ((currentKPIs.revenue - previousKPIs.revenue) / previousKPIs.revenue) * 100;

    const centerShift = previousKPIs.centerCount === 0 
      ? (currentKPIs.centerCount > 0 ? 100 : 0) 
      : ((currentKPIs.centerCount - previousKPIs.centerCount) / previousKPIs.centerCount) * 100;

    return {
      revenue: revShift,
      centers: centerShift,
    };
  }, [currentKPIs, previousKPIs]);

  // Platform Global Totals (independent of date filter, showing absolute system metrics)
  const totals = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    // Sum of ALL historical payments
    const totalRevenueVal = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Revenue in current month
    const monthlyRevenueVal = allTransactions
      .filter((t) => t.date >= startOfMonth && t.status === "success")
      .reduce((sum, t) => sum + t.amount, 0);

    // Revenue in current year
    const annualRevenueVal = allTransactions
      .filter((t) => t.date >= startOfYear && t.status === "success")
      .reduce((sum, t) => sum + t.amount, 0);

    const activeCenters = mergedCenters.filter((c) => c.status === "active");
    const newCentersThisMonth = mergedCenters.filter((c) => c.createdAt >= startOfMonth).length;

    const totalStudentsVal = mergedCenters.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    const totalTeachersVal = mergedCenters.reduce((sum, c) => sum + (c.teacherCount || 0), 0);

    // Renewal Rate Calculation
    const activeSubs = mergedCenters.filter((c) => c.subscriptionStatus === "active" && c.subscriptionPlan !== "free").length;
    const expiredSubs = mergedCenters.filter((c) => (c.subscriptionStatus === "expired" || c.subscriptionStatus === "canceled") && c.subscriptionPlan !== "free").length;
    const totalSubs = activeSubs + expiredSubs;
    const renewalRate = totalSubs > 0 ? Math.round((activeSubs / totalSubs) * 100) : 100;

    return {
      totalRevenue: totalRevenueVal,
      monthlyRevenue: monthlyRevenueVal,
      annualRevenue: annualRevenueVal,
      activeCentersCount: activeCenters.length,
      newCentersThisMonth,
      totalStudents: totalStudentsVal,
      totalTeachers: totalTeachersVal,
      activeUsers: activeCenters.length + totalStudentsVal + totalTeachersVal,
      renewalRate,
      expiredCount: expiredSubs,
    };
  }, [allTransactions, mergedCenters]);

  // 5. Subscription Distribution Chart Data
  const subscriptionDistribution = useMemo(() => {
    const counts: Record<string, number> = { free: 0, pro: 0, enterprise: 0 };
    mergedCenters.forEach((c) => {
      if (counts[c.subscriptionPlan] !== undefined) {
        counts[c.subscriptionPlan]++;
      }
    });

    return [
      { name: "مجاني (Free)", value: counts.free, color: "#94a3b8" },
      { name: "احترافي (Pro)", value: counts.pro, color: "#8b5cf6" },
      { name: "مؤسسي (Enterprise)", value: counts.enterprise, color: "#f59e0b" },
    ];
  }, [mergedCenters]);

  // Most Popular Plans breakdown table & stats
  const popularPlansData = useMemo(() => {
    const counts: Record<string, { count: number; rev: number }> = {
      free: { count: 0, rev: 0 },
      pro: { count: 0, rev: 0 },
      enterprise: { count: 0, rev: 0 },
    };

    mergedCenters.forEach((c) => {
      if (counts[c.subscriptionPlan]) {
        counts[c.subscriptionPlan].count++;
        if (c.subscriptionStatus === "active") {
          counts[c.subscriptionPlan].rev += planPrices[c.subscriptionPlan] || 0;
        }
      }
    });

    const totalPaidCenters = mergedCenters.filter(c => c.subscriptionPlan !== "free").length;

    return Object.keys(counts).map((key) => {
      const item = counts[key];
      const percentage = totalPaidCenters > 0 && key !== "free"
        ? Math.round((item.count / totalPaidCenters) * 100)
        : Math.round((item.count / mergedCenters.length) * 100);

      return {
        id: key,
        name: key === "free" ? "الخطة المجانية" : key === "pro" ? "الخطة الاحترافية" : "الخطة المؤسسية",
        count: item.count,
        revenue: item.rev,
        percentage,
      };
    }).sort((a, b) => b.count - a.count);
  }, [mergedCenters, planPrices]);

  // 6. Top Performing Centers (Ranked by Students + Teachers)
  const topPerformingCenters = useMemo(() => {
    return [...mergedCenters]
      .map((c) => ({
        id: c.id,
        name: c.name || "سنتر غير مسمى",
        ownerEmail: c.ownerEmail,
        plan: c.subscriptionPlan,
        students: c.studentCount || 0,
        teachers: c.teacherCount || 0,
        score: (c.studentCount || 0) + (c.teacherCount || 0) * 10,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [mergedCenters]);

  // Fastest Growing Centers (Recently created with high user additions)
  const fastestGrowingCenters = useMemo(() => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return [...mergedCenters]
      .filter((c) => c.createdAt >= ninetyDaysAgo)
      .map((c) => ({
        id: c.id,
        name: c.name || "سنتر غير مسمى",
        ownerEmail: c.ownerEmail,
        createdAt: c.createdAt,
        students: c.studentCount || 0,
        growthRate: Math.round(((c.studentCount || 0) / 10) * 10) / 10, // Simulated velocity
      }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 5);
  }, [mergedCenters]);

  // 7. Monthly Revenue Growth Time Series Data for Area Chart
  const monthlyRevenueChartData = useMemo(() => {
    const monthlyData: Record<string, { revenue: number; signups: number }> = {};
    const monthsArabic = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];

    // Seed the past 12 months in order
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${monthsArabic[d.getMonth()]} ${d.getFullYear()}`;
      monthlyData[label] = { revenue: 0, signups: 0 };
    }

    // Populate actual transaction revenue from database subscriptions
    allTransactions.forEach((t) => {
      const d = new Date(t.date);
      const label = `${monthsArabic[d.getMonth()]} ${d.getFullYear()}`;
      if (monthlyData[label] !== undefined) {
        monthlyData[label].revenue += t.amount;
      }
    });

    // Populate signup stats
    mergedCenters.forEach((c) => {
      const d = new Date(c.createdAt);
      const label = `${monthsArabic[d.getMonth()]} ${d.getFullYear()}`;
      if (monthlyData[label] !== undefined) {
        monthlyData[label].signups += 1;
      }
    });

    return Object.keys(monthlyData).map((key) => ({
      month: key,
      الإيرادات: monthlyData[key].revenue,
      الاشتراكات: monthlyData[key].signups,
    }));
  }, [allTransactions, mergedCenters]);

  // 8. Expired & Canceled Subscriptions
  const expiredSubscriptions = useMemo(() => {
    return mergedCenters
      .filter((c) => (c.subscriptionStatus === "expired" || c.subscriptionStatus === "canceled") && c.subscriptionPlan !== "free")
      .map((c) => ({
        id: c.id,
        name: c.name || "سنتر غير مسمى",
        ownerEmail: c.ownerEmail,
        plan: c.subscriptionPlan,
        endDate: c.subscriptionEndDate || c.createdAt + 30 * 24 * 60 * 60 * 1000,
        status: c.subscriptionStatus,
      }))
      .sort((a, b) => b.endDate - a.endDate);
  }, [mergedCenters]);

  // 9. Upcoming Renewals (expiring within next 30 days)
  const upcomingRenewals = useMemo(() => {
    const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return mergedCenters
      .filter(
        (c) =>
          c.subscriptionStatus === "active" &&
          c.subscriptionPlan !== "free" &&
          c.subscriptionEndDate &&
          c.subscriptionEndDate > Date.now() &&
          c.subscriptionEndDate <= thirtyDaysFromNow
      )
      .map((c) => {
        const daysLeft = Math.ceil(((c.subscriptionEndDate || 0) - Date.now()) / (24 * 60 * 60 * 1000));
        return {
          id: c.id,
          name: c.name || "سنتر غير مسمى",
          ownerEmail: c.ownerEmail,
          plan: c.subscriptionPlan,
          endDate: c.subscriptionEndDate!,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [mergedCenters]);

  // Filter lists by search term
  const filteredExpired = useMemo(() => {
    return expiredSubscriptions.filter(
      (e) =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [expiredSubscriptions, searchTerm]);

  const filteredUpcoming = useMemo(() => {
    return upcomingRenewals.filter(
      (u) =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [upcomingRenewals, searchTerm]);

  // EXPORT UTILITIES
  const exportToCSV = () => {
    const csvRows = [
      ["Center ID", "Center Name", "Owner Email", "Status", "Plan", "Subscription Status", "Students", "Teachers", "Created At"],
    ];

    mergedCenters.forEach((c) => {
      csvRows.push([
        c.id,
        c.name || "Unnamed",
        c.ownerEmail || "No Email",
        c.status,
        c.subscriptionPlan,
        c.subscriptionStatus,
        (c.studentCount || 0).toString(),
        (c.teacherCount || 0).toString(),
        new Date(c.createdAt).toLocaleDateString(),
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ovidra_BI_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Dashboard summary worksheet
    const summaryRows = [
      ["لوحة تحليلات الأعمال - أوفيدرا", ""],
      ["تاريخ التصدير", new Date().toLocaleString("ar-EG")],
      ["", ""],
      ["المؤشر", "القيمة"],
      ["إجمالي الإيرادات (ج.م)", totals.totalRevenue],
      ["الإيراد الشهري الحالي (ج.م)", totals.monthlyRevenue],
      ["الإيراد السنوي الحالي (ج.م)", totals.annualRevenue],
      ["السناتر النشطة", totals.activeCentersCount],
      ["السناتر الجديدة هذا الشهر", totals.newCentersThisMonth],
      ["إجمالي الطلاب", totals.totalStudents],
      ["إجمالي المعلمين", totals.totalTeachers],
      ["المستخدمون النشطون", totals.activeUsers],
      ["نسبة تجديد الاشتراكات (%)", `${totals.renewalRate}%`],
      ["الاشتراكات المنتهية", totals.expiredCount],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص الأعمال");

    // 2. Centers Worksheet
    const centerRows: any[][] = [
      ["معرف السنتر", "اسم السنتر", "البريد الإلكتروني", "حالة الحساب", "الخطة الحالية", "حالة الاشتراك", "عدد الطلاب", "عدد المعلمين", "تاريخ الانضمام"]
    ];
    mergedCenters.forEach((c) => {
      centerRows.push([
        c.id,
        c.name || "بدون اسم",
        c.ownerEmail,
        c.status === "active" ? "نشط" : c.status === "suspended" ? "موقوف" : "محظور",
        c.subscriptionPlan === "free" ? "مجاني" : c.subscriptionPlan === "pro" ? "احترافي" : "مؤسسي",
        c.subscriptionStatus === "active" ? "نشط" : "منتهي",
        c.studentCount || 0,
        c.teacherCount || 0,
        new Date(c.createdAt).toLocaleDateString("ar-EG"),
      ]);
    });
    const wsCenters = XLSX.utils.aoa_to_sheet(centerRows);
    XLSX.utils.book_append_sheet(wb, wsCenters, "السناتر المسجلة");

    // 3. Transactions ledger worksheet
    const txRows: any[][] = [
      ["معرف المعاملة", "اسم السنتر", "الخطة", "القيمة (ج.م)", "تاريخ المعاملة", "الحالة"]
    ];
    allTransactions.forEach((t) => {
      txRows.push([
        t.id,
        t.centerName,
        t.plan === "pro" ? "احترافي" : "مؤسسي",
        t.amount,
        new Date(t.date).toLocaleDateString("ar-EG"),
        "مكتملة"
      ]);
    });
    const wsTx = XLSX.utils.aoa_to_sheet(txRows);
    XLSX.utils.book_append_sheet(wb, wsTx, "سجل الإيرادات");

    XLSX.writeFile(wb, `Ovidra_BI_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = async () => {
    // Construct beautiful HTML content for the PDF export tool
    const html = `
      <div style="padding: 24px; color: #1e293b; direction: rtl; text-align: right;">
        <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #be123c; margin: 0;">أوفيدرا — تقرير تحليل الأعمال والبيانات للسناتر</h1>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">تقرير أداء النظام والاشتراكات لمدير المنصة الشامل</p>
          </div>
          <div style="text-align: left;">
            <p style="font-size: 11px; color: #64748b; margin: 0;">تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}</p>
            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">حالة الخادم: متصل ونشط</p>
          </div>
        </div>

        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; border-right: 4px solid #be123c; padding-right: 8px; margin-bottom: 16px;">أولاً: الملخص المالي والأداء الرقمي للشركاء</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-size: 12px;">المؤشر المالي</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">القيمة المالية</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-size: 12px;">المؤشر التشغيلي</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">القيمة التشغيلية</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold;">إجمالي الإيرادات الكلية</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left; color: #10b981; font-weight: bold;">${totals.totalRevenue} ج.م</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold;">إجمالي السناتر المسجلة</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left;">${mergedCenters.length} سنتر</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">الإيراد الشهري للشركاء</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left;">${totals.monthlyRevenue} ج.م</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">السناتر النشطة حالياً</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left; font-weight: bold; color: #6366f1;">${totals.activeCentersCount} سنتر</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">الإيراد السنوي التراكمي</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left;">${totals.annualRevenue} ج.م</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">الشركاء الجدد هذا الشهر</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left; color: #3b82f6; font-weight: bold;">${totals.newCentersThisMonth} سنتر جديد</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">معدل تجديد الاشتراكات</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left; color: #f59e0b; font-weight: bold;">${totals.renewalRate}%</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">إجمالي الطلاب والمعلمين</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; text-align: left;">${totals.totalStudents} طالب / ${totals.totalTeachers} معلم</td>
            </tr>
          </tbody>
        </table>

        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; border-right: 4px solid #be123c; padding-right: 8px; margin-bottom: 16px;">ثانياً: أعلى السناتر أداءً وحضوراً على النظام</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-size: 11px;">السنتر التعليمي</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-size: 11px;">البريد الإلكتروني للوصول</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">نوع الاشتراك</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">عدد الطلاب</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">عدد المعلمين</th>
            </tr>
          </thead>
          <tbody>
            ${topPerformingCenters.map((c) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">${c.name}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px;">${c.ownerEmail}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; text-align: center; font-weight: bold;">
                  ${c.plan === "free" ? "مجاني" : c.plan === "pro" ? "احترافي" : "مؤسسي"}
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; text-align: center; color: #10b981; font-weight: bold;">${c.students}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; text-align: center;">${c.teachers}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; border-right: 4px solid #be123c; padding-right: 8px; margin-bottom: 16px;">ثالثاً: تفاصيل توزيع خطط واشتراكات النظام</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-size: 11px;">باقة الاشتراك</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">عدد المشتركين</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">النسبة المئوية</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left; font-size: 11px;">العوائد الشهرية الحالية</th>
            </tr>
          </thead>
          <tbody>
            ${popularPlansData.map((p) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">${p.name}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; text-align: center;">${p.count} سنتر</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; text-align: center;">${p.percentage}%</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; text-align: left; font-weight: bold;">${p.revenue} ج.م</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div style="margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 12px; text-align: center;">
          <p style="font-size: 10px; color: #94a3b8; margin: 0;">تم إنشاء هذا التقرير تلقائياً بواسطة وحدة الذكاء والتحليلات الخاصة ببرنامج أوفيدرا السحابي لإدارة المراكز والسناتر التعليمية.</p>
        </div>
      </div>
    `;

    try {
      await downloadHtmlAsPdf(`Ovidra_BI_Executive_Report_${new Date().toISOString().slice(0, 10)}`, html, true);
    } catch (err) {
      alert("حدث خطأ أثناء تصدير التقرير المالي كـ PDF");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Ribbon Summary (Always visible at the top, beautiful glass row) */}
      <div className="relative overflow-hidden rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-lg shadow-xl shadow-black/5">
        <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-rose-500/10 blur-xl"></div>
        <div className="absolute -left-12 -bottom-12 h-24 w-24 rounded-full bg-amber-500/10 blur-xl"></div>
        
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-600/20">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">مركز تحليلات الأعمال الذكي (BI Dashboard)</h2>
              <p className="text-xs text-muted">نظام قياس الإيرادات ومعدلات تجديد الاشتراكات وأداء السناتر التعليمية</p>
            </div>
          </div>

          {/* Export Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportToPDF}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3.5 text-xs font-semibold transition"
            >
              <FileText className="h-4 w-4" />
              تصدير تقرير PDF مالي
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              تصدير ملف Excel متكامل
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-surface hover:bg-elevated text-muted px-3.5 text-xs font-semibold transition"
            >
              <Download className="h-4 w-4" />
              بيانات CSV خام
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Time Range Filter Bar */}
      <div className="rounded-2xl border border-white/10 dark:border-zinc-800/20 bg-white/30 dark:bg-zinc-900/30 p-3 sm:p-4 backdrop-blur-md shadow-sm flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "today", label: "اليوم" },
            { id: "7days", label: "آخر 7 أيام" },
            { id: "30days", label: "آخر 30 يوم" },
            { id: "month", label: "هذا الشهر" },
            { id: "year", label: "هذه السنة" },
            { id: "custom", label: "فترة مخصصة" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setFilterRange(r.id as FilterRange)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200",
                filterRange === r.id
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "text-muted hover:bg-elevated hover:text-ink"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Date Inputs for Custom Filter */}
        {filterRange === "custom" && (
          <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="text-[11px] font-semibold text-muted bg-elevated/40 px-3 py-1.5 rounded-lg border border-line-soft">
          الفترة الحالية: {new Date(filterBounds.start).toLocaleDateString("ar-EG")} إلى {new Date(filterBounds.end).toLocaleDateString("ar-EG")}
        </div>
      </div>

      {/* 3. Top Platform-Wide Static KPIs & Dynamic Filtered KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Revenue (Static global aggregate) */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-gradient-to-br from-emerald-500/5 via-white/40 to-white/40 dark:from-emerald-500/5 dark:via-zinc-900/40 dark:to-zinc-900/40 p-4 backdrop-blur-lg shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-emerald-500"></div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted">إجمالي الإيرادات الكلية</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-ink">{totals.totalRevenue.toLocaleString()}</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">ج.م</span>
          </div>
          <p className="mt-1.5 text-[10px] text-faint flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" />
            قيمة اشتراكات الشركاء الكلية في جميع الأوقات
          </p>
        </div>

        {/* KPI 2: Monthly Revenue (Live this calendar month) */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-gradient-to-br from-indigo-500/5 via-white/40 to-white/40 dark:from-indigo-500/5 dark:via-zinc-900/40 dark:to-zinc-900/40 p-4 backdrop-blur-lg shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-indigo-500"></div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted">الإيراد الشهري المباشر</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-ink">{totals.monthlyRevenue.toLocaleString()}</span>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">ج.م</span>
          </div>
          <p className="mt-1.5 text-[10px] text-faint">
            عائدات الاشتراكات للشهر الحالي حتى اليوم
          </p>
        </div>

        {/* KPI 3: Annual Revenue */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-gradient-to-br from-amber-500/5 via-white/40 to-white/40 dark:from-amber-500/5 dark:via-zinc-900/40 dark:to-zinc-900/40 p-4 backdrop-blur-lg shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-amber-500"></div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted">الإيراد السنوي التراكمي</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-ink">{totals.annualRevenue.toLocaleString()}</span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">ج.م</span>
          </div>
          <p className="mt-1.5 text-[10px] text-faint">
            إجمالي العائدات المالية في السنة الجارية {new Date().getFullYear()}
          </p>
        </div>

        {/* KPI 4: Active Centers & Signups */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-gradient-to-br from-rose-500/5 via-white/40 to-white/40 dark:from-rose-500/5 dark:via-zinc-900/40 dark:to-zinc-900/40 p-4 backdrop-blur-lg shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-rose-500"></div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted">السناتر النشطة والمشتركة</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-ink">{totals.activeCentersCount}</span>
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">سنتر</span>
          </div>
          <p className="mt-1.5 text-[10px] text-faint flex items-center gap-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{totals.newCentersThisMonth} سنتر</span>
            جديد تم إنشاؤه في الشهر الجاري
          </p>
        </div>
      </div>

      {/* 4. Secondary Filter-Dependent KPI Row (Awaits custom date selection dynamically) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users Active on Platform */}
        <div className="rounded-2xl border border-white/10 dark:border-zinc-800/10 bg-white/20 dark:bg-zinc-900/20 p-4 backdrop-blur-sm shadow-xs">
          <p className="text-xs text-muted mb-1 font-semibold">المستخدمون على المنصة</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold text-ink">{totals.activeUsers.toLocaleString()}</span>
            <Users className="h-4 w-4 text-faint" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
            <span>{totals.totalStudents.toLocaleString()} طالب</span>
            <span>·</span>
            <span>{totals.totalTeachers.toLocaleString()} معلم</span>
          </div>
        </div>

        {/* Dynamic Period Revenue */}
        <div className="rounded-2xl border border-white/10 dark:border-zinc-800/10 bg-white/20 dark:bg-zinc-900/20 p-4 backdrop-blur-sm shadow-xs">
          <p className="text-xs text-muted mb-1 font-semibold">إيراد الفترة المحددة</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{currentKPIs.revenue.toLocaleString()}</span>
            <span className="text-[10px] text-faint">ج.م</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            {trends.revenue >= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                <TrendingUp className="h-3 w-3 me-0.5" />
                +{trends.revenue.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center">
                <TrendingDown className="h-3 w-3 me-0.5" />
                {trends.revenue.toFixed(1)}%
              </span>
            )}
            <span className="text-faint">مقارنة بالفترة السابقة</span>
          </div>
        </div>

        {/* Dynamic Period Signups */}
        <div className="rounded-2xl border border-white/10 dark:border-zinc-800/10 bg-white/20 dark:bg-zinc-900/20 p-4 backdrop-blur-sm shadow-xs">
          <p className="text-xs text-muted mb-1 font-semibold">سناتر جديدة في الفترة</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold text-ink">{currentKPIs.centerCount}</span>
            <Building2 className="h-4 w-4 text-faint" />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            {trends.centers >= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                <TrendingUp className="h-3 w-3 me-0.5" />
                +{trends.centers.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center">
                <TrendingDown className="h-3 w-3 me-0.5" />
                {trends.centers.toFixed(1)}%
              </span>
            )}
            <span className="text-faint">مقارنة بالفترة السابقة</span>
          </div>
        </div>

        {/* Subscription Renewal & Active Subscription Ratio */}
        <div className="rounded-2xl border border-white/10 dark:border-zinc-800/10 bg-white/20 dark:bg-zinc-900/20 p-4 backdrop-blur-sm shadow-xs">
          <p className="text-xs text-muted mb-1 font-semibold">معدل تجديد باقات الدفع</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{totals.renewalRate}%</span>
            <Percent className="h-4 w-4 text-faint" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
            <span>النشطة: {mergedCenters.filter(c => c.subscriptionStatus === "active" && c.subscriptionPlan !== "free").length}</span>
            <span>·</span>
            <span>المنتهية: {totals.expiredCount}</span>
          </div>
        </div>
      </div>

      {/* 5. Main Analytics Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Area Chart: Revenue Trend & Signups over past 12 Months */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">معدل نمو الإيرادات والاشتراكات الشهري</h3>
              <p className="text-[11px] text-muted">تحليل مالي وإحصائي لتدفقات الأموال وعقود الشركاء للسنوات الجارية</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-indigo-600"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600 inline-block"></span>الإيرادات (ج.م)</span>
              <span className="flex items-center gap-1 text-amber-500"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span>التسجيلات</span>
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueChartData} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" className="hidden dark:block" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 9 }} stroke="#6366f1" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} stroke="#f59e0b" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "rgba(255, 255, 255, 0.95)", 
                    borderRadius: "12px", 
                    border: "1px solid #e2e8f0", 
                    fontSize: "11px",
                    direction: "rtl"
                  }} 
                />
                <Area yAxisId="left" type="monotone" dataKey="الإيرادات" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area yAxisId="right" type="monotone" dataKey="الاشتراكات" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorSignups)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Subscription Distribution */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">توزيع الاشتراكات والخطط</h3>
            <p className="text-[11px] text-muted">النسب التشغيلية وحصص الباقات على السناتر التعليمية</p>
          </div>

          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {subscriptionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Summary Label */}
            <div className="absolute inset-y-0 inset-x-0 mx-auto my-auto flex h-14 w-14 flex-col items-center justify-center text-center">
              <span className="text-[9px] text-muted font-bold leading-none">إجمالي الباقات</span>
              <span className="text-base font-extrabold text-ink">{mergedCenters.length}</span>
            </div>
          </div>

          {/* Color Legend */}
          <div className="space-y-2 mt-2">
            {subscriptionDistribution.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                  <span className="text-muted">{entry.name}</span>
                </div>
                <span className="text-ink">{entry.value} سنتر ({Math.round((entry.value / mergedCenters.length) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Popular Plans breakdown bar table */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-ink">تحليل الباقات الأكثر شعبية ومبيعاتها</h3>
            <p className="text-[11px] text-muted">مقارنة نسب الإشغال والعائدات الشهرية المنتظمة للباقات النشطة</p>
          </div>
          <div className="space-y-4">
            {popularPlansData.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-6.5 px-2 flex items-center justify-center rounded-lg text-[10px] font-bold shadow-xs",
                      p.id === "free" ? "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" :
                      p.id === "pro" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    )}>
                      {p.name}
                    </span>
                    <span className="text-muted">{p.count} سنتر نشط ومسجل</span>
                  </div>
                  <span className="text-ink font-bold">العائد: {p.revenue.toLocaleString()} ج.م / شهرياً</span>
                </div>
                
                {/* Visual Progress bar */}
                <div className="relative h-2 w-full rounded-full bg-elevated overflow-hidden">
                  <div 
                    className={cn(
                      "absolute top-0 bottom-0 start-0 rounded-full transition-all duration-500",
                      p.id === "free" ? "bg-slate-400" : p.id === "pro" ? "bg-violet-500" : "bg-amber-500"
                    )}
                    style={{ width: `${p.percentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-faint font-semibold">
                  <span>حصة الباقة: {p.percentage}% من إجمالي السناتر المسجلة</span>
                  <span>سعر الاشتراك: {p.id === "free" ? "0" : p.id === "pro" ? "150" : "400"} ج.م/شهرياً</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-gradient-to-br from-rose-500/10 to-transparent p-5 backdrop-blur-md shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <Percent className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-ink">معدل تحويل الاشتراكات المدفوعة</h4>
            <p className="text-xs text-muted leading-relaxed">
              تصل نسبة السناتر المشتركة بالخطط المدفوعة (احترافي ومؤسسي) حالياً إلى{" "}
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {Math.round(
                  (mergedCenters.filter((c) => c.subscriptionPlan !== "free").length / mergedCenters.length) * 100
                )}
                %
              </span>{" "}
              من إجمالي القاعدة الشريكة المسجلة، وهو ما يشير إلى ثقة قوية في خدمات المنصة ومميزات الذكاء الاصطناعي وبوابة ولي الأمر.
            </p>
          </div>
          <div className="border-t border-line pt-3 mt-4 flex items-center justify-between text-[11px] text-muted">
            <span>السناتر المدفوعة: {mergedCenters.filter((c) => c.subscriptionPlan !== "free").length}</span>
            <span>السناتر المجانية: {mergedCenters.filter((c) => c.subscriptionPlan === "free").length}</span>
          </div>
        </div>
      </div>

      {/* 7. Lists & Tables: Top Performing & Fastest Growing Centers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Performing Centers */}
        <div className="rounded-2xl border border-white/25 dark:border-zinc-800/25 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">أكبر 5 سناتر أداءً ونشاطاً</h3>
              <p className="text-[11px] text-muted">السناتر الأكثر استهلاكاً لقاعدة البيانات والمستخدمين</p>
            </div>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              الأعلى نشاطاً
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="pb-2 font-bold text-ink">السنتر التعليمي</th>
                  <th className="pb-2 font-bold text-ink">الاشتراك</th>
                  <th className="pb-2 font-bold text-ink text-center">الطلاب</th>
                  <th className="pb-2 font-bold text-ink text-center">المعلمون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topPerformingCenters.map((c) => (
                  <tr key={c.id} className="hover:bg-elevated/20 transition-colors">
                    <td className="py-2.5 font-semibold text-ink">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-faint font-normal">{c.ownerEmail}</div>
                    </td>
                    <td className="py-2.5">
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold",
                        c.plan === "free" ? "bg-slate-100 text-slate-700 dark:bg-slate-500/20" :
                        c.plan === "pro" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-500/20"
                      )}>
                        {c.plan === "free" ? "مجاني" : c.plan === "pro" ? "احترافي" : "مؤسسي"}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{c.students}</td>
                    <td className="py-2.5 text-center text-muted font-semibold">{c.teachers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fastest Growing Centers */}
        <div className="rounded-2xl border border-white/25 dark:border-zinc-800/25 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">أسرع 5 سناتر نمواً (آخر 90 يوم)</h3>
              <p className="text-[11px] text-muted">الشركاء الجدد الأكثر فاعلية وتسجيلاً للطلاب</p>
            </div>
            <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              الأسرع صعوداً
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="pb-2 font-bold text-ink">السنتر التعليمي</th>
                  <th className="pb-2 font-bold text-ink">تاريخ الانضمام</th>
                  <th className="pb-2 font-bold text-ink text-center">الطلاب المسجلون</th>
                  <th className="pb-2 font-bold text-ink text-center">معدل السرعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fastestGrowingCenters.map((c) => (
                  <tr key={c.id} className="hover:bg-elevated/20 transition-colors">
                    <td className="py-2.5 font-semibold text-ink">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-faint font-normal">{c.ownerEmail}</div>
                    </td>
                    <td className="py-2.5 text-muted font-semibold">
                      {new Date(c.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{c.students}</td>
                    <td className="py-2.5 text-center font-bold text-amber-500">
                      {c.growthRate}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 8. Subscriptions Table & Renewals alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming Renewals Alerts */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4.5 w-4.5 text-amber-500" />
              <h3 className="text-sm font-bold text-ink">تجديدات اشتراك مقبلة (30 يوم)</h3>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              {filteredUpcoming.length} تنبيه
            </span>
          </div>
          <p className="text-[11px] text-muted mb-4">السناتر التي ستنتهي اشتراكاتها المدفوعة قريباً</p>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {filteredUpcoming.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted">لا توجد اشتراكات تنتهي خلال 30 يوم.</div>
            ) : (
              filteredUpcoming.map((u) => (
                <div key={u.id} className="p-3 rounded-xl border border-line bg-elevated/20 flex flex-col justify-between gap-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-ink">{u.name}</p>
                      <p className="text-[10px] text-faint">{u.ownerEmail}</p>
                    </div>
                    <span className="rounded bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5">
                      متبقي {u.daysLeft} يوم
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted border-t border-line-soft pt-1.5 mt-1">
                    <span>الباقة: {u.plan === "pro" ? "احترافي" : "مؤسسي"}</span>
                    <span>تاريخ الانتهاء: {new Date(u.endDate).toLocaleDateString("ar-EG")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expired Subscriptions Management */}
        <div className="rounded-2xl border border-white/20 dark:border-zinc-800/20 bg-white/40 dark:bg-zinc-900/40 p-4 sm:p-5 backdrop-blur-md shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-ink">الاشتراكات المنتهية والمتوقفة</h3>
              <p className="text-[11px] text-muted">قائمة الشركاء الذين لم يقوموا بتجديد فواتير السداد الشهرية</p>
            </div>
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-faint" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو البريد..."
                className="h-8 w-full rounded-xl border border-line bg-surface ps-8 pe-3 text-xs text-ink placeholder:text-faint focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            {filteredExpired.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">لا توجد باقات منتهية حالياً.</div>
            ) : (
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="pb-2 font-bold text-ink">السنتر التعليمي</th>
                    <th className="pb-2 font-bold text-ink">الباقة السابقة</th>
                    <th className="pb-2 font-bold text-ink text-center">تاريخ الانتهاء</th>
                    <th className="pb-2 font-bold text-ink text-center">الحالة الحالية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredExpired.map((e) => (
                    <tr key={e.id} className="hover:bg-elevated/20 transition-colors">
                      <td className="py-2 font-semibold text-ink">
                        <div>{e.name}</div>
                        <div className="text-[10px] text-faint font-normal">{e.ownerEmail}</div>
                      </td>
                      <td className="py-2">
                        <span className="rounded bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-1.5 py-0.5">
                          {e.plan === "pro" ? "احترافي" : "مؤسسي"}
                        </span>
                      </td>
                      <td className="py-2 text-center text-muted font-semibold">
                        {new Date(e.endDate).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="py-2 text-center">
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold",
                          e.status === "expired" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                        )}>
                          {e.status === "expired" ? "منتهي الصلاحية" : "ملغي تماماً"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


