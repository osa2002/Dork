/**
 * Enterprise Platform Administration - Monitoring & Incident Controller
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Express Controller for System Diagnostics, Incidents, Alerts, & Maintenance
 */

import { Response, NextFunction } from "express";
import { IAdminMonitoringController } from "./IAdminController";
import { IMonitoringAdminService } from "../services/IAdminService";
import { MonitoringAdminService } from "../services/MonitoringAdminService";
import { AdminAuthenticatedRequest } from "../middleware/adminAuthMiddleware";
import {
  IncidentQueryDTO,
  CreateIncidentDTO,
  UpdateIncidentDTO,
  AlertQueryDTO,
  CreateMaintenanceWindowDTO,
  UpdateMaintenanceStatusDTO
} from "../dto/adminDTOs";
import { UnauthorizedError } from "../../../src/errors/CustomErrors";

export class AdminMonitoringController implements IAdminMonitoringController {
  constructor(
    private monitoringService: IMonitoringAdminService = new MonitoringAdminService()
  ) {}

  /**
   * GET /api/v1/admin/monitoring/diagnostics
   */
  public getDiagnostics = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const diagnostics = await this.monitoringService.getSystemDiagnostics(req.adminIdentity);
      res.json(diagnostics);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/monitoring/incidents
   */
  public listIncidents = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const query: IncidentQueryDTO = {
        status: req.query.status as any,
        severity: req.query.severity as any,
        service: req.query.service as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      };

      const result = await this.monitoringService.listIncidents(query, req.adminIdentity);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/monitoring/incidents/:incidentId
   */
  public getIncidentDetails = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { incidentId } = req.params;
      const incident = await this.monitoringService.getIncidentDetails(incidentId, req.adminIdentity);
      res.json(incident);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/admin/monitoring/incidents
   */
  public createIncident = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const dto: CreateIncidentDTO = {
        title: req.body.title,
        severity: req.body.severity,
        affectedService: req.body.affectedService,
        affectedTenantsCount: req.body.affectedTenantsCount,
        summary: req.body.summary
      };

      const incident = await this.monitoringService.createIncident(dto, req.adminIdentity);
      res.status(201).json(incident);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v1/admin/monitoring/incidents/:incidentId
   */
  public updateIncident = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { incidentId } = req.params;
      const dto: UpdateIncidentDTO = {
        status: req.body.status,
        summary: req.body.summary,
        rootCause: req.body.rootCause,
        updateMessage: req.body.updateMessage
      };

      const updated = await this.monitoringService.updateIncident(incidentId, dto, req.adminIdentity);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/monitoring/alerts
   */
  public listAlerts = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const query: AlertQueryDTO = {
        status: req.query.status as any,
        severity: req.query.severity as any,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      };

      const alerts = await this.monitoringService.listAlerts(query, req.adminIdentity);
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v1/admin/monitoring/alerts/:alertId/acknowledge
   */
  public acknowledgeAlert = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { alertId } = req.params;
      const alert = await this.monitoringService.acknowledgeAlert(alertId, req.adminIdentity);
      res.json(alert);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/monitoring/maintenance
   */
  public listMaintenanceWindows = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const windows = await this.monitoringService.listMaintenanceWindows(req.adminIdentity);
      res.json(windows);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/admin/monitoring/maintenance
   */
  public scheduleMaintenanceWindow = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const dto: CreateMaintenanceWindowDTO = {
        title: req.body.title,
        description: req.body.description,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        affectedServices: req.body.affectedServices
      };

      const window = await this.monitoringService.scheduleMaintenanceWindow(dto, req.adminIdentity);
      res.status(201).json(window);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v1/admin/monitoring/maintenance/:maintenanceId/status
   */
  public updateMaintenanceStatus = async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.adminIdentity) {
        throw new UnauthorizedError("Admin identity context unavailable.");
      }

      const { maintenanceId } = req.params;
      const dto: UpdateMaintenanceStatusDTO = {
        status: req.body.status
      };

      const updated = await this.monitoringService.updateMaintenanceStatus(
        maintenanceId,
        dto,
        req.adminIdentity
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  };
}
