/**
 * Enterprise Platform Administration - Structured Logging Engine
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Optimized for Google Cloud Logging, Cloud Run, and OpenTelemetry
 */

import { AsyncLocalStorage } from "async_hooks";
import { v4 as uuidv4 } from "uuid";

export enum AdminLogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL"
}

export interface IAdminLogContext {
  correlationId: string;
  adminId?: string;
  adminEmail?: string;
  adminRole?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
}

export const adminLogContextStorage = new AsyncLocalStorage<IAdminLogContext>();

export interface IAdminStructuredLogEntry {
  timestamp: string;
  severity: AdminLogLevel;
  message: string;
  serviceContext: {
    service: string;
    version: string;
  };
  correlationId?: string;
  adminIdentity?: {
    adminId?: string;
    email?: string;
    role?: string;
  };
  tenantId?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  "logging.googleapis.com/trace"?: string;
}

export class AdminStructuredLogger {
  private static serviceName = "dork-enterprise-admin-core";
  private static version = "1.0.0";
  private static environment = process.env.NODE_ENV || "development";

  public static getContext(): IAdminLogContext | undefined {
    return adminLogContextStorage.getStore();
  }

  private static formatLog(
    level: AdminLogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error | any
  ): IAdminStructuredLogEntry {
    const ctx = this.getContext();

    const entry: IAdminStructuredLogEntry = {
      timestamp: new Date().toISOString(),
      severity: level,
      message,
      serviceContext: {
        service: this.serviceName,
        version: this.version
      },
      correlationId: ctx?.correlationId,
      adminIdentity: ctx?.adminId
        ? {
            adminId: ctx.adminId,
            email: ctx.adminEmail,
            role: ctx.adminRole
          }
        : undefined,
      tenantId: ctx?.tenantId,
      context: context ? { ...context } : undefined
    };

    if (ctx?.traceId) {
      entry["logging.googleapis.com/trace"] = ctx.traceId;
    }

    if (error) {
      entry.error = {
        name: error.name || "Error",
        message: error.message || String(error),
        stack: error.stack
      };
    }

    return entry;
  }

  private static writeLog(
    level: AdminLogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error | any
  ): void {
    const entry = this.formatLog(level, message, context, error);

    if (this.environment === "production") {
      // Direct single-line JSON to stdout for GCP Cloud Run logging driver
      process.stdout.write(JSON.stringify(entry) + "\n");
    } else {
      // Local readable output for diagnostics
      const ctxStr = entry.correlationId ? `[CID:${entry.correlationId.slice(0, 8)}]` : "";
      const adminStr = entry.adminIdentity?.email ? `[Admin:${entry.adminIdentity.email}]` : "";
      console.log(
        `[ADMIN ${entry.severity}] ${entry.timestamp} ${ctxStr}${adminStr} ${message}`,
        context ? context : "",
        error ? error : ""
      );
    }
  }

  public static debug(message: string, context?: Record<string, any>): void {
    this.writeLog(AdminLogLevel.DEBUG, message, context);
  }

  public static info(message: string, context?: Record<string, any>): void {
    this.writeLog(AdminLogLevel.INFO, message, context);
  }

  public static warn(message: string, context?: Record<string, any>): void {
    this.writeLog(AdminLogLevel.WARNING, message, context);
  }

  public static error(message: string, error?: Error | any, context?: Record<string, any>): void {
    this.writeLog(AdminLogLevel.ERROR, message, context, error);
  }

  public static critical(message: string, error?: Error | any, context?: Record<string, any>): void {
    this.writeLog(AdminLogLevel.CRITICAL, message, context, error);
  }
}
