import { RetentionPolicyService } from "./RetentionPolicyService";
import { logContextStorage } from "../lib/serverLogger";

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  correlationId: string;
  userId: string | null;
  shopId: string | null;
  actor: string;
  ip: string;
  userAgent: string;
  operation: string;
  entity: string;
  oldValue: any;
  newValue: any;
  result: "SUCCESS" | "FAILURE";
  duration: number; // in ms
  severity: "INFO" | "WARN" | "ERROR";
}

export class AuditLogService {
  private static logs: AuditLogEvent[] = [];

  /**
   * Log an enterprise audit event.
   */
  public static log(params: {
    userId?: string | null;
    shopId?: string | null;
    actor: string;
    ip?: string;
    userAgent?: string;
    operation: string;
    entity: string;
    oldValue?: any;
    newValue?: any;
    result: "SUCCESS" | "FAILURE";
    duration: number;
    severity?: "INFO" | "WARN" | "ERROR";
  }): AuditLogEvent {
    const store = logContextStorage.getStore();
    const correlationId = store?.correlationId || "system-context";

    const event: AuditLogEvent = {
      id: `audit-${Math.random().toString(36).substring(2, 15)}`,
      timestamp: new Date().toISOString(),
      correlationId,
      userId: params.userId || store?.userId || null,
      shopId: params.shopId || store?.shopId || null,
      actor: params.actor,
      ip: params.ip || "127.0.0.1",
      userAgent: params.userAgent || "Internal Engine",
      operation: params.operation,
      entity: params.entity,
      oldValue: params.oldValue !== undefined ? JSON.parse(JSON.stringify(params.oldValue)) : null,
      newValue: params.newValue !== undefined ? JSON.parse(JSON.stringify(params.newValue)) : null,
      result: params.result,
      duration: params.duration,
      severity: params.severity || "INFO",
    };

    this.logs.push(event);

    // Prune expired logs based on retention policy
    this.prune();

    // Log to standard system console for Cloud Run to capture
    console.log(
      `[AUDIT LOG] [${event.timestamp}] [${event.severity}] [${event.result}] Op: ${event.operation}, Entity: ${event.entity}, Actor: ${event.actor}, CID: ${event.correlationId}`
    );

    return event;
  }

  /**
   * Retrieve all non-expired audit logs with optional filters
   */
  public static getLogs(filters?: {
    operation?: string;
    entity?: string;
    severity?: "INFO" | "WARN" | "ERROR";
    shopId?: string;
  }): AuditLogEvent[] {
    this.prune();
    let filtered = [...this.logs];

    if (filters) {
      if (filters.operation) {
        filtered = filtered.filter((l) => l.operation === filters.operation);
      }
      if (filters.entity) {
        filtered = filtered.filter((l) => l.entity === filters.entity);
      }
      if (filters.severity) {
        filtered = filtered.filter((l) => l.severity === filters.severity);
      }
      if (filters.shopId) {
        filtered = filtered.filter((l) => l.shopId === filters.shopId);
      }
    }

    return filtered.reverse(); // Newest first
  }

  /**
   * Remove logs exceeding auditLogsDays retention policy
   */
  private static prune() {
    this.logs = this.logs.filter((log) => !RetentionPolicyService.isExpired(log.timestamp, "auditLogsDays"));
  }
}
