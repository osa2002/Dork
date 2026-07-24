/**
 * Enterprise Platform Administration - Platform Dashboard Service
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Implements Read-Only Operations Dashboard Service with Telemetry & Logging
 */

import { IOperationsDashboardService } from "./IAdminService";
import { IDashboardRepository } from "../repositories/IAdminRepository";
import { PlatformDashboardRepository } from "../repositories/PlatformDashboardRepository";
import {
  OperationsDashboardQueryDTO,
  OperationsDashboardResponseDTO
} from "../dto/adminDTOs";
import { IAdminIdentity } from "../permissions/adminPermissions";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { AdminTelemetryService } from "./AdminTelemetryService";

export class PlatformDashboardService implements IOperationsDashboardService {
  constructor(
    private dashboardRepository: IDashboardRepository = new PlatformDashboardRepository()
  ) {}

  /**
   * Fetches aggregated operations dashboard metrics for platform administration.
   */
  public async getOperationsDashboardMetrics(
    query: OperationsDashboardQueryDTO,
    actor: IAdminIdentity
  ): Promise<OperationsDashboardResponseDTO> {
    const timeframe = query.timeframe || "24h";

    return await AdminTelemetryService.traceAsync(
      "service:getOperationsDashboardMetrics",
      { actor: actor.email, role: actor.role, timeframe },
      async (span) => {
        AdminStructuredLogger.info(
          `[PlatformDashboardService] Aggregating operational dashboard metrics requested by ${actor.email} (${timeframe})`
        );

        const data = await this.dashboardRepository.getAggregatedDashboardMetrics(timeframe);

        span.setAttribute("dashboard.activeTenants", data.tenantsOverview.activeTenantsCount);
        span.setAttribute("dashboard.totalQueued", data.queueAndTicketMetrics.totalQueuedCustomers);

        return {
          data,
          timeframe,
          cached: !query.bypassCache,
          generatedAt: new Date().toISOString()
        };
      }
    );
  }
}
