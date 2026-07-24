/**
 * Enterprise Platform Administration - API Client Implementation
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import {
  ITenantSummaryUI,
  IPlatformHealthMetricsUI,
  IAuditLogEntryUI,
  IDiagnosticsUI,
  IIncidentUI,
  IAlertUI,
  IMaintenanceWindowUI,
  IUserSessionUI,
  ILoginHistoryUI,
  IFailedLoginAnalyticsUI,
  ISuspiciousActivityUI,
  IDeviceInventoryUI,
  IRoleAssignmentUI,
  IApiKeyUI,
  ISecretRotationUI,
  IFeatureFlagUI
} from "../types/adminTypes";
import {
  ITenantListParams,
  ITenantListResponseUI,
  IAuditLogListParams,
  IAuditLogListResponseUI,
  IAdminApiClientContract
} from "./IAdminApiClient";

export class AdminApiClient implements IAdminApiClientContract {
  private baseUrl = "/api/v1/admin";

  private getHeaders(): HeadersInit {
    // Inject headers to simulate admin context if needed by middleware
    const localUser = localStorage.getItem("dork_admin_user");
    let adminEmail = "admin@dork.platform";
    let adminRole = "SUPER_ADMIN";

    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        adminEmail = parsed.email || adminEmail;
        adminRole = parsed.role || adminRole;
      } catch (e) {
        // Fallback
      }
    }

    return {
      "Content-Type": "application/json",
      "x-admin-email": adminEmail,
      "x-admin-role": adminRole,
      "x-correlation-id": `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      let errorMsg = `API error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) {
          errorMsg = errJson.message;
        } else if (errJson && errJson.error) {
          errorMsg = typeof errJson.error === "string" ? errJson.error : JSON.stringify(errJson.error);
        }
      } catch (e) {
        // ignore json parse error
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  }

  // Health
  public async checkHealth(): Promise<{ status: string; module: string; timestamp: string }> {
    return this.request<{ status: string; module: string; timestamp: string }>("/health");
  }

  // Tenants
  public async getTenants(params?: ITenantListParams): Promise<ITenantListResponseUI> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.status) query.set("status", params.status);
    if (params?.planType) query.set("planType", params.planType);
    if (params?.search) query.set("search", params.search);
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

    const qStr = query.toString() ? `?${query.toString()}` : "";
    const res = await this.request<any>(`/tenants${qStr}`);
    
    return {
      tenants: res.data || res.tenants || [],
      total: res.total || (res.data ? res.data.length : 0),
      page: res.page || params?.page || 1,
      limit: res.limit || params?.limit || 20,
      totalPages: res.totalPages || 1
    };
  }

  public async getTenantById(shopId: string): Promise<ITenantSummaryUI> {
    const res = await this.request<any>(`/tenants/${encodeURIComponent(shopId)}`);
    return res.data || res;
  }

  public async getTenantUsage(shopId: string): Promise<any> {
    const res = await this.request<any>(`/tenants/${encodeURIComponent(shopId)}/usage`);
    return res.data || res;
  }

  public async getTenantAuditHistory(shopId: string): Promise<any> {
    const res = await this.request<any>(`/tenants/${encodeURIComponent(shopId)}/audit-history`);
    return res.data || res;
  }

  public async updateTenantStatus(
    shopId: string,
    status: "ACTIVE" | "SUSPENDED",
    reason: string
  ): Promise<ITenantSummaryUI> {
    const res = await this.request<any>(`/tenants/${encodeURIComponent(shopId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason })
    });
    return res.data || res;
  }

  public async updateTenantPlan(
    shopId: string,
    planType: "free" | "pro" | "enterprise",
    reason: string
  ): Promise<ITenantSummaryUI> {
    const res = await this.request<any>(`/tenants/${encodeURIComponent(shopId)}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ planType, reason })
    });
    return res.data || res;
  }

  public async softDeleteTenant(shopId: string, reason: string): Promise<any> {
    return this.request<any>(`/tenants/${encodeURIComponent(shopId)}`, {
      method: "DELETE",
      body: JSON.stringify({ reason })
    });
  }

  // Dashboard & Metrics
  public async getSystemMetricsOverview(): Promise<IPlatformHealthMetricsUI> {
    const res = await this.request<any>("/metrics/overview");
    return res.data || res;
  }

  // Monitoring
  public async getDiagnostics(): Promise<IDiagnosticsUI> {
    const res = await this.request<any>("/monitoring/diagnostics");
    return res.data || res;
  }

  public async listIncidents(params?: { status?: string; severity?: string }): Promise<IIncidentUI[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.severity) query.set("severity", params.severity);
    const qStr = query.toString() ? `?${query.toString()}` : "";
    const res = await this.request<any>(`/monitoring/incidents${qStr}`);
    return res.data?.incidents || res.incidents || res.data || [];
  }

  public async createIncident(data: { title: string; severity: string; description: string; affectedServices: string[] }): Promise<IIncidentUI> {
    const res = await this.request<any>("/monitoring/incidents", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data || res;
  }

  public async updateIncident(incidentId: string, updates: { status?: string; rootCause?: string; description?: string }): Promise<IIncidentUI> {
    const res = await this.request<any>(`/monitoring/incidents/${encodeURIComponent(incidentId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    return res.data || res;
  }

  public async listAlerts(): Promise<IAlertUI[]> {
    const res = await this.request<any>("/monitoring/alerts");
    return res.data?.alerts || res.alerts || res.data || [];
  }

  public async acknowledgeAlert(alertId: string): Promise<IAlertUI> {
    const res = await this.request<any>(`/monitoring/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: "PATCH"
    });
    return res.data || res;
  }

  public async listMaintenanceWindows(): Promise<IMaintenanceWindowUI[]> {
    const res = await this.request<any>("/monitoring/maintenance");
    return res.data?.windows || res.windows || res.data || [];
  }

  public async scheduleMaintenanceWindow(data: { title: string; service: string; scheduledStart: string; scheduledEnd: string; impactLevel: string }): Promise<IMaintenanceWindowUI> {
    const res = await this.request<any>("/monitoring/maintenance", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data || res;
  }

  // Security Center
  public async listActiveSessions(params?: { status?: string; userEmail?: string }): Promise<IUserSessionUI[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.userEmail) query.set("userEmail", params.userEmail);
    const qStr = query.toString() ? `?${query.toString()}` : "";
    const res = await this.request<any>(`/security/sessions${qStr}`);
    return res.data?.sessions || res.sessions || res.data || [];
  }

  public async revokeSession(sessionId: string, reason?: string): Promise<any> {
    return this.request<any>(`/security/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: reason || "Revoked by admin" })
    });
  }

  public async revokeAllUserSessions(userEmail: string, reason: string): Promise<any> {
    return this.request<any>("/security/sessions/revoke-user", {
      method: "POST",
      body: JSON.stringify({ userEmail, reason })
    });
  }

  public async listLoginHistory(params?: { userEmail?: string; status?: string }): Promise<ILoginHistoryUI[]> {
    const query = new URLSearchParams();
    if (params?.userEmail) query.set("userEmail", params.userEmail);
    if (params?.status) query.set("status", params.status);
    const qStr = query.toString() ? `?${query.toString()}` : "";
    const res = await this.request<any>(`/security/logins/history${qStr}`);
    return res.data?.records || res.records || res.data || [];
  }

  public async getFailedLoginAnalytics(): Promise<IFailedLoginAnalyticsUI> {
    const res = await this.request<any>("/security/logins/failed-analytics");
    return res.data || res;
  }

  public async listSuspiciousActivities(): Promise<ISuspiciousActivityUI[]> {
    const res = await this.request<any>("/security/suspicious-activities");
    return res.data?.activities || res.activities || res.data || [];
  }

  public async updateSuspiciousActivity(activityId: string, updates: { status: string; resolutionNotes?: string }): Promise<ISuspiciousActivityUI> {
    const res = await this.request<any>(`/security/suspicious-activities/${encodeURIComponent(activityId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    return res.data || res;
  }

  public async listDeviceInventory(): Promise<IDeviceInventoryUI[]> {
    const res = await this.request<any>("/security/devices");
    return res.data?.devices || res.devices || res.data || [];
  }

  public async updateDeviceStatus(deviceId: string, updates: { status: string; isTrusted?: boolean }): Promise<IDeviceInventoryUI> {
    const res = await this.request<any>(`/security/devices/${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    return res.data || res;
  }

  public async listRoleAssignments(): Promise<IRoleAssignmentUI[]> {
    const res = await this.request<any>("/security/roles");
    return res.data?.roles || res.roles || res.data || [];
  }

  public async updateRoleAssignment(adminId: string, data: { role: string; customPermissions?: string[] }): Promise<IRoleAssignmentUI> {
    const res = await this.request<any>(`/security/roles/${encodeURIComponent(adminId)}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data || res;
  }

  public async getPermissionAuditSummary(): Promise<any> {
    const res = await this.request<any>("/security/permissions/audit");
    return res.data || res;
  }

  public async listApiKeys(): Promise<IApiKeyUI[]> {
    const res = await this.request<any>("/security/api-keys");
    return res.data?.apiKeys || res.apiKeys || res.data || [];
  }

  public async createApiKey(data: { name: string; scopes: string[]; expiresAt?: string }): Promise<IApiKeyUI> {
    const res = await this.request<any>("/security/api-keys", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data || res;
  }

  public async revokeApiKey(keyId: string, reason?: string): Promise<any> {
    return this.request<any>(`/security/api-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: reason || "Revoked by admin" })
    });
  }

  public async listSecretRotationStatus(): Promise<ISecretRotationUI[]> {
    const res = await this.request<any>("/security/secrets/rotation");
    return res.data?.secrets || res.secrets || res.data || [];
  }

  public async triggerSecretRotation(secretId: string, reason?: string): Promise<any> {
    return this.request<any>(`/security/secrets/${encodeURIComponent(secretId)}/rotate`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "Manual rotation triggered by admin" })
    });
  }

  // Audit Logs
  public async getAuditLogs(params?: IAuditLogListParams): Promise<IAuditLogListResponseUI> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.actorEmail) query.set("actorEmail", params.actorEmail);
    if (params?.severity) query.set("severity", params.severity);

    const qStr = query.toString() ? `?${query.toString()}` : "";
    const res = await this.request<any>(`/audit-logs${qStr}`);
    
    return {
      records: res.records || res.logs || (Array.isArray(res) ? res : []),
      total: res.total || (res.records ? res.records.length : 0),
      page: res.page || params?.page || 1,
      limit: res.limit || params?.limit || 50
    };
  }

  // Config
  public async getPlatformConfig(): Promise<Record<string, any>> {
    return this.request<Record<string, any>>("/config");
  }

  public async updatePlatformConfig(config: Record<string, any>, reason: string): Promise<Record<string, any>> {
    return this.request<Record<string, any>>("/config", {
      method: "PUT",
      body: JSON.stringify({ ...config, reason })
    });
  }
}

export const adminApiClient = new AdminApiClient();
