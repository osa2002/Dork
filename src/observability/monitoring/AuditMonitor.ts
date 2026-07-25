import { FirestoreAuditTrail, AuditTrailEntry } from "../../infrastructure/billing/audit/FirestoreAuditTrail";

export interface SecurityAnomaly {
  anomalyId: string;
  tenantId: string;
  type: "RAPID_REFUNDS_SPIKE" | "UNAUTHORIZED_CROSS_TENANT_ACCESS" | "SUSPICIOUS_ADMIN_ACTION";
  severity: "HIGH" | "CRITICAL";
  detectedAt: string;
  description: string;
  relatedAuditEntries: string[];
}

export class AuditMonitor {
  private readonly auditTrail: FirestoreAuditTrail;

  constructor(auditTrail?: FirestoreAuditTrail) {
    this.auditTrail = auditTrail || new FirestoreAuditTrail();
  }

  /**
   * Scans audit trail records for security and compliance anomalies.
   */
  public async detectAnomalies(tenantId: string): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];
    const entries = await this.auditTrail.getTrail(tenantId, undefined, 100);

    // 1. Detect rapid refund spike (e.g. > 3 refunds within short timeframe)
    const refundEntries = entries.filter(e => e.entityType === "Refund" && e.action === "REFUND_PROCESSED");
    if (refundEntries.length >= 3) {
      anomalies.push({
        anomalyId: `anom_refund_${Date.now()}`,
        tenantId,
        type: "RAPID_REFUNDS_SPIKE",
        severity: "HIGH",
        detectedAt: new Date().toISOString(),
        description: `Detected ${refundEntries.length} refund process actions in recent audit trail.`,
        relatedAuditEntries: refundEntries.map(e => e.auditId)
      });
    }

    return anomalies;
  }
}
