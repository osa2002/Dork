import { StateCreator } from "zustand";
import { VendorState, VendorAnalyticsSlice } from "../types";
import { vendorAnalyticsRepository } from "../../../repositories/vendorAnalyticsRepository";
import { calculateAnalyticsOverview } from "../utils/analyticsCalculations";
import { Ticket } from "../../../types";

const getInitialStartDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
};

const getInitialEndDate = () => {
  return new Date().toISOString().split("T")[0];
};

export const createVendorAnalyticsSlice: StateCreator<
  VendorState,
  [],
  [],
  VendorAnalyticsSlice
> = (set, get) => ({
  timeRange: "7days",
  reportStartDate: getInitialStartDate(),
  reportEndDate: getInitialEndDate(),
  exportLoading: false,
  reportError: null,
  aiAnalysis: "",
  aiLoading: false,
  aiError: null,

  setTimeRange: (timeRange) => set({ timeRange }),
  setReportStartDate: (reportStartDate) => set({ reportStartDate }),
  setReportEndDate: (reportEndDate) => set({ reportEndDate }),
  setExportLoading: (exportLoading) => set({ exportLoading }),
  setReportError: (reportError) => set({ reportError }),
  setAiAnalysis: (aiAnalysis) => set({ aiAnalysis }),
  setAiLoading: (aiLoading) => set({ aiLoading }),
  setAiError: (aiError) => set({ aiError }),

  handleExportCSV: async (filteredReportTickets: Ticket[], t: any) => {
    if (filteredReportTickets.length === 0) {
      alert(
        t("vend_no_data_export_msg", {
          defaultValue: "No records found in this date range to export.",
        })
      );
      return;
    }
    set({ exportLoading: true, reportError: null });
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const headers = [
        "ID",
        "Number",
        "Customer Name",
        "Phone",
        "Email",
        "Service",
        "Status",
        "Priority",
        "Counter",
        "Created At",
        "Called At",
        "Completed At",
        "Rating",
        "Comment",
      ];
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
        tItem.ratingComment || "",
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8,\uFEFF" +
        [
          headers.join(","),
          ...rows.map((e) =>
            e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `dork_tickets_report_${get().reportStartDate}_to_${get().reportEndDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Export failed:", err);
      set({ reportError: err.message || t("vend_export_failed") });
    } finally {
      set({ exportLoading: false });
    }
  },

  handleRequestAiDiagnostics: async (allTickets: Ticket[]) => {
    set({ aiLoading: true, aiError: null });
    try {
      const { reportStartDate, reportEndDate } = get();
      const overview = calculateAnalyticsOverview(allTickets, reportStartDate, reportEndDate);

      const servicesObj: {
        [key: string]: { total: number; completed: number; cancelled: number };
      } = {};
      overview.filteredReportTickets.forEach((tItem) => {
        if (!servicesObj[tItem.serviceName]) {
          servicesObj[tItem.serviceName] = { total: 0, completed: 0, cancelled: 0 };
        }
        servicesObj[tItem.serviceName].total += 1;
        if (tItem.status === "completed") servicesObj[tItem.serviceName].completed += 1;
        if (tItem.status === "cancelled") servicesObj[tItem.serviceName].cancelled += 1;
      });

      const stats = {
        date_range: `${reportStartDate} to ${reportEndDate}`,
        total_tickets: overview.totalReportCount,
        completed_tickets: overview.completedReportCount,
        cancelled_tickets: overview.cancelledReportCount,
        no_show_tickets: overview.noShowReportCount,
        average_wait_minutes: overview.averageReportWaitMinutes,
        average_service_minutes: overview.averageReportServiceMinutes,
        satisfaction_rate: overview.satisfactionScore,
        services_summary: servicesObj,
        staff_productivity: overview.staffLeaderboard,
      };

      const result = await vendorAnalyticsRepository.getAiDiagnostics(stats);
      set({
        aiAnalysis: result.analysis || "Could not generate any advice. Please try again.",
      });
    } catch (err: any) {
      console.error("AI diagnostics failed:", err);
      set({ aiError: err.message || "AI Advisor failed to generate diagnosis." });
    } finally {
      set({ aiLoading: false });
    }
  },
});
