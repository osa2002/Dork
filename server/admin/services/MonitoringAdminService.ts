/**
 * Enterprise Platform Administration - Monitoring & Incident Service
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Implements business logic, audit recording, and telemetry for Monitoring & Incidents
 */

import { IMonitoringAdminService } from "./IAdminService";
import { IMonitoringAdminRepository } from "../repositories/IAdminRepository";
import { MonitoringAdminRepository } from "../repositories/MonitoringAdminRepository";
import {
  ISystemDiagnosticsEntity,
  IPlatformIncidentEntity,
  ISystemAlertEntity,
  IMaintenanceWindowEntity
} from "../models/adminModels";
import {
  IncidentQueryDTO,
  IncidentListResponseDTO,
  CreateIncidentDTO,
  UpdateIncidentDTO,
  AlertQueryDTO,
  AlertListResponseDTO,
  CreateMaintenanceWindowDTO,
  UpdateMaintenanceStatusDTO
} from "../dto/adminDTOs";
import { IAdminIdentity } from "../permissions/adminPermissions";
import { AdminAuditLogger } from "./AdminAuditLogger";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { AdminTelemetryService } from "./AdminTelemetryService";
import { NotFoundError } from "../../../src/errors/CustomErrors";

export class MonitoringAdminService implements IMonitoringAdminService {
  constructor(
    private monitoringRepo: IMonitoringAdminRepository = new MonitoringAdminRepository()
  ) {}

  /**
   * Fetches real-time system diagnostics across Cloud Run, Firestore, and APIs.
   */
  public async getSystemDiagnostics(actor: IAdminIdentity): Promise<ISystemDiagnosticsEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:getSystemDiagnostics",
      { actor: actor.email, role: actor.role },
      async () => {
        AdminStructuredLogger.debug(`[MonitoringAdminService] System diagnostics requested by ${actor.email}`);
        return await this.monitoringRepo.getSystemDiagnostics();
      }
    );
  }

  /**
   * Queries platform incidents.
   */
  public async listIncidents(
    query: IncidentQueryDTO,
    actor: IAdminIdentity
  ): Promise<IncidentListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listIncidents",
      { actor: actor.email, query },
      async () => {
        AdminStructuredLogger.debug(`[MonitoringAdminService] Incidents list requested by ${actor.email}`);
        return await this.monitoringRepo.findIncidents(query);
      }
    );
  }

  /**
   * Fetches single incident detail with complete immutable timeline.
   */
  public async getIncidentDetails(
    incidentId: string,
    actor: IAdminIdentity
  ): Promise<IPlatformIncidentEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:getIncidentDetails",
      { actor: actor.email, incidentId },
      async () => {
        const incident = await this.monitoringRepo.getIncidentById(incidentId);
        if (!incident) {
          throw new NotFoundError(`Incident '${incidentId}' not found.`);
        }
        return incident;
      }
    );
  }

  /**
   * Declares a new platform incident with audit trail.
   */
  public async createIncident(
    dto: CreateIncidentDTO,
    actor: IAdminIdentity
  ): Promise<IPlatformIncidentEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:createIncident",
      { actor: actor.email, title: dto.title, severity: dto.severity },
      async () => {
        const incident = await this.monitoringRepo.createIncident(dto, actor.email);

        await AdminAuditLogger.record({
          actor,
          action: "CREATE_INCIDENT",
          targetResourceType: "CONFIG",
          targetResourceId: incident.incidentId,
          beforeState: null,
          afterState: {
            title: incident.title,
            severity: incident.severity,
            affectedService: incident.affectedService,
            summary: incident.summary
          },
          ipAddress: "127.0.0.1",
          userAgent: "AdminMonitoringService",
          severity: dto.severity === "CRITICAL" ? "CRITICAL" : "WARNING"
        });

        AdminStructuredLogger.warn(
          `[MonitoringAdminService] Incident ${incident.incidentId} declared by ${actor.email}`
        );

        return incident;
      }
    );
  }

  /**
   * Updates an incident's status, root cause, or adds timeline entry with audit trail.
   */
  public async updateIncident(
    incidentId: string,
    dto: UpdateIncidentDTO,
    actor: IAdminIdentity
  ): Promise<IPlatformIncidentEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:updateIncident",
      { actor: actor.email, incidentId, status: dto.status },
      async () => {
        const beforeState = await this.monitoringRepo.getIncidentById(incidentId);
        if (!beforeState) {
          throw new NotFoundError(`Incident '${incidentId}' not found.`);
        }

        const updated = await this.monitoringRepo.updateIncident(incidentId, dto, actor.email);

        await AdminAuditLogger.record({
          actor,
          action: dto.status === "RESOLVED" ? "RESOLVE_INCIDENT" : "UPDATE_INCIDENT",
          targetResourceType: "CONFIG",
          targetResourceId: incidentId,
          beforeState: { status: beforeState.status, summary: beforeState.summary },
          afterState: {
            status: updated.status,
            summary: updated.summary,
            rootCause: updated.rootCause,
            resolvedAt: updated.resolvedAt
          },
          ipAddress: "127.0.0.1",
          userAgent: "AdminMonitoringService",
          severity: dto.status === "RESOLVED" ? "INFO" : "WARNING"
        });

        AdminStructuredLogger.info(
          `[MonitoringAdminService] Incident ${incidentId} updated to ${updated.status} by ${actor.email}`
        );

        return updated;
      }
    );
  }

  /**
   * Queries platform system alerts.
   */
  public async listAlerts(
    query: AlertQueryDTO,
    actor: IAdminIdentity
  ): Promise<AlertListResponseDTO> {
    return await AdminTelemetryService.traceAsync(
      "service:listAlerts",
      { actor: actor.email, query },
      async () => {
        return await this.monitoringRepo.findAlerts(query);
      }
    );
  }

  /**
   * Acknowledges a triggered system alert.
   */
  public async acknowledgeAlert(
    alertId: string,
    actor: IAdminIdentity
  ): Promise<ISystemAlertEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:acknowledgeAlert",
      { actor: actor.email, alertId },
      async () => {
        const alert = await this.monitoringRepo.acknowledgeAlert(alertId, actor.email);

        await AdminAuditLogger.record({
          actor,
          action: "ACKNOWLEDGE_ALERT",
          targetResourceType: "CONFIG",
          targetResourceId: alertId,
          beforeState: { status: "TRIGGERED" },
          afterState: { status: "ACKNOWLEDGED", acknowledgedBy: actor.email },
          ipAddress: "127.0.0.1",
          userAgent: "AdminMonitoringService",
          severity: "INFO"
        });

        return alert;
      }
    );
  }

  /**
   * Lists scheduled and active maintenance windows.
   */
  public async listMaintenanceWindows(
    actor: IAdminIdentity
  ): Promise<IMaintenanceWindowEntity[]> {
    return await AdminTelemetryService.traceAsync(
      "service:listMaintenanceWindows",
      { actor: actor.email },
      async () => {
        return await this.monitoringRepo.listMaintenanceWindows();
      }
    );
  }

  /**
   * Schedules a new platform maintenance window with audit recording.
   */
  public async scheduleMaintenanceWindow(
    dto: CreateMaintenanceWindowDTO,
    actor: IAdminIdentity
  ): Promise<IMaintenanceWindowEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:scheduleMaintenanceWindow",
      { actor: actor.email, title: dto.title },
      async () => {
        const window = await this.monitoringRepo.createMaintenanceWindow(dto, actor.email);

        await AdminAuditLogger.record({
          actor,
          action: "SCHEDULE_MAINTENANCE",
          targetResourceType: "CONFIG",
          targetResourceId: window.maintenanceId,
          beforeState: null,
          afterState: {
            title: window.title,
            startTime: window.startTime,
            endTime: window.endTime,
            affectedServices: window.affectedServices
          },
          ipAddress: "127.0.0.1",
          userAgent: "AdminMonitoringService",
          severity: "WARNING"
        });

        AdminStructuredLogger.info(
          `[MonitoringAdminService] Maintenance ${window.maintenanceId} scheduled by ${actor.email}`
        );

        return window;
      }
    );
  }

  /**
   * Updates maintenance window status with audit recording.
   */
  public async updateMaintenanceStatus(
    maintenanceId: string,
    dto: UpdateMaintenanceStatusDTO,
    actor: IAdminIdentity
  ): Promise<IMaintenanceWindowEntity> {
    return await AdminTelemetryService.traceAsync(
      "service:updateMaintenanceStatus",
      { actor: actor.email, maintenanceId, status: dto.status },
      async () => {
        const updated = await this.monitoringRepo.updateMaintenanceStatus(
          maintenanceId,
          dto.status,
          actor.email
        );

        await AdminAuditLogger.record({
          actor,
          action: "UPDATE_MAINTENANCE_STATUS",
          targetResourceType: "CONFIG",
          targetResourceId: maintenanceId,
          beforeState: null,
          afterState: { status: updated.status },
          ipAddress: "127.0.0.1",
          userAgent: "AdminMonitoringService",
          severity: "INFO"
        });

        return updated;
      }
    );
  }
}
