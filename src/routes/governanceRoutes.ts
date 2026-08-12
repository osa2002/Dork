import { Router } from "express";
import {
  getAuditLogs,
  createAuditLog,
  getIncidents,
  createIncident,
  resolveIncident,
  addIncidentTimeline,
  getSLOStatus,
  getDisasterRecoveryStatus,
  simulateRecovery,
  verifyBackups,
  getRunbooks,
  getRetentionPolicy,
  updateRetentionPolicy,
  getGovernanceSummary,
  getOperationalValidationReport,
  executeOperationalValidation
} from "../controllers/governanceController";

const router = Router();

// Enterprise Governance, Audit Logging & Disaster Recovery Backend Endpoints (Phase 6.1)
router.get("/api/governance/summary", getGovernanceSummary);
router.get("/api/governance/validation-report", getOperationalValidationReport);
router.post("/api/governance/execute-validation", executeOperationalValidation);
router.get("/api/governance/audit-logs", getAuditLogs);
router.post("/api/governance/audit-logs", createAuditLog);
router.get("/api/governance/incidents", getIncidents);
router.post("/api/governance/incidents", createIncident);
router.post("/api/governance/incidents/:id/resolve", resolveIncident);
router.post("/api/governance/incidents/:id/timeline", addIncidentTimeline);
router.get("/api/governance/slo", getSLOStatus);
router.get("/api/governance/disaster-recovery", getDisasterRecoveryStatus);
router.post("/api/governance/disaster-recovery/simulate", simulateRecovery);
router.post("/api/governance/disaster-recovery/verify-backups", verifyBackups);
router.get("/api/governance/runbooks", getRunbooks);
router.get("/api/governance/retention", getRetentionPolicy);
router.post("/api/governance/retention", updateRetentionPolicy);

export default router;
