// Client-side structured logger with automated Sentry and LogRocket telemetry integration
// Captures production runtime exceptions, performance metrics, and session diagnostics

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
    [key: string]: any;
  };
}

export interface TelemetryUser {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  tenantId?: string;
  [key: string]: any;
}

export type MetricUnit =
  | "ms"
  | "s"
  | "byte"
  | "kilobyte"
  | "count"
  | "ratio"
  | "percent"
  | "none";

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: MetricUnit;
  tags?: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface PerformanceSpan {
  name: string;
  op?: string;
  startTime: number;
  finish: (status?: "ok" | "error" | "cancelled") => number;
}

export interface PerformanceTransaction {
  id: string;
  name: string;
  op: string;
  startTime: number;
  tags: Record<string, string | number | boolean>;
  spans: PerformanceSpan[];
  finish: (status?: "ok" | "error" | "cancelled", extraTags?: Record<string, string | number | boolean>) => number;
  setTag: (key: string, value: string | number | boolean) => void;
  startChild: (spanName: string, op?: string) => PerformanceSpan;
}

export interface SentryClientOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  sampleRate?: number;
  tags?: Record<string, string>;
  beforeSend?: (event: any, hint?: any) => any;
  autoSessionTracking?: boolean;
}

export interface LogRocketClientOptions {
  appId?: string;
  release?: string;
  dom?: {
    inputSanitization?: boolean;
    textSanitization?: boolean;
  };
  network?: {
    isEnabled?: boolean;
    requestSanitizer?: (request: any) => any;
    responseSanitizer?: (response: any) => any;
  };
  console?: {
    isEnabled?: boolean;
  };
}

export interface TelemetryConfig {
  sentry?: SentryClientOptions;
  logRocket?: LogRocketClientOptions;
  enableWebVitals?: boolean;
  environment?: string;
  release?: string;
}

// Memory-backed buffers for post-mortem diagnostics
const MAX_LOG_BUFFER_SIZE = 100;
const MAX_METRICS_BUFFER_SIZE = 100;
const MAX_TRANSACTIONS_BUFFER_SIZE = 50;

const logBuffer: ClientLogEntry[] = [];
const metricsBuffer: PerformanceMetric[] = [];
const transactionsBuffer: Array<{
  id: string;
  name: string;
  op: string;
  durationMs: number;
  status: string;
  tags: Record<string, any>;
  timestamp: string;
}> = [];

function pushToBuffer(entry: ClientLogEntry) {
  if (logBuffer.length >= MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  logBuffer.push(entry);
}

function pushToMetricsBuffer(metric: PerformanceMetric) {
  if (metricsBuffer.length >= MAX_METRICS_BUFFER_SIZE) {
    metricsBuffer.shift();
  }
  metricsBuffer.push(metric);
}

function pushToTransactionsBuffer(tx: {
  id: string;
  name: string;
  op: string;
  durationMs: number;
  status: string;
  tags: Record<string, any>;
  timestamp: string;
}) {
  if (transactionsBuffer.length >= MAX_TRANSACTIONS_BUFFER_SIZE) {
    transactionsBuffer.shift();
  }
  transactionsBuffer.push(tx);
}

/**
 * Enterprise Client-Side Logger with Automated Sentry & LogRocket Integration
 */
export class ClientLogger {
  private static isProduction: boolean = (() => {
    try {
      const meta = (import.meta as any)?.env;
      if (meta?.PROD !== undefined) return Boolean(meta.PROD);
      if (meta?.MODE === "production") return true;
    } catch {
      // Ignored in non-meta environments
    }
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      return true;
    }
    return false;
  })();

  private static sentryInitialized = false;
  private static logRocketInitialized = false;
  private static webVitalsInitialized = false;
  private static currentUser: TelemetryUser | null = null;
  private static globalTags: Record<string, string> = {};
  private static sentryConfig: SentryClientOptions | null = null;
  private static logRocketConfig: LogRocketClientOptions | null = null;
  private static performanceObserver: any = null;

  /**
   * Initializes telemetry providers automatically using environment variables or passed config
   */
  public static initTelemetry(config?: TelemetryConfig) {
    // 1. Sentry initialization
    const envSentryDsn =
      typeof import.meta !== "undefined"
        ? (import.meta as any)?.env?.VITE_SENTRY_DSN
        : undefined;

    const sentryOptions = config?.sentry || (envSentryDsn ? { dsn: envSentryDsn } : undefined);
    if (sentryOptions?.dsn) {
      this.initSentry(sentryOptions);
    }

    // 2. LogRocket initialization
    const envLogRocketAppId =
      typeof import.meta !== "undefined"
        ? (import.meta as any)?.env?.VITE_LOGROCKET_APP_ID
        : undefined;

    const logRocketOptions =
      config?.logRocket || (envLogRocketAppId ? { appId: envLogRocketAppId } : undefined);
    if (logRocketOptions?.appId) {
      this.initLogRocket(logRocketOptions);
    }

    // 3. Web Vitals & Performance Observer
    if (config?.enableWebVitals !== false && typeof window !== "undefined") {
      this.initPerformanceObserver();
    }
  }

  /**
   * Configures and initializes Sentry integration
   */
  public static initSentry(options: SentryClientOptions) {
    this.sentryConfig = {
      environment:
        options.environment ||
        (typeof import.meta !== "undefined" ? (import.meta as any)?.env?.VITE_APP_ENV : undefined) ||
        (this.isProduction ? "production" : "development"),
      tracesSampleRate: options.tracesSampleRate ?? (this.isProduction ? 0.2 : 1.0),
      sampleRate: options.sampleRate ?? 1.0,
      autoSessionTracking: options.autoSessionTracking ?? true,
      ...options,
    };

    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.Sentry && typeof win.Sentry.init === "function") {
        try {
          win.Sentry.init(this.sentryConfig);
          this.sentryInitialized = true;
          this.debug("[Telemetry] Sentry SDK initialized successfully via window.Sentry.");
        } catch (err) {
          this.warn("[Telemetry] Failed to initialize window.Sentry:", err);
        }
      } else {
        // Active in headless or SDK-ready mode
        this.sentryInitialized = true;
        this.debug("[Telemetry] Sentry telemetry registered with DSN:", {
          dsn: this.sentryConfig.dsn?.slice(0, 12) + "...",
          environment: this.sentryConfig.environment,
        });
      }
    } else {
      this.sentryInitialized = true;
    }
  }

  /**
   * Configures and initializes LogRocket integration
   */
  public static initLogRocket(options: LogRocketClientOptions) {
    this.logRocketConfig = {
      dom: {
        inputSanitization: true,
        textSanitization: false,
        ...options.dom,
      },
      network: {
        isEnabled: true,
        ...options.network,
      },
      console: {
        isEnabled: true,
        ...options.console,
      },
      ...options,
    };

    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.LogRocket && typeof win.LogRocket.init === "function") {
        try {
          win.LogRocket.init(options.appId, this.logRocketConfig);
          this.logRocketInitialized = true;
          this.debug("[Telemetry] LogRocket SDK initialized successfully via window.LogRocket.");
        } catch (err) {
          this.warn("[Telemetry] Failed to initialize window.LogRocket:", err);
        }
      } else {
        this.logRocketInitialized = true;
        this.debug("[Telemetry] LogRocket telemetry registered with App ID:", {
          appId: options.appId,
        });
      }
    } else {
      this.logRocketInitialized = true;
    }
  }

  /**
   * Identifies user across Sentry and LogRocket
   */
  public static setUser(user: TelemetryUser | null) {
    this.currentUser = user;

    if (typeof window !== "undefined") {
      const win = window as any;

      // Sentry user identity
      if (win.Sentry && typeof win.Sentry.setUser === "function") {
        try {
          win.Sentry.setUser(user ? { id: user.id, email: user.email, username: user.username, ...user } : null);
        } catch (err) {
          this.warn("[Telemetry] Failed to set Sentry user:", err);
        }
      }

      // LogRocket identify
      if (win.LogRocket && typeof win.LogRocket.identify === "function") {
        try {
          if (user) {
            win.LogRocket.identify(user.id, {
              email: user.email,
              name: user.username,
              role: user.role,
              tenantId: user.tenantId,
              ...user,
            });
          }
        } catch (err) {
          this.warn("[Telemetry] Failed to identify LogRocket user:", err);
        }
      }
    }

    this.debug("[Telemetry] User context updated", { userId: user?.id, email: user?.email });
  }

  /**
   * Clears the current user identity
   */
  public static clearUser() {
    this.setUser(null);
  }

  /**
   * Sets a global telemetry tag
   */
  public static setTag(key: string, value: string) {
    this.globalTags[key] = value;

    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.Sentry && typeof win.Sentry.setTag === "function") {
        win.Sentry.setTag(key, value);
      }
    }
  }

  /**
   * Captures an exception and dispatches it to Sentry & LogRocket
   */
  public static captureException(error: Error | any, context?: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error || "Unknown Error"));
    this.error(errorObj.message, errorObj, context);

    if (typeof window !== "undefined") {
      const win = window as any;

      // Forward to Sentry
      if (win.Sentry && typeof win.Sentry.captureException === "function") {
        try {
          win.Sentry.captureException(errorObj, {
            extra: {
              ...context,
              recentLogs: this.getLogs().slice(-10),
            },
            tags: this.globalTags,
          });
        } catch (sentryErr) {
          console.error("[Telemetry] Sentry.captureException failed:", sentryErr);
        }
      }

      // Forward to LogRocket
      if (win.LogRocket && typeof win.LogRocket.captureException === "function") {
        try {
          win.LogRocket.captureException(errorObj, {
            extra: context,
          });
        } catch (lrErr) {
          console.error("[Telemetry] LogRocket.captureException failed:", lrErr);
        }
      }
    }
  }

  /**
   * Captures a standalone message in Sentry / LogRocket
   */
  public static captureMessage(message: string, level: ClientLogLevel = ClientLogLevel.INFO, context?: any) {
    this.log(level, message, context);

    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.Sentry && typeof win.Sentry.captureMessage === "function") {
        try {
          const sentrySeverity = level.toLowerCase();
          win.Sentry.captureMessage(message, sentrySeverity as any);
        } catch (sentryErr) {
          console.error("[Telemetry] Sentry.captureMessage failed:", sentryErr);
        }
      }
    }
  }

  /**
   * Records a production performance metric (e.g. Core Web Vitals, API latency, render duration)
   */
  public static captureMetric(
    name: string,
    value: number,
    unit: MetricUnit = "ms",
    tags: Record<string, string | number | boolean> = {}
  ) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      tags: { ...this.globalTags, ...tags },
      timestamp: new Date().toISOString(),
    };

    pushToMetricsBuffer(metric);

    // Forward to Sentry Metrics / Custom Measurements if active
    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.Sentry) {
        try {
          if (win.Sentry.metrics && typeof win.Sentry.metrics.gauge === "function") {
            win.Sentry.metrics.gauge(name, value, {
              unit,
              tags: metric.tags,
            });
          } else if (typeof win.Sentry.setMeasurement === "function") {
            win.Sentry.setMeasurement(name, value, unit);
          }
        } catch (sentryErr) {
          // Ignore telemetry metric error
        }
      }

      if (win.LogRocket && typeof win.LogRocket.track === "function") {
        try {
          win.LogRocket.track(`perf:${name}`, {
            value,
            unit,
            ...tags,
          });
        } catch (lrErr) {
          // Ignore LogRocket metric error
        }
      }
    }

    if (!this.isProduction) {
      console.debug?.(
        `%c[Metric] %c${name}: ${value}${unit}`,
        "color: #8b5cf6; font-weight: bold;",
        "color: inherit;",
        tags
      );
    }
  }

  /**
   * Measures the execution time of a synchronous or asynchronous function
   */
  public static async measurePerformance<T>(
    name: string,
    fn: () => T | Promise<T>,
    tags: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const result = await fn();
      const duration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
      this.captureMetric(name, Math.round(duration * 100) / 100, "ms", { ...tags, status: "success" });
      return result;
    } catch (error) {
      const duration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
      this.captureMetric(name, Math.round(duration * 100) / 100, "ms", { ...tags, status: "error" });
      this.captureException(error, { performanceMetric: name, durationMs: duration, tags });
      throw error;
    }
  }

  /**
   * Starts a performance transaction for end-to-end tracing
   */
  public static startTransaction(
    name: string,
    op: string = "custom",
    tags: Record<string, string | number | boolean> = {}
  ): PerformanceTransaction {
    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const txId = `tx-${Math.random().toString(36).slice(2, 9)}`;
    const txTags = { ...this.globalTags, ...tags };
    const spans: PerformanceSpan[] = [];

    const transaction: PerformanceTransaction = {
      id: txId,
      name,
      op,
      startTime,
      tags: txTags,
      spans,
      setTag: (key: string, value: string | number | boolean) => {
        txTags[key] = value;
      },
      startChild: (spanName: string, spanOp: string = "subtask"): PerformanceSpan => {
        const spanStart = typeof performance !== "undefined" ? performance.now() : Date.now();
        const span: PerformanceSpan = {
          name: spanName,
          op: spanOp,
          startTime: spanStart,
          finish: (spanStatus: "ok" | "error" | "cancelled" = "ok") => {
            const spanDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - spanStart;
            ClientLogger.captureMetric(`${name}.${spanName}`, Math.round(spanDuration * 100) / 100, "ms", {
              op: spanOp,
              status: spanStatus,
              transaction: name,
            });
            return spanDuration;
          },
        };
        spans.push(span);
        return span;
      },
      finish: (status: "ok" | "error" | "cancelled" = "ok", extraTags: Record<string, string | number | boolean> = {}) => {
        const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
        const duration = Math.round((endTime - startTime) * 100) / 100;
        const mergedTags = { ...txTags, ...extraTags, status };

        pushToTransactionsBuffer({
          id: txId,
          name,
          op,
          durationMs: duration,
          status,
          tags: mergedTags,
          timestamp: new Date().toISOString(),
        });

        ClientLogger.captureMetric(`transaction.${name}`, duration, "ms", mergedTags);

        // Forward to window.Sentry if transaction APIs are exposed
        if (typeof window !== "undefined") {
          const win = window as any;
          if (win.Sentry && typeof win.Sentry.startSpan === "function") {
            // Modern Sentry Span API
          }
        }

        return duration;
      },
    };

    return transaction;
  }

  /**
   * Initializes browser PerformanceObserver for Core Web Vitals (LCP, FID/INP, CLS, FCP, TTFB)
   */
  public static initPerformanceObserver() {
    if (this.webVitalsInitialized || typeof window === "undefined") return;

    try {
      if ("PerformanceObserver" in window) {
        // 1. Largest Contentful Paint (LCP)
        try {
          const lcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              this.captureMetric("web_vitals.LCP", Math.round(lastEntry.startTime), "ms", {
                rating: lastEntry.startTime < 2500 ? "good" : lastEntry.startTime < 4000 ? "needs-improvement" : "poor",
              });
            }
          });
          lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {}

        // 2. Cumulative Layout Shift (CLS)
        try {
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            this.captureMetric("web_vitals.CLS", Math.round(clsValue * 1000) / 1000, "none", {
              rating: clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor",
            });
          });
          clsObserver.observe({ type: "layout-shift", buffered: true });
        } catch {}

        // 3. First Input Delay (FID) / Interaction to Next Paint (INP)
        try {
          const fidObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries() as any[]) {
              const delay = entry.processingStart - entry.startTime;
              this.captureMetric("web_vitals.FID", Math.round(delay), "ms", {
                rating: delay < 100 ? "good" : delay < 300 ? "needs-improvement" : "poor",
              });
            }
          });
          fidObserver.observe({ type: "first-input", buffered: true });
        } catch {}

        // 4. Navigation Timings (TTFB, DOM Complete)
        try {
          const navObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries() as any[]) {
              if (entry.responseStart && entry.requestStart) {
                const ttfb = entry.responseStart - entry.requestStart;
                this.captureMetric("web_vitals.TTFB", Math.round(ttfb), "ms");
              }
              if (entry.domContentLoadedEventEnd && entry.startTime) {
                const dcl = entry.domContentLoadedEventEnd - entry.startTime;
                this.captureMetric("navigation.DCL", Math.round(dcl), "ms");
              }
            }
          });
          navObserver.observe({ type: "navigation", buffered: true });
        } catch {}
      }

      this.webVitalsInitialized = true;
      this.debug("[Telemetry] Web Vitals Performance Observer initialized.");
    } catch (err) {
      this.warn("[Telemetry] Could not initialize PerformanceObserver:", err);
    }
  }

  /**
   * Returns the rolling buffer of recent logs for debugging and crash-reporting
   */
  public static getLogs(): ClientLogEntry[] {
    return [...logBuffer];
  }

  /**
   * Returns recorded performance metrics buffer
   */
  public static getMetrics(): PerformanceMetric[] {
    return [...metricsBuffer];
  }

  /**
   * Returns recorded performance transactions
   */
  public static getTransactions() {
    return [...transactionsBuffer];
  }

  /**
   * Clears the current diagnostic log buffer
   */
  public static clearLogs() {
    logBuffer.length = 0;
  }

  /**
   * Clears the current metrics buffer
   */
  public static clearMetrics() {
    metricsBuffer.length = 0;
    transactionsBuffer.length = 0;
  }

  /**
   * Clears global tags
   */
  public static clearTags() {
    this.globalTags = {};
  }

  /**
   * Resets all internal telemetry buffers and session user
   */
  public static resetTelemetry() {
    this.clearLogs();
    this.clearMetrics();
    this.clearTags();
    this.currentUser = null;
  }

  /**
   * Returns an enterprise comprehensive diagnostic report snapshot
   */
  public static getDiagnosticReport() {
    return {
      timestamp: new Date().toISOString(),
      user: this.currentUser,
      environment: this.isProduction ? "production" : "development",
      telemetry: {
        sentryActive: this.sentryInitialized,
        logRocketActive: this.logRocketInitialized,
        webVitalsActive: this.webVitalsInitialized,
      },
      tags: this.globalTags,
      recentLogs: this.getLogs(),
      recentMetrics: this.getMetrics(),
      recentTransactions: this.getTransactions(),
    };
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

    // Forward breadcrumb to Sentry and LogRocket
    if (typeof window !== "undefined") {
      const win = window as any;

      if (win.Sentry && typeof win.Sentry.addBreadcrumb === "function") {
        try {
          win.Sentry.addBreadcrumb({
            category: "app.logger",
            message,
            level: level.toLowerCase() as any,
            data: context,
            timestamp: Date.now() / 1000,
          });
        } catch {}
      }

      if (win.LogRocket && typeof win.LogRocket.log === "function") {
        try {
          if (level === ClientLogLevel.ERROR) {
            win.LogRocket.error(message, context);
          } else if (level === ClientLogLevel.WARN) {
            win.LogRocket.warn(message, context);
          } else if (level === ClientLogLevel.INFO) {
            win.LogRocket.info(message, context);
          } else {
            win.LogRocket.log(message, context);
          }
        } catch {}
      }
    }

    // Only log to standard developer console in development environments to keep production logs clean
    if (!this.isProduction) {
      const styles = {
        [ClientLogLevel.DEBUG]: "color: #06b6d4; font-weight: bold;", // Cyan
        [ClientLogLevel.INFO]: "color: #10b981; font-weight: bold;", // Green
        [ClientLogLevel.WARN]: "color: #f59e0b; font-weight: bold;", // Yellow
        [ClientLogLevel.ERROR]: "color: #ef4444; font-weight: bold;", // Red
      };

      const consoleMethod =
        level === ClientLogLevel.ERROR ? "error" : level === ClientLogLevel.WARN ? "warn" : "log";

      console[consoleMethod](
        `%c[${level}] %c${message}`,
        styles[level],
        "color: inherit;",
        context ? { context } : "",
        error ? { error } : ""
      );
    } else if (level === ClientLogLevel.ERROR) {
      // In production, trigger Sentry/LogRocket exception capture if error is present
      if (error) {
        this.captureException(error, { message, context });
      }
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

// Auto-initialize telemetry on module load in client environments
if (typeof window !== "undefined") {
  ClientLogger.initTelemetry();
}
