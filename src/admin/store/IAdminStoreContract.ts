/**
 * Enterprise Platform Administration - Store Contract
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import {
  IAdminUserProfile,
  ITenantSummaryUI,
  IPlatformHealthMetricsUI,
  IAuditLogEntryUI
} from "../types/adminTypes";

export interface IAdminState {
  // Auth & Identity
  user: IAdminUserProfile | null;
  isAuthenticated: boolean;
  mfaVerified: boolean;

  // Active Data Views
  systemMetrics: IPlatformHealthMetricsUI | null;
  tenants: ITenantSummaryUI[];
  selectedTenant: ITenantSummaryUI | null;
  auditLogs: IAuditLogEntryUI[];
  platformConfig: Record<string, any> | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  activeFilterStatus: string | null;
  searchQuery: string;
}

export interface IAdminActions {
  setAdminUser(user: IAdminUserProfile | null): void;
  setMfaVerified(status: boolean): void;
  fetchSystemMetrics(): Promise<void>;
  fetchTenants(page?: number, limit?: number): Promise<void>;
  fetchTenantDetails(shopId: string): Promise<void>;
  updateTenantStatus(shopId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<void>;
  fetchAuditLogs(page?: number): Promise<void>;
  fetchPlatformConfig(): Promise<void>;
  updatePlatformConfig(config: Record<string, any>, reason: string): Promise<void>;
  setSearchQuery(query: string): void;
  clearError(): void;
}

export interface IAdminStoreContract extends IAdminState, IAdminActions {}
