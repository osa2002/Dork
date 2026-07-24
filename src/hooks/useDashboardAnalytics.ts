import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Ticket } from "../types";
import { useVendorStore } from "../store/vendor/vendorStore";
import { useUiStore } from "../store";
import { calculateAnalyticsOverview } from "../store/vendor/utils/analyticsCalculations";

interface UseDashboardAnalyticsProps {
  tickets: Ticket[];
  allTickets: Ticket[];
}

export function useDashboardAnalytics({ tickets, allTickets }: UseDashboardAnalyticsProps) {
  const { t } = useTranslation();

  // Atomic Zustand state selectors
  const reportStartDate = useVendorStore((state) => state.reportStartDate);
  const reportEndDate = useVendorStore((state) => state.reportEndDate);
  const exportLoading = useVendorStore((state) => state.exportLoading);
  const reportError = useVendorStore((state) => state.reportError);
  const aiAnalysis = useVendorStore((state) => state.aiAnalysis);
  const aiLoading = useVendorStore((state) => state.aiLoading);
  const aiError = useVendorStore((state) => state.aiError);
  
  // Historical tickets selectors
  const historicalTickets = useVendorStore((state) => state.historicalTickets || []);
  const fetchHistoricalTickets = useVendorStore((state) => state.fetchHistoricalTickets);
  const shop = useVendorStore((state) => state.shop);
  const activeTab = useUiStore((state) => state.activeDashboardTab);

  // Atomic Zustand action selectors
  const setReportStartDate = useVendorStore((state) => state.setReportStartDate);
  const setReportEndDate = useVendorStore((state) => state.setReportEndDate);
  const handleExportCSVStore = useVendorStore((state) => state.handleExportCSV);
  const handleRequestAiDiagnostics = useVendorStore((state) => state.handleRequestAiDiagnostics);

  const shopId = shop?.id;

  // Trigger historical tickets fetch only when the reports tab is active OR the date range changes
  useEffect(() => {
    if (activeTab === "reports" && shopId) {
      fetchHistoricalTickets(shopId, reportStartDate, reportEndDate);
    }
  }, [activeTab, shopId, reportStartDate, reportEndDate, fetchHistoricalTickets]);

  // Pure heavy calculations with reference stability
  const overview = useMemo(() => {
    return calculateAnalyticsOverview(historicalTickets, reportStartDate, reportEndDate);
  }, [historicalTickets, reportStartDate, reportEndDate]);

  // Orchestrated event handlers
  const handleExportCSV = async () => {
    await handleExportCSVStore(overview.filteredReportTickets, t);
  };

  const handleAskAiDiagnostics = async () => {
    await handleRequestAiDiagnostics(historicalTickets);
  };

  return {
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    exportLoading,
    reportError,
    filteredReportTickets: overview.filteredReportTickets,
    totalReportCount: overview.totalReportCount,
    completedReportCount: overview.completedReportCount,
    cancelledReportCount: overview.cancelledReportCount,
    noShowReportCount: overview.noShowReportCount,
    averageReportWaitMinutes: overview.averageReportWaitMinutes,
    averageReportServiceMinutes: overview.averageReportServiceMinutes,
    satisfactionScore: overview.satisfactionScore,
    speedScore: overview.speedScore,
    qualityScore: overview.qualityScore,
    staffLeaderboard: overview.staffLeaderboard,
    dailyTrends: overview.dailyTrends,
    serviceDistribution: overview.serviceDistribution,
    handleExportCSV,
    aiAnalysis,
    aiLoading,
    aiError,
    handleAskAiDiagnostics,
  };
}
