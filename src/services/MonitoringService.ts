import { logContextStorage, LogLevel } from "../lib/serverLogger";

export enum EventType {
  BUSINESS = "BUSINESS_EVENT",
  SECURITY = "SECURITY_EVENT",
  PERFORMANCE = "PERFORMANCE_EVENT",
  SYSTEM = "SYSTEM_EVENT",
}

export interface StructuredLogEntry {
  timestamp: string;
  severity: string; // Recognized natively by GCP Logging (INFO, WARNING, ERROR, CRITICAL)
  message: string;
  eventType?: EventType;
  correlationId?: string;
  shopId?: string;
  userId?: string;
  context?: any;
  service: string;
  environment: string;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  // Platform fields
  "logging.googleapis.com/trace"?: string;
  "logging.googleapis.com/spanId"?: string;
}

export class MonitoringService {
  private static serviceName = "dorkq-backend";
  private static environment = process.env.NODE_ENV || "development";

  /**
   * Internal common logger engine
   */
  private static log(
    severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL",
    message: string,
    eventType?: EventType,
    context?: any,
    error?: Error | any
  ) {
    const ctx = logContextStorage.getStore();
    const correlationId = ctx?.correlationId;
    const shopId = ctx?.shopId;
    const userId = ctx?.userId;

    // Standard structured entry
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      eventType,
      correlationId,
      shopId,
      userId,
      context: context ? { ...context } : undefined,
      service: this.serviceName,
      environment: this.environment,
    };

    if (error) {
      entry.error = {
        message: error.message || String(error),
        name: error.name || "Error",
        stack: error.stack,
      };
    }

    // Google Cloud Log Correlation if a traceId is derivably formatted
    if (correlationId) {
      const cleaned = correlationId.replace(/[^a-f0-9]/g, "");
      const traceId = cleaned.length >= 32 ? cleaned.substring(0, 32) : cleaned.padEnd(32, "0");
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || "dorkq-prod";
      entry["logging.googleapis.com/trace"] = `projects/${projectId}/traces/${traceId}`;
    }

    if (this.environment === "production") {
      // In production, emit strictly structured JSON on one line to stdout
      process.stdout.write(JSON.stringify(entry) + "\n");
    } else {
      // Readable localized colors in development
      this.printPrettyDevLog(entry);
    }
  }

  /**
   * Print pretty colored terminal entries for development
   */
  private static printPrettyDevLog(entry: StructuredLogEntry) {
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";
    const bold = "\x1b[1m";

    let color = "";
    switch (entry.severity) {
      case "INFO":
        color = "\x1b[32m"; // Green
        break;
      case "WARNING":
        color = "\x1b[33m"; // Yellow
        break;
      case "ERROR":
        color = "\x1b[31m"; // Red
        break;
      case "CRITICAL":
        color = "\x1b[41m\x1b[37m"; // White text on Red bg
        break;
    }

    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
    const tag = entry.eventType ? `[${entry.eventType}]` : "";
    const cid = entry.correlationId ? `[CID:${entry.correlationId.slice(0, 8)}]` : "";
    const shop = entry.shopId ? `[Shop:${entry.shopId.slice(0, 8)}]` : "";
    const contextStr = entry.context ? `\n${dim}Ctx: ${JSON.stringify(entry.context, null, 2)}${reset}` : "";
    const errorStr = entry.error ? `\n\x1b[31m${entry.error.name}: ${entry.error.message}\n${entry.error.stack || ""}${reset}` : "";

    console.log(
      `${dim}${timeStr}${reset} ${color}${bold}[${entry.severity}]${reset} \x1b[36m${tag}${reset}${dim}${cid}${shop}${reset} ${entry.message}${contextStr}${errorStr}`
    );
  }

  // --- STANDARD SEVERITIES ---

  public static info(message: string, context?: any) {
    this.log("INFO", message, undefined, context);
  }

  public static warn(message: string, context?: any) {
    this.log("WARNING", message, undefined, context);
  }

  public static error(message: string, error?: any, context?: any) {
    this.log("ERROR", message, undefined, context, error);
  }

  public static fatal(message: string, error?: any, context?: any) {
    this.log("CRITICAL", message, undefined, context, error);
  }

  // --- SPECIALIZED DOMAIN EVENTS ---

  /**
   * Tracks functional SaaS KPIs (e.g., ticket booking, vendor upgrades)
   */
  public static businessEvent(message: string, eventName: string, context?: any) {
    this.log("INFO", message, EventType.BUSINESS, { ...context, eventName });
  }

  /**
   * Tracks security audits (e.g., auth checks, checkout fraud, limits bypass attempts)
   */
  public static securityEvent(message: string, action: string, success: boolean, context?: any) {
    const level = success ? "INFO" : "WARNING";
    this.log(level, `[Security Audit] ${message}`, EventType.SECURITY, {
      ...context,
      securityAction: action,
      securitySuccess: success,
    });
  }

  /**
   * Tracks core engine and queue performance benchmarks
   */
  public static performanceEvent(message: string, operationName: string, durationMs: number, context?: any) {
    const level = durationMs > 1000 ? "WARNING" : "INFO";
    this.log(level, `[Perf Event] ${message}`, EventType.PERFORMANCE, {
      ...context,
      performanceOp: operationName,
      performanceDurationMs: durationMs,
    });
  }
}
