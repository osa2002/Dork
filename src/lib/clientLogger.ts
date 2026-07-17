// Client-side structured logger for React

export enum ClientLogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface ClientLogEntry {
  timestamp: string;
  level: ClientLogLevel;
  message: string;
  context?: any;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

// Memory-backed buffer for post-mortem diagnostics (e.g., retrieving the last 100 actions prior to a crash)
const MAX_LOG_BUFFER_SIZE = 100;
const logBuffer: ClientLogEntry[] = [];

function pushToBuffer(entry: ClientLogEntry) {
  if (logBuffer.length >= MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  logBuffer.push(entry);
}

/**
 * Enterprise Client-Side Logger
 */
export class ClientLogger {
  private static isProduction = (import.meta as any).env?.PROD || (typeof process !== "undefined" && process.env?.NODE_ENV === "production");

  /**
   * Returns the rolling buffer of recent logs for debugging and crash-reporting
   */
  public static getLogs(): ClientLogEntry[] {
    return [...logBuffer];
  }

  /**
   * Clears the current diagnostic buffer
   */
  public static clearLogs() {
    logBuffer.length = 0;
  }

  private static log(level: ClientLogLevel, message: string, context?: any, error?: Error | any) {
    const entry: ClientLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        message: error.message || String(error),
        name: error.name || "Error",
        stack: error.stack,
      };
    }

    pushToBuffer(entry);

    // Only log to standard developer console in development environments to keep production logs clean
    if (!this.isProduction) {
      const styles = {
        [ClientLogLevel.DEBUG]: "color: #06b6d4; font-weight: bold;", // Cyan
        [ClientLogLevel.INFO]: "color: #10b981; font-weight: bold;",  // Green
        [ClientLogLevel.WARN]: "color: #f59e0b; font-weight: bold;",  // Yellow
        [ClientLogLevel.ERROR]: "color: #ef4444; font-weight: bold;", // Red
      };

      const consoleMethod = level === ClientLogLevel.ERROR ? "error" : level === ClientLogLevel.WARN ? "warn" : "log";
      
      console[consoleMethod](
        `%c[${level}] %c${message}`,
        styles[level],
        "color: inherit;",
        context ? { context } : "",
        error ? { error } : ""
      );
    } else {
      // Production telemetry hooks can be integrated here:
      // if (level === ClientLogLevel.ERROR) {
      //   Sentry.captureException(error || new Error(message));
      // }
    }
  }

  public static debug(message: string, context?: any) {
    this.log(ClientLogLevel.DEBUG, message, context);
  }

  public static info(message: string, context?: any) {
    this.log(ClientLogLevel.INFO, message, context);
  }

  public static warn(message: string, context?: any) {
    this.log(ClientLogLevel.WARN, message, context);
  }

  public static error(message: string, error?: any, context?: any) {
    this.log(ClientLogLevel.ERROR, message, context, error);
  }
}
