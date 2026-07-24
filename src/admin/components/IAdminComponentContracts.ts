/**
 * Enterprise Platform Administration - Component Contracts
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import { ReactNode } from "react";
import {
  ITenantSummaryUI,
  IPlatformHealthMetricsUI,
  IAuditLogEntryUI,
  AdminPermissionType
} from "../types/adminTypes";

export interface ITenantTableProps {
  tenants: ITenantSummaryUI[];
  isLoading: boolean;
  onSelectTenant: (shopId: string) => void;
  onStatusChange: (shopId: string, status: "ACTIVE" | "SUSPENDED") => void;
  onPlanChange: (shopId: string, plan: "free" | "pro" | "enterprise") => void;
}

export interface IMetricsGridProps {
  metrics: IPlatformHealthMetricsUI | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export interface IAuditLogTableProps {
  records: IAuditLogEntryUI[];
  isLoading: boolean;
  page: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onExportCsv: () => void;
}

export interface ISystemConfigEditorProps {
  config: Record<string, any> | null;
  isLoading: boolean;
  isSaving: boolean;
  onSaveConfig: (updatedConfig: Record<string, any>, reason: string) => Promise<void>;
}

export interface IRBACGuardProps {
  permission: AdminPermissionType;
  fallback?: ReactNode;
  children: ReactNode;
}
