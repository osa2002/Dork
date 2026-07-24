/**
 * Enterprise Platform Administration - Security Center Service
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Business Logic Layer for Sessions, Threat Intelligence, Device Management, RBAC & API Keys
 */

import { ISecurityAdminService } from "./IAdminService";
import { ISecurityAdminRepository } from "../repositories/IAdminRepository";
import {
  IUserSessionEntity,
  ILoginHistoryEntity,
  IFAILEDLoginAnalyticsEntity,
  ISuspiciousActivityEntity,
  IDeviceInventoryEntity,
  IRoleAssignmentEntity,
  IPermissionAuditSummaryEntity,
  IApiKeyEntity,
  ISecretRotationTrackingEntity
} from "../models/adminModels";
import {
  SessionQueryDTO,
  SessionListResponseDTO,
  RevokeUserSessionsDTO,
  LoginHistoryQueryDTO,
  LoginHistoryResponseDTO,
  SuspiciousActivityQueryDTO,
  SuspiciousActivityResponseDTO,
  UpdateSuspiciousActivityDTO,
  DeviceInventoryQueryDTO,
  DeviceInventoryResponseDTO,
  UpdateDeviceStatusDTO,
  UpdateRoleAssignmentDTO,
  CreateApiKeyDTO,
  ApiKeyListResponseDTO
} from "../dto/adminDTOs";
import {
  IAdminIdentity,
  AdminPermission,
  evaluateAdminPermission
} from "../permissions/adminPermissions";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { AdminTelemetryService } from "./AdminTelemetryService";
import { ForbiddenError } from "../../../src/errors/CustomErrors";

export class SecurityAdminService implements ISecurityAdminService {
  constructor(private securityRepo: ISecurityAdminRepository) {}

  public async listActiveSessions(
    query: SessionQueryDTO,
    actor: IAdminIdentity
  ): Promise<SessionListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listActiveSessions",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "List active sessions");
        return await this.securityRepo.findActiveSessions(query);
      }
    );
  }

  public async revokeSession(
    sessionId: string,
    actor: IAdminIdentity
  ): Promise<IUserSessionEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:revokeSession",
      { sessionId, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_REVOKE_SESSIONS, "Revoke session");
        const revoked = await this.securityRepo.revokeSession(sessionId, actor.email);

        AdminStructuredLogger.info(
          `[SecurityAdminService] Session '${sessionId}' revoked by ${actor.email}`
        );
        return revoked;
      }
    );
  }

  public async revokeAllUserSessions(
    dto: RevokeUserSessionsDTO,
    actor: IAdminIdentity
  ): Promise<{ revokedCount: number }> {
    return await AdminTelemetryService.traceAsync(
      "service:revokeAllUserSessions",
      { targetEmail: dto.userEmail, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_REVOKE_SESSIONS, "Revoke all user sessions");
        const count = await this.securityRepo.revokeAllUserSessions(
          dto.userEmail,
          actor.email,
          dto.reason
        );

        AdminStructuredLogger.info(
          `[SecurityAdminService] Revoked ${count} sessions for ${dto.userEmail} by ${actor.email}`
        );
        return { revokedCount: count };
      }
    );
  }

  public async listLoginHistory(
    query: LoginHistoryQueryDTO,
    actor: IAdminIdentity
  ): Promise<LoginHistoryResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listLoginHistory",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View login history");
        return await this.securityRepo.findLoginHistory(query);
      }
    );
  }

  public async getFailedLoginAnalytics(
    actor: IAdminIdentity
  ): Promise<IFAILEDLoginAnalyticsEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:getFailedLoginAnalytics",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View failed login analytics");
        return await this.securityRepo.getFailedLoginAnalytics();
      }
    );
  }

  public async listSuspiciousActivities(
    query: SuspiciousActivityQueryDTO,
    actor: IAdminIdentity
  ): Promise<SuspiciousActivityResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listSuspiciousActivities",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View suspicious activities");
        return await this.securityRepo.findSuspiciousActivities(query);
      }
    );
  }

  public async updateSuspiciousActivity(
    activityId: string,
    dto: UpdateSuspiciousActivityDTO,
    actor: IAdminIdentity
  ): Promise<ISuspiciousActivityEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:updateSuspiciousActivity",
      { activityId, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_REVOKE_SESSIONS, "Update suspicious activity");
        const updated = await this.securityRepo.updateSuspiciousActivity(
          activityId,
          dto,
          actor.email
        );

        AdminStructuredLogger.info(
          `[SecurityAdminService] Suspicious activity '${activityId}' updated to status '${dto.status}' by ${actor.email}`
        );
        return updated;
      }
    );
  }

  public async listDeviceInventory(
    query: DeviceInventoryQueryDTO,
    actor: IAdminIdentity
  ): Promise<DeviceInventoryResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listDeviceInventory",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View device inventory");
        return await this.securityRepo.findDeviceInventory(query);
      }
    );
  }

  public async updateDeviceStatus(
    deviceId: string,
    dto: UpdateDeviceStatusDTO,
    actor: IAdminIdentity
  ): Promise<IDeviceInventoryEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:updateDeviceStatus",
      { deviceId, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_REVOKE_SESSIONS, "Update device status");
        const updated = await this.securityRepo.updateDeviceStatus(deviceId, dto, actor.email);

        AdminStructuredLogger.info(
          `[SecurityAdminService] Device '${deviceId}' status updated to '${dto.status}' by ${actor.email}`
        );
        return updated;
      }
    );
  }

  public async listRoleAssignments(actor: IAdminIdentity): Promise<IRoleAssignmentEntity[]> {
    return await AdminTelemetryService.traceAsync(
      "service:listRoleAssignments",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View role assignments");
        return await this.securityRepo.listRoleAssignments();
      }
    );
  }

  public async updateRoleAssignment(
    adminId: string,
    dto: UpdateRoleAssignmentDTO,
    actor: IAdminIdentity
  ): Promise<IRoleAssignmentEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:updateRoleAssignment",
      { adminId, targetRole: dto.role, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_MANAGE_ROLES, "Update admin role assignment");
        const updated = await this.securityRepo.updateRoleAssignment(adminId, dto, actor.email);

        AdminStructuredLogger.info(
          `[SecurityAdminService] Admin '${adminId}' role updated to '${dto.role}' by ${actor.email}`
        );
        return updated;
      }
    );
  }

  public async getPermissionAuditSummary(
    actor: IAdminIdentity
  ): Promise<IPermissionAuditSummaryEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:getPermissionAuditSummary",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View permission audit summary");
        return await this.securityRepo.getPermissionAuditSummary();
      }
    );
  }

  public async listApiKeys(actor: IAdminIdentity): Promise<ApiKeyListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listApiKeys",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "List API keys");
        const keys = await this.securityRepo.listApiKeys();
        return {
          keys,
          total: keys.length
        };
      }
    );
  }

  public async createApiKey(
    dto: CreateApiKeyDTO,
    actor: IAdminIdentity
  ): Promise<IApiKeyEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:createApiKey",
      { name: dto.name, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_MANAGE_KEYS, "Create API key");
        const created = await this.securityRepo.createApiKey(dto, actor.email);

        AdminStructuredLogger.info(
          `[SecurityAdminService] API key '${created.keyId}' created by ${actor.email}`
        );
        return created;
      }
    );
  }

  public async revokeApiKey(
    keyId: string,
    actor: IAdminIdentity
  ): Promise<IApiKeyEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:revokeApiKey",
      { keyId, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_MANAGE_KEYS, "Revoke API key");
        const revoked = await this.securityRepo.revokeApiKey(keyId, actor.email);

        AdminStructuredLogger.info(
          `[SecurityAdminService] API key '${keyId}' revoked by ${actor.email}`
        );
        return revoked;
      }
    );
  }

  public async listSecretRotationStatus(
    actor: IAdminIdentity
  ): Promise<ISecretRotationTrackingEntity[]> {
    return await AdminTelemetryService.traceAsync(
      "service:listSecretRotationStatus",
      { actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_READ, "View secret rotation status");
        return await this.securityRepo.listSecretRotationStatus();
      }
    );
  }

  public async triggerSecretRotation(
    secretId: string,
    actor: IAdminIdentity
  ): Promise<ISecretRotationTrackingEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:triggerSecretRotation",
      { secretId, actor: actor.email },
      async () => {
        this.verifyPermission(actor, AdminPermission.SECURITY_MANAGE_KEYS, "Trigger secret rotation");
        const rotated = await this.securityRepo.triggerSecretRotation(secretId, actor.email);

        AdminStructuredLogger.info(
          `[SecurityAdminService] Secret '${secretId}' rotation triggered by ${actor.email}`
        );
        return rotated;
      }
    );
  }

  private verifyPermission(actor: IAdminIdentity, permission: AdminPermission, actionName: string): void {
    const hasPermission = evaluateAdminPermission(actor, permission);
    if (!hasPermission) {
      AdminStructuredLogger.warn(
        `[SecurityAdminService] Access denied for ${actor.email} (Role: ${actor.role}) attempting action '${actionName}' requiring '${permission}'`
      );
      throw new ForbiddenError(`Insufficient permissions to execute: ${actionName}`);
    }
  }
}
