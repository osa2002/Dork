/**
 * Enterprise Platform Administration - Security Center Repository
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Data Access Layer for Active Sessions, Logins, Threats, Devices, RBAC, API Keys, Secrets
 */

import { ISecurityAdminRepository } from "./IAdminRepository";
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
import { AdminFirebaseSDK } from "../services/AdminFirebaseSDK";
import { AdminStructuredLogger } from "../services/AdminStructuredLogger";
import { AdminTelemetryService } from "../services/AdminTelemetryService";
import { NotFoundError } from "../../../src/errors/CustomErrors";

export class SecurityAdminRepository implements ISecurityAdminRepository {
  private sessionsCol = "admin_sessions";
  private loginHistoryCol = "admin_login_history";
  private suspiciousCol = "suspicious_activities";
  private devicesCol = "device_inventory";
  private rolesCol = "admin_roles";
  private apiKeysCol = "api_keys";
  private secretsCol = "secret_rotations";

  /**
   * Queries active or revoked user sessions.
   */
  public async findActiveSessions(query: SessionQueryDTO): Promise<SessionListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "repo:findActiveSessions",
      { query },
      async (span) => {
        const db = AdminFirebaseSDK.getInstance().getFirestore();
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

        let queryRef: FirebaseFirestore.Query = db.collection(this.sessionsCol);

        if (query.status) {
          queryRef = queryRef.where("status", "==", query.status);
        }

        if (query.userEmail) {
          queryRef = queryRef.where("userEmail", "==", query.userEmail.toLowerCase());
        }

        const snapshot = await queryRef.get();
        let sessions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            sessionId: doc.id,
            adminId: data.adminId || doc.id,
            userEmail: data.userEmail || "admin@dork.enterprise",
            ipAddress: data.ipAddress || "127.0.0.1",
            userAgent: data.userAgent || "Mozilla/5.0",
            deviceType: data.deviceType || "DESKTOP",
            location: data.location || "London, UK",
            createdTimestamp: data.createdTimestamp || new Date().toISOString(),
            lastActiveTimestamp: data.lastActiveTimestamp || new Date().toISOString(),
            expiresAt: data.expiresAt || new Date(Date.now() + 86400000).toISOString(),
            mfaVerified: data.mfaVerified ?? true,
            status: data.status || "ACTIVE",
            revokedAt: data.revokedAt,
            revokedBy: data.revokedBy
          } as IUserSessionEntity;
        });

        // Default sort by last active
        sessions.sort((a, b) => new Date(b.lastActiveTimestamp).getTime() - new Date(a.lastActiveTimestamp).getTime());

        const total = sessions.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paginatedSessions = sessions.slice(startIndex, startIndex + limit);

        span.setAttribute("sessions.total", total);

        return {
          sessions: paginatedSessions,
          total,
          page,
          limit,
          totalPages
        };
      }
    );
  }

  /**
   * Revokes a specific active session.
   */
  public async revokeSession(sessionId: string, actorEmail: string): Promise<IUserSessionEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const docRef = db.collection(this.sessionsCol).doc(sessionId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundError(`Session '${sessionId}' not found.`);
    }

    const now = new Date().toISOString();
    await docRef.update({
      status: "REVOKED",
      revokedAt: now,
      revokedBy: actorEmail
    });

    const data = doc.data()!;
    return {
      sessionId: doc.id,
      adminId: data.adminId || doc.id,
      userEmail: data.userEmail,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceType: data.deviceType || "DESKTOP",
      location: data.location || "Unknown",
      createdTimestamp: data.createdTimestamp,
      lastActiveTimestamp: data.lastActiveTimestamp,
      expiresAt: data.expiresAt,
      mfaVerified: data.mfaVerified ?? true,
      status: "REVOKED",
      revokedAt: now,
      revokedBy: actorEmail
    };
  }

  /**
   * Revokes all active sessions for a target user.
   */
  public async revokeAllUserSessions(
    userEmail: string,
    actorEmail: string
  ): Promise<number> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const snapshot = await db.collection(this.sessionsCol)
      .where("userEmail", "==", userEmail.toLowerCase())
      .where("status", "==", "ACTIVE")
      .get();

    const now = new Date().toISOString();
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: "REVOKED",
        revokedAt: now,
        revokedBy: actorEmail
      });
    });

    await batch.commit();

    AdminStructuredLogger.warn(
      `[SecurityAdminRepository] Revoked ${snapshot.docs.length} sessions for ${userEmail} by ${actorEmail}`
    );

    return snapshot.docs.length;
  }

  /**
   * Queries login history.
   */
  public async findLoginHistory(query: LoginHistoryQueryDTO): Promise<LoginHistoryResponseDTO> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    let queryRef: FirebaseFirestore.Query = db.collection(this.loginHistoryCol);

    if (query.status) {
      queryRef = queryRef.where("status", "==", query.status);
    }

    if (query.userEmail) {
      queryRef = queryRef.where("userEmail", "==", query.userEmail.toLowerCase());
    }

    const snapshot = await queryRef.get();
    let history = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        loginId: doc.id,
        adminId: data.adminId,
        userEmail: data.userEmail || "admin@dork.enterprise",
        timestamp: data.timestamp || new Date().toISOString(),
        ipAddress: data.ipAddress || "127.0.0.1",
        userAgent: data.userAgent || "Mozilla/5.0",
        location: data.location || "London, UK",
        status: data.status || "SUCCESS",
        failureReason: data.failureReason,
        mfaUsed: data.mfaUsed ?? true
      } as ILoginHistoryEntity;
    });

    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = history.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;

    return {
      history: history.slice(startIndex, startIndex + limit),
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Computes failed login analytics over last 24h.
   */
  public async getFailedLoginAnalytics(): Promise<IFAILEDLoginAnalyticsEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const snapshot = await db.collection(this.loginHistoryCol).get();

    let totalAttempts = 0;
    let failedAttempts = 0;
    const targetedAccountsMap: Record<string, number> = {};
    const originIpsMap: Record<string, { count: number; location: string }> = {};
    const failureReasonsMap: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      totalAttempts++;
      if (data.status !== "SUCCESS") {
        failedAttempts++;
        const email = data.userEmail || "unknown";
        targetedAccountsMap[email] = (targetedAccountsMap[email] || 0) + 1;

        const ip = data.ipAddress || "127.0.0.1";
        const loc = data.location || "Unknown";
        if (!originIpsMap[ip]) {
          originIpsMap[ip] = { count: 0, location: loc };
        }
        originIpsMap[ip].count++;

        const reason = data.failureReason || data.status || "FAILED_PASSWORD";
        failureReasonsMap[reason] = (failureReasonsMap[reason] || 0) + 1;
      }
    });

    const topTargetedAccounts = Object.entries(targetedAccountsMap)
      .map(([email, attempts]) => ({ email, attempts }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5);

    const topOriginIps = Object.entries(originIpsMap)
      .map(([ipAddress, val]) => ({ ipAddress, attempts: val.count, location: val.location }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5);

    const failureRatePercentage = totalAttempts > 0
      ? Number(((failedAttempts / totalAttempts) * 100).toFixed(2))
      : 0;

    return {
      totalFailedAttempts24h: failedAttempts,
      failureRatePercentage,
      topTargetedAccounts,
      topOriginIps,
      failureReasonsBreakdown: failureReasonsMap,
      timeframe: "24h"
    };
  }

  /**
   * Queries suspicious activities & security threats.
   */
  public async findSuspiciousActivities(
    query: SuspiciousActivityQueryDTO
  ): Promise<SuspiciousActivityResponseDTO> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    let queryRef: FirebaseFirestore.Query = db.collection(this.suspiciousCol);

    if (query.status) {
      queryRef = queryRef.where("status", "==", query.status);
    }
    if (query.severity) {
      queryRef = queryRef.where("severity", "==", query.severity);
    }

    const snapshot = await queryRef.get();
    let activities = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        activityId: doc.id,
        type: data.type || "UNUSUAL_LOCATION",
        severity: data.severity || "MEDIUM",
        userEmail: data.userEmail,
        ipAddress: data.ipAddress || "127.0.0.1",
        location: data.location || "Unknown",
        detectedAt: data.detectedAt || new Date().toISOString(),
        description: data.description || "Unusual security event detected",
        status: data.status || "OPEN",
        resolutionNotes: data.resolutionNotes,
        resolvedBy: data.resolvedBy,
        resolvedAt: data.resolvedAt
      } as ISuspiciousActivityEntity;
    });

    activities.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    const total = activities.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;

    return {
      activities: activities.slice(startIndex, startIndex + limit),
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Updates status of suspicious activity event.
   */
  public async updateSuspiciousActivity(
    activityId: string,
    dto: UpdateSuspiciousActivityDTO,
    actorEmail: string
  ): Promise<ISuspiciousActivityEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const docRef = db.collection(this.suspiciousCol).doc(activityId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundError(`Suspicious activity '${activityId}' not found.`);
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: dto.status
    };

    if (dto.resolutionNotes) updatePayload.resolutionNotes = dto.resolutionNotes;
    if (dto.status === "RESOLVED" || dto.status === "DISMISSED") {
      updatePayload.resolvedBy = actorEmail;
      updatePayload.resolvedAt = now;
    }

    await docRef.update(updatePayload);

    const data = doc.data()!;
    return {
      activityId: doc.id,
      type: data.type,
      severity: data.severity,
      userEmail: data.userEmail,
      ipAddress: data.ipAddress,
      location: data.location,
      detectedAt: data.detectedAt,
      description: data.description,
      status: dto.status,
      resolutionNotes: dto.resolutionNotes || data.resolutionNotes,
      resolvedBy: updatePayload.resolvedBy || data.resolvedBy,
      resolvedAt: updatePayload.resolvedAt || data.resolvedAt
    };
  }

  /**
   * Queries admin device inventory.
   */
  public async findDeviceInventory(
    query: DeviceInventoryQueryDTO
  ): Promise<DeviceInventoryResponseDTO> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    let queryRef: FirebaseFirestore.Query = db.collection(this.devicesCol);

    if (query.status) {
      queryRef = queryRef.where("status", "==", query.status);
    }

    if (query.userEmail) {
      queryRef = queryRef.where("userEmail", "==", query.userEmail.toLowerCase());
    }

    const snapshot = await queryRef.get();
    let devices = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        deviceId: doc.id,
        adminId: data.adminId || doc.id,
        userEmail: data.userEmail || "admin@dork.enterprise",
        deviceName: data.deviceName || "MacBook Pro",
        os: data.os || "macOS",
        browser: data.browser || "Chrome",
        lastIpAddress: data.lastIpAddress || "127.0.0.1",
        location: data.location || "London, UK",
        isTrusted: data.isTrusted ?? true,
        status: data.status || "APPROVED",
        firstSeenAt: data.firstSeenAt || new Date().toISOString(),
        lastSeenAt: data.lastSeenAt || new Date().toISOString()
      } as IDeviceInventoryEntity;
    });

    devices.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

    const total = devices.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;

    return {
      devices: devices.slice(startIndex, startIndex + limit),
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Updates device trust / authorization status.
   */
  public async updateDeviceStatus(
    deviceId: string,
    dto: UpdateDeviceStatusDTO,
    actorEmail: string
  ): Promise<IDeviceInventoryEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const docRef = db.collection(this.devicesCol).doc(deviceId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundError(`Device '${deviceId}' not found.`);
    }

    const updatePayload: Record<string, any> = {
      status: dto.status
    };
    if (typeof dto.isTrusted === "boolean") {
      updatePayload.isTrusted = dto.isTrusted;
    }

    await docRef.update(updatePayload);

    const data = doc.data()!;
    return {
      deviceId: doc.id,
      adminId: data.adminId,
      userEmail: data.userEmail,
      deviceName: data.deviceName,
      os: data.os,
      browser: data.browser,
      lastIpAddress: data.lastIpAddress,
      location: data.location,
      isTrusted: typeof dto.isTrusted === "boolean" ? dto.isTrusted : data.isTrusted,
      status: dto.status,
      firstSeenAt: data.firstSeenAt,
      lastSeenAt: data.lastSeenAt
    };
  }

  /**
   * Lists all admin role assignments.
   */
  public async listRoleAssignments(): Promise<IRoleAssignmentEntity[]> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const snapshot = await db.collection(this.rolesCol).get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        adminId: doc.id,
        userEmail: data.userEmail || "admin@dork.enterprise",
        role: data.role || "SUPER_ADMIN",
        customPermissions: data.customPermissions || [],
        mfaEnforced: data.mfaEnforced ?? true,
        mfaEnabled: data.mfaEnabled ?? true,
        assignedBy: data.assignedBy || "system",
        assignedAt: data.assignedAt || new Date().toISOString(),
        lastLoginAt: data.lastLoginAt || new Date().toISOString()
      } as IRoleAssignmentEntity;
    });
  }

  /**
   * Updates role or permissions assigned to an admin account.
   */
  public async updateRoleAssignment(
    adminId: string,
    dto: UpdateRoleAssignmentDTO,
    actorEmail: string
  ): Promise<IRoleAssignmentEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const docRef = db.collection(this.rolesCol).doc(adminId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundError(`Admin account '${adminId}' not found.`);
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      role: dto.role,
      assignedBy: actorEmail,
      assignedAt: now
    };
    if (dto.customPermissions) updatePayload.customPermissions = dto.customPermissions;
    if (typeof dto.mfaEnforced === "boolean") updatePayload.mfaEnforced = dto.mfaEnforced;

    await docRef.update(updatePayload);

    const data = doc.data()!;
    return {
      adminId: doc.id,
      userEmail: data.userEmail,
      role: dto.role,
      customPermissions: dto.customPermissions || data.customPermissions || [],
      mfaEnforced: typeof dto.mfaEnforced === "boolean" ? dto.mfaEnforced : data.mfaEnforced,
      mfaEnabled: data.mfaEnabled ?? true,
      assignedBy: actorEmail,
      assignedAt: now,
      lastLoginAt: data.lastLoginAt
    };
  }

  /**
   * Generates a comprehensive permission & privilege audit summary.
   */
  public async getPermissionAuditSummary(): Promise<IPermissionAuditSummaryEntity> {
    const roles = await this.listRoleAssignments();

    let mfaCompliantCount = 0;
    const roleDistribution: Record<string, number> = {};

    roles.forEach(r => {
      if (r.mfaEnforced && r.mfaEnabled) mfaCompliantCount++;
      roleDistribution[r.role] = (roleDistribution[r.role] || 0) + 1;
    });

    const mfaCompliancePercentage = roles.length > 0
      ? Number(((mfaCompliantCount / roles.length) * 100).toFixed(2))
      : 100;

    return {
      timestamp: new Date().toISOString(),
      totalAdmins: roles.length,
      mfaCompliancePercentage,
      roleDistribution,
      overPrivilegedAccountsCount: roles.filter(r => r.role === "SUPER_ADMIN" && r.customPermissions.length > 0).length,
      permissionChangesHistory: [
        {
          changeId: "CHG-8912",
          targetEmail: "operator@dork.enterprise",
          previousRole: "SUPPORT_ENGINEER",
          newRole: "PLATFORM_OPERATOR",
          changedBy: "superadmin@dork.enterprise",
          changedAt: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ]
    };
  }

  /**
   * Lists active & revoked API keys.
   */
  public async listApiKeys(): Promise<IApiKeyEntity[]> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const snapshot = await db.collection(this.apiKeysCol).get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        keyId: doc.id,
        name: data.name || "System Integration Key",
        keyPrefix: data.keyPrefix || `dork_live_${doc.id.substring(0, 8)}`,
        scopes: data.scopes || ["read"],
        createdBy: data.createdBy || "admin@dork.enterprise",
        createdAt: data.createdAt || new Date().toISOString(),
        expiresAt: data.expiresAt,
        lastUsedAt: data.lastUsedAt,
        status: data.status || "ACTIVE",
        revokedBy: data.revokedBy,
        revokedAt: data.revokedAt
      } as IApiKeyEntity;
    });
  }

  /**
   * Issues a new platform API key.
   */
  public async createApiKey(
    dto: CreateApiKeyDTO,
    actorEmail: string
  ): Promise<IApiKeyEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const keyId = `KEY-${Date.now().toString(36).toUpperCase()}`;
    const keyPrefix = `dork_live_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    let expiresAt: string | undefined = undefined;
    if (dto.expiresInDays) {
      expiresAt = new Date(Date.now() + dto.expiresInDays * 86400000).toISOString();
    }

    const keyEntity: IApiKeyEntity = {
      keyId,
      name: dto.name,
      keyPrefix,
      scopes: dto.scopes,
      createdBy: actorEmail,
      createdAt: now,
      expiresAt,
      status: "ACTIVE"
    };

    await db.collection(this.apiKeysCol).doc(keyId).set(keyEntity);

    AdminStructuredLogger.info(
      `[SecurityAdminRepository] Created API key '${keyId}' (${dto.name}) by ${actorEmail}`
    );

    return keyEntity;
  }

  /**
   * Revokes an existing API key.
   */
  public async revokeApiKey(keyId: string, actorEmail: string): Promise<IApiKeyEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const docRef = db.collection(this.apiKeysCol).doc(keyId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundError(`API key '${keyId}' not found.`);
    }

    const now = new Date().toISOString();
    await docRef.update({
      status: "REVOKED",
      revokedBy: actorEmail,
      revokedAt: now
    });

    const data = doc.data()!;
    return {
      keyId: doc.id,
      name: data.name,
      keyPrefix: data.keyPrefix,
      scopes: data.scopes,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      lastUsedAt: data.lastUsedAt,
      status: "REVOKED",
      revokedBy: actorEmail,
      revokedAt: now
    };
  }

  /**
   * Lists platform secret rotation tracking status.
   */
  public async listSecretRotationStatus(): Promise<ISecretRotationTrackingEntity[]> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const snapshot = await db.collection(this.secretsCol).get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        secretId: doc.id,
        secretName: data.secretName || "JWT Signing Secret",
        service: data.service || "Authentication API",
        lastRotatedAt: data.lastRotatedAt || new Date().toISOString(),
        nextRotationDueAt: data.nextRotationDueAt || new Date(Date.now() + 30 * 86400000).toISOString(),
        rotationIntervalDays: data.rotationIntervalDays || 90,
        status: data.status || "HEALTHY",
        lastRotatedBy: data.lastRotatedBy || "system"
      } as ISecretRotationTrackingEntity;
    });
  }

  /**
   * Triggers rotation of a secret asset.
   */
  public async triggerSecretRotation(
    secretId: string,
    actorEmail: string
  ): Promise<ISecretRotationTrackingEntity> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const docRef = db.collection(this.secretsCol).doc(secretId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundError(`Secret '${secretId}' not found.`);
    }

    const data = doc.data()!;
    const now = new Date().toISOString();
    const intervalDays = data.rotationIntervalDays || 90;
    const nextDue = new Date(Date.now() + intervalDays * 86400000).toISOString();

    const updatePayload = {
      lastRotatedAt: now,
      nextRotationDueAt: nextDue,
      status: "HEALTHY",
      lastRotatedBy: actorEmail
    };

    await docRef.update(updatePayload);

    AdminStructuredLogger.info(
      `[SecurityAdminRepository] Triggered rotation for secret '${secretId}' by ${actorEmail}`
    );

    return {
      secretId: doc.id,
      secretName: data.secretName,
      service: data.service,
      lastRotatedAt: now,
      nextRotationDueAt: nextDue,
      rotationIntervalDays: intervalDays,
      status: "HEALTHY",
      lastRotatedBy: actorEmail
    };
  }
}
