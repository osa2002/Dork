import { Request, Response, NextFunction } from "express";
import { AuditLogService } from "../services/AuditLogService";
import { IncidentService } from "../services/IncidentService";
import { SLOService } from "../services/SLOService";
import { DisasterRecoveryService } from "../services/DisasterRecoveryService";
import { RetentionPolicyService } from "../services/RetentionPolicyService";
import { runbooks } from "../docs/runbooks";
import { MetricsService } from "../services/MetricsService";

/**
 * POST /api/governance/audit-logs
 * Securely writes an audit log event (client-side or internal actions).
 */
export function createAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, shopId, actor, operation, entity, oldValue, newValue, result, duration, severity } = req.body;
    if (!actor || !operation || !entity || !result) {
      return res.status(400).json({ error: "Missing required fields for audit logging." });
    }
    const log = AuditLogService.log({
      userId,
      shopId,
      actor,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "unknown",
      operation,
      entity,
      oldValue,
      newValue,
      result,
      duration: duration || 0,
      severity,
    });
    res.status(201).json({ success: true, log });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/audit-logs
 * Exposes audit log records with filters.
 */
export function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { operation, entity, severity, shopId } = req.query;
    const logs = AuditLogService.getLogs({
      operation: operation as string,
      entity: entity as string,
      severity: severity as ("INFO" | "WARN" | "ERROR"),
      shopId: shopId as string,
    });
    res.status(200).json({ success: true, count: logs.length, logs });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/incidents
 * Exposes list of incident tickets.
 */
export function getIncidents(req: Request, res: Response, next: NextFunction) {
  try {
    const incidents = IncidentService.getIncidents();
    res.status(200).json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/governance/incidents
 * Create a new incident.
 */
export function createIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description, severity, affectedServices } = req.body;
    if (!title || !description || !severity || !affectedServices) {
      return res.status(400).json({ error: "Missing required fields for incident creation." });
    }
    const incident = IncidentService.createIncident({
      title,
      description,
      severity,
      affectedServices,
    });
    res.status(201).json({ success: true, incident });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/governance/incidents/:id/resolve
 * Resolve an existing incident and auto-generates postmortem.
 */
export function resolveIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { resolutionDetails, actor } = req.body;
    if (!resolutionDetails || !actor) {
      return res.status(400).json({ error: "Missing resolutionDetails or actor." });
    }
    const incident = IncidentService.resolveIncident(id, resolutionDetails, actor);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }
    res.status(200).json({ success: true, incident });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/governance/incidents/:id/timeline
 * Add a timeline event to an incident.
 */
export function addIncidentTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { description, actor } = req.body;
    if (!description || !actor) {
      return res.status(400).json({ error: "Missing description or actor." });
    }
    const incident = IncidentService.addTimelineEvent(id, description, actor);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }
    res.status(200).json({ success: true, incident });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/slo
 * Retrieves the SLA / SLO compliance metrics.
 */
export function getSLOStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = SLOService.getSLOSummary();
    res.status(200).json({ success: true, ...summary });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/disaster-recovery
 * Retrieves backups lists, validation reports, and recovery status.
 */
export function getDisasterRecoveryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const backups = DisasterRecoveryService.getBackups();
    const reports = DisasterRecoveryService.getRecoveryReports();
    res.status(200).json({
      success: true,
      backupsCount: backups.length,
      reportsCount: reports.length,
      backups,
      reports,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/governance/disaster-recovery/simulate
 * Triggers a recovery simulation and issues a validation report.
 */
export function simulateRecovery(req: Request, res: Response, next: NextFunction) {
  try {
    const report = DisasterRecoveryService.simulateRecovery();
    res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/governance/disaster-recovery/verify-backups
 * Triggers an on-demand integrity verification audit of backups.
 */
export function verifyBackups(req: Request, res: Response, next: NextFunction) {
  try {
    const check = DisasterRecoveryService.verifyBackups();
    res.status(200).json({ success: true, ...check });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/runbooks
 * Retrieves SRE structured operational runbooks.
 */
export function getRunbooks(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ success: true, runbooks });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/retention
 * Exposes current configurable retention policies.
 */
export function getRetentionPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const policy = RetentionPolicyService.getPolicy();
    res.status(200).json({ success: true, policy });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/governance/retention
 * Updates configurable retention policies.
 */
export function updateRetentionPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = RetentionPolicyService.updatePolicy(req.body);
    
    // Log change to audit log service
    AuditLogService.log({
      actor: "Security Governance Administrator",
      operation: "UPDATE_RETENTION_POLICY",
      entity: "RetentionPolicy",
      newValue: updated,
      result: "SUCCESS",
      duration: 15,
      severity: "WARN",
    });

    res.status(200).json({ success: true, policy: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/governance/summary
 * Aggregated enterprise-wide health, compliance, and governance metrics.
 */
export function getGovernanceSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const slo = SLOService.getSLOSummary();
    const backupResult = DisasterRecoveryService.verifyBackups();
    const incidents = IncidentService.getIncidents();
    const unresolvedCount = incidents.filter(i => i.status !== "RESOLVED").length;
    const sysMetrics = MetricsService.getSystemMetrics();

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      complianceScore: unresolvedCount === 0 && backupResult.success ? 100 : backupResult.success ? 90 : 70,
      systemHealth: {
        uptimeSeconds: Math.round(process.uptime()),
        cpuLoad: sysMetrics.cpu.loadAvg,
        memoryUsagePercent: 100 - sysMetrics.memory.freePercent,
      },
      securityAndGovernance: {
        auditLogsCount: AuditLogService.getLogs().length,
        unresolvedIncidents: unresolvedCount,
        activeRetentionPolicy: RetentionPolicyService.getPolicy(),
      },
      sloCompliance: {
        apiAvailability: slo.availability.actual,
        errorBudgetRemaining: slo.availability.errorBudgetRemaining,
        latencyP95Ms: slo.latency.actualP95Ms,
      },
      disasterRecovery: {
        lastBackupVerified: backupResult.success,
        missingBackupsDetected: backupResult.missingBackupsDetected,
        timestampCheck: backupResult.timestampCheck,
      }
    });
  } catch (err) {
    next(err);
  }
}
