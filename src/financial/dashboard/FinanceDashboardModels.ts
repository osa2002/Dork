import { OperationalDashboard } from "../../observability/dashboards/DashboardModels";

export interface FinOpsKpiCard {
  title: string;
  value: string;
  changePercentage: number;
  isPositive: boolean;
  periodLabel: string;
  description: string;
}

export interface RevenueWaterfallPoint {
  period: string; // YYYY-MM
  grossBookings: number;
  recognizedRevenue: number;
  deferredRevenueBalance: number;
}

export interface TaxLiabilityByRegion {
  jurisdiction: string;
  countryCode: string;
  taxCollectedUsd: number;
  status: "ACCUMULATING" | "FILED" | "REMITTED";
}

export class FinanceDashboardModels {
  public static getFinancialOperationsDashboard(): OperationalDashboard {
    return {
      id: "dash-finops-overview",
      title: "Enterprise Financial Operations & Revenue Recognition",
      description: "IFRS 15 revenue schedules, period closing status, multi-currency FX revaluation, tax liabilities, and refund workflows.",
      category: "Executive",
      widgets: [
        {
          id: "w-recognized-revenue",
          title: "Recognized Revenue (MTD)",
          type: "STAT_CARD",
          metricQuery: "sum(financial_recognized_revenue_cents) / 100",
          gridPos: { x: 0, y: 0, w: 2, h: 2 },
          unit: "USD"
        },
        {
          id: "w-deferred-revenue-balance",
          title: "Deferred Revenue Balance",
          type: "STAT_CARD",
          metricQuery: "sum(financial_deferred_revenue_balance_cents) / 100",
          gridPos: { x: 2, y: 0, w: 2, h: 2 },
          unit: "USD"
        },
        {
          id: "w-unreconciled-variance",
          title: "Unreconciled Discrepancies",
          type: "STAT_CARD",
          metricQuery: "sum(reconciliation_discrepancies_total)",
          gridPos: { x: 4, y: 0, w: 2, h: 2 },
          thresholds: [{ value: 0, color: "#38a169" }, { value: 1, color: "#e53e3e" }]
        },
        {
          id: "w-revenue-waterfall-chart",
          title: "Recognized vs Deferred Revenue Waterfall",
          type: "TIMESERIES",
          metricQuery: "financial_revenue_schedule_by_period",
          gridPos: { x: 0, y: 2, w: 6, h: 4 }
        }
      ]
    };
  }
}
