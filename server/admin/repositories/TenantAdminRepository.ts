/**
 * Enterprise Platform Administration - Tenant Repository Implementation
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Firestore & Cloud Storage Data Access Layer for SaaS Tenants
 */

import { ITenantAdminRepository } from "./IAdminRepository";
import {
  ITenantOverviewEntity,
  ITenantResourceUsageEntity
} from "../models/adminModels";
import {
  TenantListQueryDTO,
  TenantListResponseDTO,
  AuditLogResponseDTO
} from "../dto/adminDTOs";
import { AdminFirebaseSDK } from "../services/AdminFirebaseSDK";
import { AdminAuditLogger } from "../services/AdminAuditLogger";
import { AdminStructuredLogger } from "../services/AdminStructuredLogger";
import { AdminTelemetryService } from "../services/AdminTelemetryService";
import { NotFoundError } from "../../../src/errors/CustomErrors";

export class TenantAdminRepository implements ITenantAdminRepository {
  private collectionName = "shops";

  /**
   * Queries tenants with search, multi-field filtering, pagination, and sorting.
   */
  public async findTenants(query: TenantListQueryDTO): Promise<TenantListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "repo:findTenants",
      { query },
      async (span) => {
        const db = AdminFirebaseSDK.getInstance().getFirestore();
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

        let queryRef: FirebaseFirestore.Query = db.collection(this.collectionName);

        // Filter by Status
        if (query.status) {
          queryRef = queryRef.where("status", "==", query.status);
        } else {
          // By default, exclude DELETED unless explicitly requested
          queryRef = queryRef.where("status", "!=", "DELETED");
        }

        // Filter by Subscription Plan
        if (query.planType) {
          queryRef = queryRef.where("planType", "==", query.planType);
        }

        // Filter by Region
        if (query.region) {
          queryRef = queryRef.where("region", "==", query.region);
        }

        const snapshot = await queryRef.get();
        let docs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            shopId: doc.id,
            businessName: data.businessName || data.name || doc.id,
            category: data.category || "Retail",
            planType: data.planType || "free",
            status: data.status || "ACTIVE",
            createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString(),
            ownerEmail: data.ownerEmail || data.email || "owner@tenant.com",
            dailyTicketCount: data.dailyTicketCount || 0,
            totalTicketsIssued: data.totalTicketsIssued || 0,
            activeQueueLength: data.activeQueueLength || 0,
            lastActiveTimestamp: data.lastActiveTimestamp || new Date().toISOString(),
            quotaUsagePercent: data.quotaUsagePercent || 0,
            region: data.region || "us-central1",
            deletionReason: data.deletionReason,
            deletedAt: data.deletedAt,
            deletedBy: data.deletedBy
          } as ITenantOverviewEntity;
        });

        // Search Filter (Client/In-memory filtering for partial search matches)
        if (query.search && query.search.trim() !== "") {
          const searchTerm = query.search.trim().toLowerCase();
          docs = docs.filter(t =>
            t.shopId.toLowerCase().includes(searchTerm) ||
            t.businessName.toLowerCase().includes(searchTerm) ||
            t.ownerEmail.toLowerCase().includes(searchTerm)
          );
        }

        // Filter by Creation Date Range
        if (query.startDate) {
          const startMs = new Date(query.startDate).getTime();
          docs = docs.filter(t => new Date(t.createdAt).getTime() >= startMs);
        }
        if (query.endDate) {
          const endMs = new Date(query.endDate).getTime();
          docs = docs.filter(t => new Date(t.createdAt).getTime() <= endMs);
        }

        // Sorting
        const sortBy = query.sortBy || "createdAt";
        const sortOrder = query.sortOrder === "asc" ? 1 : -1;

        docs.sort((a, b) => {
          let valA: any = a[sortBy as keyof ITenantOverviewEntity] || "";
          let valB: any = b[sortBy as keyof ITenantOverviewEntity] || "";

          if (sortBy === "createdAt") {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
          }

          if (valA < valB) return -1 * sortOrder;
          if (valA > valB) return 1 * sortOrder;
          return 0;
        });

        const total = docs.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paginatedTenants = docs.slice(startIndex, startIndex + limit);

        span.setAttribute("tenants.total", total);
        span.setAttribute("tenants.returned", paginatedTenants.length);

        return {
          tenants: paginatedTenants,
          total,
          page,
          limit,
          totalPages
        };
      }
    );
  }

  /**
   * Retrieves single tenant by shop ID.
   */
  public async getTenantById(shopId: string): Promise<ITenantOverviewEntity | null> {
    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const doc = await db.collection(this.collectionName).doc(shopId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      shopId: doc.id,
      businessName: data.businessName || data.name || doc.id,
      category: data.category || "General",
      planType: data.planType || "free",
      status: data.status || "ACTIVE",
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString(),
      ownerEmail: data.ownerEmail || data.email || "owner@tenant.com",
      dailyTicketCount: data.dailyTicketCount || 0,
      totalTicketsIssued: data.totalTicketsIssued || 0,
      activeQueueLength: data.activeQueueLength || 0,
      lastActiveTimestamp: data.lastActiveTimestamp || new Date().toISOString(),
      quotaUsagePercent: data.quotaUsagePercent || 0,
      region: data.region || "us-central1",
      deletionReason: data.deletionReason,
      deletedAt: data.deletedAt,
      deletedBy: data.deletedBy
    };
  }

  /**
   * Modifies tenant status (ACTIVE or SUSPENDED).
   */
  public async updateTenantStatus(
    shopId: string,
    status: "ACTIVE" | "SUSPENDED",
    reason: string,
    actorEmail: string
  ): Promise<ITenantOverviewEntity> {
    const tenant = await this.getTenantById(shopId);
    if (!tenant) {
      throw new NotFoundError(`Tenant '${shopId}' not found.`);
    }

    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const updatedAt = new Date().toISOString();

    await db.collection(this.collectionName).doc(shopId).update({
      status,
      statusUpdateReason: reason,
      statusUpdatedBy: actorEmail,
      updatedAt
    });

    AdminStructuredLogger.info(`[TenantAdminRepository] Tenant ${shopId} status changed to ${status} by ${actorEmail}`);

    return {
      ...tenant,
      status,
      updatedAt
    };
  }

  /**
   * Updates tenant plan and quota settings.
   */
  public async updateTenantPlan(
    shopId: string,
    planType: "free" | "pro" | "enterprise",
    customQuotaOverride: number | undefined,
    reason: string,
    actorEmail: string
  ): Promise<ITenantOverviewEntity> {
    const tenant = await this.getTenantById(shopId);
    if (!tenant) {
      throw new NotFoundError(`Tenant '${shopId}' not found.`);
    }

    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const updatedAt = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      planType,
      planUpdateReason: reason,
      planUpdatedBy: actorEmail,
      updatedAt
    };

    if (customQuotaOverride !== undefined) {
      updatePayload.customQuotaOverride = customQuotaOverride;
    }

    await db.collection(this.collectionName).doc(shopId).update(updatePayload);

    AdminStructuredLogger.info(`[TenantAdminRepository] Tenant ${shopId} plan upgraded to ${planType} by ${actorEmail}`);

    return {
      ...tenant,
      planType,
      updatedAt
    };
  }

  /**
   * Soft deletes a tenant by marking status DELETED with justification audit.
   */
  public async softDeleteTenant(
    shopId: string,
    reason: string,
    actorEmail: string
  ): Promise<ITenantOverviewEntity> {
    const tenant = await this.getTenantById(shopId);
    if (!tenant) {
      throw new NotFoundError(`Tenant '${shopId}' not found.`);
    }

    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const now = new Date().toISOString();

    await db.collection(this.collectionName).doc(shopId).update({
      status: "DELETED",
      deletionReason: reason,
      deletedAt: now,
      deletedBy: actorEmail,
      updatedAt: now
    });

    AdminStructuredLogger.warn(`[TenantAdminRepository] Tenant ${shopId} soft-deleted by ${actorEmail}. Reason: ${reason}`);

    return {
      ...tenant,
      status: "DELETED",
      deletionReason: reason,
      deletedAt: now,
      deletedBy: actorEmail,
      updatedAt: now
    };
  }

  /**
   * Computes or retrieves tenant resource usage breakdown.
   */
  public async getTenantResourceUsage(shopId: string): Promise<ITenantResourceUsageEntity | null> {
    const tenant = await this.getTenantById(shopId);
    if (!tenant) {
      return null;
    }

    const db = AdminFirebaseSDK.getInstance().getFirestore();
    const usageDoc = await db.collection("tenant_resource_usage").doc(shopId).get();

    if (usageDoc.exists) {
      return usageDoc.data() as ITenantResourceUsageEntity;
    }

    // Default calculated metric fallback based on subscription tier
    const tierMaxStorage = tenant.planType === "enterprise" ? 50000 : tenant.planType === "pro" ? 10000 : 1000;
    const tierMaxRequests = tenant.planType === "enterprise" ? 1000000 : tenant.planType === "pro" ? 100000 : 10000;

    return {
      shopId,
      businessName: tenant.businessName,
      planType: tenant.planType,
      currentStorageMb: Math.round((tenant.quotaUsagePercent / 100) * tierMaxStorage * 0.4),
      maxStorageMb: tierMaxStorage,
      dailyApiRequests: tenant.dailyTicketCount * 12,
      maxDailyApiRequests: tierMaxRequests,
      activeConcurrentConnections: tenant.activeQueueLength,
      firestoreReadsToday: tenant.dailyTicketCount * 25,
      firestoreWritesToday: tenant.dailyTicketCount * 8,
      bandwidthUsageGb: Number(((tenant.dailyTicketCount * 0.15) / 1024).toFixed(2)),
      calculatedCostEstUsd: tenant.planType === "enterprise" ? 299 : tenant.planType === "pro" ? 49 : 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Queries immutable audit history specific to a given tenant resource ID.
   */
  public async getTenantAuditHistory(
    shopId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<AuditLogResponseDTO> {
    return await AdminAuditLogger.queryLogs({
      page,
      limit,
      targetResourceId: shopId
    });
  }
}
