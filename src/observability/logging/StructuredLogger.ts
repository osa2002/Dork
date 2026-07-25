import { AsyncLocalStorage } from "async_hooks";

export type LogSeverity = "DEBUG" | "INFO" | "NOTICE" | "WARNING" | "ERROR" | "CRITICAL";

export interface LogContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  billingAccountId?: string;
  userId?: string;
  providerId?: string;
  service?: string;
  component?: string;
  [key: string]: any;
}

export interface StructuredLogRecord {
  timestamp: string;
  severity: LogSeverity;
  message: string;
  service: string;
  component: string;
  context: LogContext;
  labels: Record<string, string>;
  httpRequest?: {
    requestMethod?: string;
    requestUrl?: string;
    status?: number;
    userAgent?: string;
    remoteIp?: string;
    latencyMs?: number;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    details?: any;
  };
  "logging.googleapis.com/trace"?: string;
  "logging.googleapis.com/spanId"?: string;
}

const contextStorage = new AsyncLocalStorage<LogContext>();

export class StructuredLogger {
  private readonly serviceName: string;
  private readonly componentName: string;
  private readonly defaultLabels: Record<string, string>;

  constructor(serviceName: string = "billing-platform", componentName: string = "core", defaultLabels: Record<string, string> = {}) {
    this.serviceName = serviceName;
    this.componentName = componentName;
    this.defaultLabels = {
      environment: process.env.NODE_ENV || "production",
      platform: "cloud-run",
      ...defaultLabels
    };
  }

  public static runWithContext<T>(context: LogContext, fn: () => T): T {
    const existing = contextStorage.getStore() || {};
    return contextStorage.run({ ...existing, ...context }, fn);
  }

  public static getContext(): LogContext {
    return contextStorage.getStore() || {};
  }

  private buildLogRecord(
    severity: LogSeverity,
    message: string,
    additionalContext?: LogContext,
    error?: Error | any
  ): StructuredLogRecord {
    const currentContext = { ...StructuredLogger.getContext(), ...additionalContext };
    const timestamp = new Date().toISOString();

    const record: StructuredLogRecord = {
      timestamp,
      severity,
      message,
      service: this.serviceName,
      component: currentContext.component || this.componentName,
      context: currentContext,
      labels: this.defaultLabels
    };

    if (currentContext.traceId) {
      record["logging.googleapis.com/trace"] = currentContext.traceId;
    }
    if (currentContext.spanId) {
      record["logging.googleapis.com/spanId"] = currentContext.spanId;
    }

    if (error) {
      record.error = {
        name: error.name || "Error",
        message: error.message || String(error),
        stack: error.stack,
        code: error.code || error.errorCode,
        details: error.details
      };
    }

    return record;
  }

  private writeLog(record: StructuredLogRecord): void {
    const jsonOutput = JSON.stringify(record);
    if (record.severity === "ERROR" || record.severity === "CRITICAL") {
      console.error(jsonOutput);
    } else if (record.severity === "WARNING") {
      console.warn(jsonOutput);
    } else {
      console.log(jsonOutput);
    }
  }

  public debug(message: string, context?: LogContext): void {
    this.writeLog(this.buildLogRecord("DEBUG", message, context));
  }

  public info(message: string, context?: LogContext): void {
    this.writeLog(this.buildLogRecord("INFO", message, context));
  }

  public warn(message: string, context?: LogContext, error?: Error | any): void {
    this.writeLog(this.buildLogRecord("WARNING", message, context, error));
  }

  public error(message: string, error?: Error | any, context?: LogContext): void {
    this.writeLog(this.buildLogRecord("ERROR", message, context, error));
  }

  public critical(message: string, error?: Error | any, context?: LogContext): void {
    this.writeLog(this.buildLogRecord("CRITICAL", message, context, error));
  }
}
