/**
 * Enterprise Platform Administration - Tenant Management Service
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Implements business rules, audit enforcement, and lifecycle governance for SaaS tenants.
 */

import { ITenantManagementService } from "./IAdminService";
import { ITenantAdminRepository } from "../repositories/IAdminRepository";
import { TenantAdminRepository } from "../repositories/TenantAdminRepository";
import {
  ITenantOverviewEntity,
  ITenantResourceUsageEntity
} from "../models/adminModels";
import {
  TenantListQueryDTO,
  TenantListResponseDTO,
  UpdateTenantStatusDTO,
  UpdateTenantPlanDTO,
  SoftDeleteTenantDTO,
  TenantAuditHistoryQueryDTO,
  AuditLogResponseDTO
} from "../dto/adminDTOs";
import { IAdminIdentity } from "../permissions/adminPermissions";
import { AdminAuditLogger } from "./AdminAuditLogger";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { AdminTelemetryService } from "./AdminTelemetryService";
import { NotFoundError } from "../../../src/errors/CustomErrors";

export class TenantManagementService implements ITenantManagementService {
  constructor(private tenantRepository: ITenantAdminRepository = new TenantAdminRepository()) {}

  /**
   * Lists tenants with pagination, multi-field search, region, date range, and sorting.
   */
  public async listTenants(
    query: TenantListQueryDTO,
    actor: IAdminIdentity
  ): Promise<TenantListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listTenants",
      { actor: actor.email, role: actor.role, query },
      async (span) => {
        AdminStructuredLogger.debug(`[TenantManagementService] Listing tenants requested by ${actor.email}`);
        const result = await this.tenantRepository.findTenants(query);
        span.setAttribute("result.total", result.total);
        return result;
      }
    );
  }

  /**
   * Retrieves single tenant detailed profile.
   */
  public async getTenantDetails(
    shopId: string,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:getTenantDetails",
      { actor: actor.email, shopId },
      async () => {
        const tenant = await this.tenantRepository.getTenantById(shopId);
        if (!tenant) {
          throw new NotFoundError(`Tenant '${shopId}' does not exist.`);
        }
        return tenant;
      }
    );
  }

  /**
   * Suspends or Reactivates a tenant with mandatory audit record generation.
   */
  public async changeTenantStatus(
    shopId: string,
    dto: UpdateTenantStatusDTO,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:changeTenantStatus",
      { actor: actor.email, shopId, newStatus: dto.status },
      async () => {
        const beforeState = await this.tenantRepository.getTenantById(shopId);
        if (!beforeState) {
          throw new NotFoundError(`Tenant '${shopId}' not found.`);
        }

        const actionName = dto.status === "SUSPENDED" ? "SUSPEND_TENANT" : "REACTIVATE_TENANT";

        const updatedTenant = await this.tenantRepository.updateTenantStatus(
          shopId,
          dto.status,
          dto.reason,
          actor.email
        );

        // Immutable Audit Record
        await AdminAuditLogger.record({
          actor,
          action: actionName,
          targetResourceType: "TENANT",
          targetResourceId: shopId,
          beforeState: { status: beforeState.status },
          afterState: { status: updatedTenant.status, reason: dto.reason },
          ipAddress: "127.0.0.1",
          userAgent: "AdminCoreService",
          severity: dto.status === "SUSPENDED" ? "WARNING" : "INFO"
        });

        AdminStructuredLogger.info(
          `[TenantManagementService] Tenant '${shopId}' status set to ${dto.status} by ${actor.email}. Reason: ${dto.reason}`
        );

        return updatedTenant;
      }
    );
  }

  /**
   * Modifies tenant plan tier or custom quota overrides.
   */
  public async changeTenantPlan(
    shopId: string,
    dto: UpdateTenantPlanDTO,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:changeTenantPlan",
      { actor: actor.email, shopId, newPlan: dto.planType },
      async () => {
        const beforeState = await this.tenantRepository.getTenantById(shopId);
        if (!beforeState) {
          throw new NotFoundError(`Tenant '${shopId}' not found.`);
        }

        const updatedTenant = await this.tenantRepository.updateTenantPlan(
          shopId,
          dto.planType,
          dto.customQuotaOverride,
          dto.reason,
          actor.email
        );

        // Immutable Audit Record
        await AdminAuditLogger.record({
          actor,
          action: "MIGRATE_TENANT_TIER",
          targetResourceType: "TENANT",
          targetResourceId: shopId,
          beforeState: { planType: beforeState.planType },
          afterState: {
            planType: updatedTenant.planType,
            customQuotaOverride: dto.customQuotaOverride,
            reason: dto.reason
          },
          ipAddress: "127.0.0.1",
          userAgent: "AdminCoreService",
          severity: "WARNING"
        });

        AdminStructuredLogger.info(
          `[TenantManagementService] Tenant '${shopId}' plan changed from ${beforeState.planType} to ${dto.planType} by ${actor.email}`
        );

        return updatedTenant;
      }
    );
  }

  /**
   * Soft-deletes a tenant from the system with justification requirement.
   */
  public async softDeleteTenant(
    shopId: string,
    dto: SoftDeleteTenantDTO,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:softDeleteTenant",
      { actor: actor.email, shopId },
      async () => {
        const beforeState = await this.tenantRepository.getTenantById(shopId);
        if (!beforeState) {
          throw new NotFoundError(`Tenant '${shopId}' not found.`);
        }

        const updatedTenant = await this.tenantRepository.softDeleteTenant(
          shopId,
          dto.reason,
          actor.email
        );

        // Immutable Audit Record
        await AdminAuditLogger.record({
          actor,
          action: "SOFT_DELETE_TENANT",
          targetResourceType: "TENANT",
          targetResourceId: shopId,
          beforeState: { status: beforeState.status },
          afterState: { status: "DELETED", deletionReason: dto.reason },
          ipAddress: "127.0.0.1",
          userAgent: "AdminCoreService",
          severity: "CRITICAL"
        });

        AdminStructuredLogger.warn(
          `[TenantManagementService] Tenant '${shopId}' soft-deleted by ${actor.email}. Reason: ${dto.reason}`
        );

        return updatedTenant;
      }
    );
  }

  /**
   * Fetches real-time or estimated resource usage for a tenant.
   */
  public async getResourceUsage(
    shopId: string,
    actor: IAdminIdentity
  ): Promise<ITenantResourceUsageEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:getResourceUsage",
      { actor: actor.email, shopId },
      async () => {
        const usage = await this.tenantRepository.getTenantResourceUsage(shopId);
        if (!usage) {
          throw new NotFoundError(`Tenant '${shopId}' not found.`);
        }
        return usage;
      }
    );
  }

  /**
   * Retrieves governance audit history specifically filtered for a single tenant.
   */
  public async getTenantAuditHistory(
    shopId: string,
    query: TenantAuditHistoryQueryDTO,
    actor: IAdminIdentity
  ): Promise<AuditLogResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:getTenantAuditHistory",
      { actor: actor.email, shopId },
      async () => {
        const page = query.page || 1;
        const limit = query.limit || 50;
        return await this.tenantRepository.getTenantAuditHistory(shopId, page, limit);
      }
    );
  }
}
