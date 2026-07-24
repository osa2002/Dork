/**
 * Enterprise Platform Administration - API Client Contract
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import {
  ITenantSummaryUI,
  IPlatformHealthMetricsUI,
  IAuditLogEntryUI
} from "../types/adminTypes";

export interface ITenantListParams {
  page?: number;
  limit?: number;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED" | "PROVISIONING";
  planType?: "free" | "pro" | "enterprise";
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ITenantListResponseUI {
  tenants: ITenantSummaryUI[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IAuditLogListParams {
  page?: number;
  limit?: number;
  actorEmail?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  startDate?: string;
  endDate?: string;
}

export interface IAuditLogListResponseUI {
  records: IAuditLogEntryUI[];
  total: number;
  page: number;
  limit: number;
}

export interface IAdminApiClientContract {
  // Health
  checkHealth(): Promise<{ status: string; module: string; timestamp: string }>;

  // Tenants
  getTenants(params?: ITenantListParams): Promise<ITenantListResponseUI>;
  getTenantById(shopId: string): Promise<ITenantSummaryUI>;
  updateTenantStatus(shopId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<ITenantSummaryUI>;
  updateTenantPlan(shopId: string, planType: "free" | "pro" | "enterprise", reason: string): Promise<ITenantSummaryUI>;

  // Metrics
  getSystemMetricsOverview(): Promise<IPlatformHealthMetricsUI>;

  // Audit
  getAuditLogs(params?: IAuditLogListParams): Promise<IAuditLogListResponseUI>;

  // Config
  getPlatformConfig(): Promise<Record<string, any>>;
  updatePlatformConfig(config: Record<string, any>, reason: string): Promise<Record<string, any>>;
}
