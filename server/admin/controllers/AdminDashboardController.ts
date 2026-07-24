/**
 * Enterprise Platform Administration - Operations Dashboard Controller
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Express HTTP Controller for Platform Operational Telemetry & Metrics
 */

import { Response, NextFunction } from "express";
import { IAdminDashboardController } from "./IAdminController";
import { IOperationsDashboardService } from "../services/IAdminService";
import { PlatformDashboardService } from "../services/PlatformDashboardService";
import { AdminAuthenticatedRequest } from "../middleware/adminAuthMiddleware";
import { OperationsDashboardQueryDTO } from "../dto/adminDTOs";
import { UnauthorizedError } from "../../../src/errors/CustomErrors";

export class AdminDashboardController implements IAdminDashboardController {
  constructor(
    private dashboardService: IOperationsDashboardService = new PlatformDashboardService()
  ) {}

  /**
   * GET /api/v1/admin/dashboard/overview
   * Fetches real-time aggregated platform operational dashboard telemetry.
   */
  public getDashboardOverview = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const query: OperationsDashboardQueryDTO = {
        timeframe: (req.query.timeframe as any) || "24h",
        bypassCache: req.query.bypassCache === "true"
      };

      const result = await this.dashboardService.getOperationsDashboardMetrics(
        query,
        req.adminIdentity
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
