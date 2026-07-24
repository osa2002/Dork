/**
 * Enterprise Platform Administration - Page View Contracts
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

export interface IAdminDashboardPageContract {
  title: string;
  refreshIntervalMs: number;
}

export interface IAdminTenantsPageContract {
  title: string;
  defaultPageSize: number;
}

export interface IAdminTenantInspectorPageContract {
  shopId: string;
}

export interface IAdminAuditLogsPageContract {
  title: string;
  exportFormat: "CSV" | "JSON";
}

export interface IAdminConfigPageContract {
  title: string;
  requireDoubleConfirmation: boolean;
}
