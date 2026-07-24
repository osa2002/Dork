/**
 * Enterprise Platform Administration - Tenant Management Controller
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Express HTTP Controller Layer for SaaS Tenant Administration
 */

import { Response, NextFunction } from "express";
import { IAdminTenantController } from "./IAdminController";
import { ITenantManagementService } from "../services/IAdminService";
import { TenantManagementService } from "../services/TenantManagementService";
import { AdminAuthenticatedRequest } from "../middleware/adminAuthMiddleware";
import {
  TenantListQueryDTO,
  UpdateTenantStatusDTO,
  UpdateTenantPlanDTO,
  SoftDeleteTenantDTO,
  TenantAuditHistoryQueryDTO
} from "../dto/adminDTOs";
import { UnauthorizedError } from "../../../src/errors/CustomErrors";

export class AdminTenantController implements IAdminTenantController {
  constructor(private tenantService: ITenantManagementService = new TenantManagementService()) {}

  /**
   * GET /api/v1/admin/tenants
   */
  public listTenants = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const query: TenantListQueryDTO = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        status: req.query.status as any,
        planType: req.query.planType as any,
        region: req.query.region as string,
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any
      };

      const result = await this.tenantService.listTenants(query, req.adminIdentity);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/tenants/:shopId
   */
  public getTenantDetails = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { shopId } = req.params;
      const tenant = await this.tenantService.getTenantDetails(shopId, req.adminIdentity);
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v1/admin/tenants/:shopId/status
   */
  public updateTenantStatus = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { shopId } = req.params;
      const dto: UpdateTenantStatusDTO = {
        status: req.body.status,
        reason: req.body.reason
      };

      const updated = await this.tenantService.changeTenantStatus(shopId, dto, req.adminIdentity);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v1/admin/tenants/:shopId/plan
   */
  public updateTenantPlan = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { shopId } = req.params;
      const dto: UpdateTenantPlanDTO = {
        planType: req.body.planType,
        customQuotaOverride: req.body.customQuotaOverride,
        reason: req.body.reason
      };

      const updated = await this.tenantService.changeTenantPlan(shopId, dto, req.adminIdentity);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/v1/admin/tenants/:shopId
   */
  public softDeleteTenant = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { shopId } = req.params;
      const dto: SoftDeleteTenantDTO = {
        reason: req.body.reason
      };

      const deleted = await this.tenantService.softDeleteTenant(shopId, dto, req.adminIdentity);
      res.json(deleted);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/tenants/:shopId/usage
   */
  public getResourceUsage = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { shopId } = req.params;
      const usage = await this.tenantService.getResourceUsage(shopId, req.adminIdentity);
      res.json(usage);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/tenants/:shopId/audit-history
   */
  public getTenantAuditHistory = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { shopId } = req.params;
      const query: TenantAuditHistoryQueryDTO = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50
      };

      const auditHistory = await this.tenantService.getTenantAuditHistory(shopId, query, req.adminIdentity);
      res.json(auditHistory);
    } catch (err) {
      next(err);
    }
  };
}
