import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Ticket } from "../types";

interface UseDashboardAnalyticsProps {
  tickets: Ticket[];
  allTickets: Ticket[];
}

export function useDashboardAnalytics({ tickets, allTickets }: UseDashboardAnalyticsProps) {
  const { t } = useTranslation();
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Gemini AI Analysis States
  const [analyzedTickets, setAnalyzedTickets] = useState<Ticket[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Filtered tickets based on start/end dates
  const filteredReportTickets = allTickets.filter((ticket) => {
    const createdDate = ticket.createdAt.split("T")[0];
    return createdDate >= reportStartDate && createdDate <= reportEndDate;
  });

  // Calculate high-level metrics
  const totalReportCount = filteredReportTickets.length;
  const completedReportTickets = filteredReportTickets.filter(t => t.status === "completed");
  const completedReportCount = completedReportTickets.length;
  const cancelledReportCount = filteredReportTickets.filter(t => t.status === "cancelled").length;
  const noShowReportCount = filteredReportTickets.filter(t => t.status === "no_show").length;

  const averageReportWaitMinutes = (() => {
    if (completedReportCount === 0) return 0;
    const totalDiff = completedReportTickets.reduce((acc, tItem) => {
      if (tItem.calledAt && tItem.createdAt) {
        const diffMs = new Date(tItem.calledAt).getTime() - new Date(tItem.createdAt).getTime();
        return acc + Math.max(0, diffMs);
      }
      return acc;
    }, 0);
    return Math.round(totalDiff / completedReportCount / 60000);
  })();

  const averageReportServiceMinutes = (() => {
    if (completedReportCount === 0) return 0;
    const totalDiff = completedReportTickets.reduce((acc, tItem) => {
      if (tItem.completedAt && tItem.calledAt) {
        const diffMs = new Date(tItem.completedAt).getTime() - new Date(tItem.calledAt).getTime();
        return acc + Math.max(0, diffMs);
      }
      return acc;
    }, 0);
    return Math.round(totalDiff / completedReportCount / 60000);
  })();

  const satisfactionScore = (() => {
    const rated = completedReportTickets.filter(t => t.rating !== undefined && t.rating !== null);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, tItem) => acc + (tItem.rating || 0), 0);
    return Number((sum / rated.length).toFixed(1));
  })();

  const speedScore = (() => {
    const rated = completedReportTickets.filter(t => t.ratingSpeed !== undefined && t.ratingSpeed !== null);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, tItem) => acc + (tItem.ratingSpeed || 0), 0);
    return Number((sum / rated.length).toFixed(1));
  })();

  const qualityScore = (() => {
    const rated = completedReportTickets.filter(t => t.ratingQuality !== undefined && t.ratingQuality !== null);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, tItem) => acc + (tItem.ratingQuality || 0), 0);
    return Number((sum / rated.length).toFixed(1));
  })();

  // Staff Performance / Leaderboard
  const staffLeaderboard = (() => {
    const staffMap: { [key: string]: { completed: number; ratings: number[]; sum: number } } = {};
    completedReportTickets.forEach((tItem) => {
      const staff = tItem.counterNumber || tItem.completedAt ? `Counter ${tItem.counterNumber || "1"}` : "";
      if (!staff) return;
      if (!staffMap[staff]) {
        staffMap[staff] = { completed: 0, ratings: [], sum: 0 };
      }
      staffMap[staff].completed += 1;
      if (tItem.rating) {
        staffMap[staff].ratings.push(tItem.rating);
        staffMap[staff].sum += tItem.rating;
      }
    });

    return Object.entries(staffMap).map(([name, stats]) => {
      const avgRating = stats.ratings.length > 0 ? Number((stats.sum / stats.ratings.length).toFixed(1)) : 5.0;
      return { name, completed: stats.completed, avgRating };
    }).sort((a, b) => b.completed - a.completed);
  })();

  // Chart data: daily load
  const dailyTrends = (() => {
    const daysMap: { [key: string]: { date: string; completed: number; cancelled: number; waiting: number } } = {};
    const dateList: string[] = [];
    
    // Populate last 7 days by default if dates are within range
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    const temp = new Date(start);
    while (temp <= end) {
      const dayISO = temp.toISOString().split("T")[0];
      daysMap[dayISO] = { date: dayISO, completed: 0, cancelled: 0, waiting: 0 };
      dateList.push(dayISO);
      temp.setDate(temp.getDate() + 1);
    }

    filteredReportTickets.forEach((tItem) => {
      const dayISO = tItem.createdAt.split("T")[0];
      if (daysMap[dayISO]) {
        if (tItem.status === "completed") {
          daysMap[dayISO].completed += 1;
        } else if (tItem.status === "cancelled") {
          daysMap[dayISO].cancelled += 1;
        } else if (tItem.status === "waiting") {
          daysMap[dayISO].waiting += 1;
        }
      }
    });

    return dateList.map(d => daysMap[d]);
  })();

  // Services distribution
  const serviceDistribution = (() => {
    const serviceMap: { [key: string]: number } = {};
    filteredReportTickets.forEach((tItem) => {
      const service = tItem.serviceName || "Other";
      serviceMap[service] = (serviceMap[service] || 0) + 1;
    });
    return Object.entries(serviceMap).map(([name, value]) => ({ name, value }));
  })();

  // Export CSV functions
  const handleExportCSV = async () => {
    if (filteredReportTickets.length === 0) {
      alert(t("vend_no_data_export_msg", { defaultValue: "No records found in this date range to export." }));
      return;
    }
    setExportLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const headers = ["ID", "Number", "Customer Name", "Phone", "Email", "Service", "Status", "Priority", "Counter", "Created At", "Called At", "Completed At", "Rating", "Comment"];
      const rows = filteredReportTickets.map((tItem) => [
        tItem.id,
        tItem.ticketNumber,
        tItem.customerName,
        tItem.customerPhone || "",
        tItem.customerEmail || "",
        tItem.serviceName,
        tItem.status,
        tItem.isPriority ? "VIP" : "Normal",
        tItem.counterNumber || "",
        tItem.createdAt,
        tItem.calledAt || "",
        tItem.completedAt || "",
        tItem.rating || "",
        tItem.ratingComment || ""
      ]);

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `dork_tickets_report_${reportStartDate}_to_${reportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Export failed:", err);
      setReportError(err.message || t("vend_export_failed"));
    } finally {
      setExportLoading(false);
    }
  };

  // Helper aggregate functions for Gemini Advisor AI diagnostics
  const aggregateStatsForAi = () => {
    const servicesObj: { [key: string]: { total: number; completed: number; cancelled: number } } = {};
    filteredReportTickets.forEach(tItem => {
      if (!servicesObj[tItem.serviceName]) {
        servicesObj[tItem.serviceName] = { total: 0, completed: 0, cancelled: 0 };
      }
      servicesObj[tItem.serviceName].total += 1;
      if (tItem.status === "completed") servicesObj[tItem.serviceName].completed += 1;
      if (tItem.status === "cancelled") servicesObj[tItem.serviceName].cancelled += 1;
    });

    return {
      date_range: `${reportStartDate} to ${reportEndDate}`,
      total_tickets: totalReportCount,
      completed_tickets: completedReportCount,
      cancelled_tickets: cancelledReportCount,
      no_show_tickets: noShowReportCount,
      average_wait_minutes: averageReportWaitMinutes,
      average_service_minutes: averageReportServiceMinutes,
      satisfaction_rate: satisfactionScore,
      services_summary: servicesObj,
      staff_productivity: staffLeaderboard
    };
  };

  const handleAskAiDiagnostics = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const stats = aggregateStatsForAi();
      const response = await fetch("/api/ai-diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stats }),
      });

      if (!response.ok) {
        throw new Error(`AI diagnostics service failed with status ${response.status}`);
      }

      const result = await response.json();
      setAiAnalysis(result.analysis || "Could not generate any advice. Please try again.");
    } catch (err: any) {
      console.error("AI diagnostics failed:", err);
      setAiError(err.message || t("vend_ai_advisor_failed_msg"));
    } finally {
      setAiLoading(false);
    }
  };

  return {
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    exportLoading,
    reportError,
    filteredReportTickets,
    totalReportCount,
    completedReportCount,
    cancelledReportCount,
    noShowReportCount,
    averageReportWaitMinutes,
    averageReportServiceMinutes,
    satisfactionScore,
    speedScore,
    qualityScore,
    staffLeaderboard,
    dailyTrends,
    serviceDistribution,
    handleExportCSV,
    aiAnalysis,
    aiLoading,
    aiError,
    handleAskAiDiagnostics
  };
}
