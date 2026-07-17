import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

// Define log levels
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

// Structured log format
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  shopId?: string;
  userId?: string;
  context?: any;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  service: string;
  environment: string;
}

// Log context interface for AsyncLocalStorage
export interface LogContext {
  correlationId: string;
  shopId?: string;
  userId?: string;
}

// AsyncLocalStorage to propagate request-specific context (correlation ID, tenant context)
export const logContextStorage = new AsyncLocalStorage<LogContext>();

// Prepared telemetry targets (e.g., Sentry, GCP Logging, Datadog)
const telemetryEnabled = process.env.ENABLE_TELEMETRY === "true";

/**
 * Enterprise Server Logger
 */
export class ServerLogger {
  private static serviceName = "dorkq-backend";
  private static environment = process.env.NODE_ENV || "development";

  /**
   * Retrieves the current AsyncLocalStorage context
   */
  private static getContext(): LogContext | undefined {
    return logContextStorage.getStore();
  }

  /**
   * Main internal log writer
   */
  private static writeLog(level: LogLevel, message: string, context?: any, error?: Error | any) {
    const ctx = this.getContext();
    const correlationId = ctx?.correlationId;
    const shopId = ctx?.shopId;
    const userId = ctx?.userId;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
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

    // Capture telemetry for high-priority levels
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      this.sendToTelemetry(entry);
    }

    // Standard Output routing
    if (this.environment === "production") {
      // In production, we write strictly structured single-line JSON to stdout
      // This is natively parsed by Google Cloud Logging, AWS CloudWatch, Datadog, etc.
      process.stdout.write(JSON.stringify(entry) + "\n");
    } else {
      // In development, we print highly readable, colorized human diagnostics
      this.printDevelopmentLog(entry);
    }
  }

  /**
   * Colors and pretty-prints logs for local command line developer diagnostics
   */
  private static printDevelopmentLog(entry: LogEntry) {
    const reset = "\x1b[0m";
    const dim = "\x1b[2m";
    const bright = "\x1b[1m";

    let levelColor = "";
    switch (entry.level) {
      case LogLevel.DEBUG:
        levelColor = "\x1b[36m"; // Cyan
        break;
      case LogLevel.INFO:
        levelColor = "\x1b[32m"; // Green
        break;
      case LogLevel.WARN:
        levelColor = "\x1b[33m"; // Yellow
        break;
      case LogLevel.ERROR:
        levelColor = "\x1b[31m"; // Red
        break;
      case LogLevel.FATAL:
        levelColor = "\x1b[41m\x1b[37m"; // White text on Red bg
        break;
    }

    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
    const cidStr = entry.correlationId ? `[CID:${entry.correlationId.slice(0, 8)}]` : "";
    const shopStr = entry.shopId ? `[Shop:${entry.shopId.slice(0, 8)}]` : "";
    const contextStr = entry.context ? `\n${dim}Context: ${JSON.stringify(entry.context, null, 2)}${reset}` : "";
    const errorStr = entry.error ? `\n\x1b[31mError [${entry.error.name}]: ${entry.error.message}\n${entry.error.stack || ""}${reset}` : "";

    console.log(
      `${dim}${timeStr}${reset} ${levelColor}${bright}[${entry.level}]${reset} ${dim}${cidStr}${shopStr}${reset} ${entry.message}${contextStr}${errorStr}`
    );
  }

  /**
   * Placeholder hook for enterprise telemetry (Sentry, Google Cloud Error Reporting)
   */
  private static sendToTelemetry(entry: LogEntry) {
    if (!telemetryEnabled) return;
    
    // Stub implementation showing exact integration pathway for GCP Error Reporting/Sentry:
    // Sentry.withScope((scope) => {
    //   scope.setLevel(entry.level.toLowerCase() as any);
    //   scope.setTags({ correlationId: entry.correlationId, shopId: entry.shopId, service: entry.service });
    //   scope.setExtra("context", entry.context);
    //   if (entry.error) {
    //     const err = new Error(entry.error.message);
    //     err.name = entry.error.name || "Error";
    //     err.stack = entry.error.stack;
    //     Sentry.captureException(err);
    //   } else {
    //     Sentry.captureMessage(entry.message);
    //   }
    // });
  }

  // Public logging interfaces
  public static debug(message: string, context?: any) {
    this.writeLog(LogLevel.DEBUG, message, context);
  }

  public static info(message: string, context?: any) {
    this.writeLog(LogLevel.INFO, message, context);
  }

  public static warn(message: string, context?: any) {
    this.writeLog(LogLevel.WARN, message, context);
  }

  public static error(message: string, error?: any, context?: any) {
    this.writeLog(LogLevel.ERROR, message, context, error);
  }

  public static fatal(message: string, error?: any, context?: any) {
    this.writeLog(LogLevel.FATAL, message, context, error);
  }
}

/**
 * Express Middleware to initialize and propagate correlation IDs and request tracking context.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if incoming request has correlation/request ID header, or create a unique one
  const correlationId = (req.headers["x-correlation-id"] || req.headers["x-request-id"] || uuidv4()) as string;

  // Set correlation ID in response header so clients can quote it for troubleshooting
  res.setHeader("X-Correlation-ID", correlationId);

  // Parse user/tenant context if already populated by authentication middleware
  const context: LogContext = {
    correlationId,
    userId: (req as any).user?.uid,
    shopId: (req as any).shopId,
  };

  // Run downstream express middlewares/handlers in the scope of this storage context
  logContextStorage.run(context, () => {
    // Log the request arrival
    ServerLogger.debug(`[HTTP] ${req.method} ${req.originalUrl}`);
    next();
  });
}
