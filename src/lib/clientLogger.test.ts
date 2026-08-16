import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClientLogger, ClientLogLevel } from "./clientLogger";

describe("ClientLogger with Sentry and LogRocket Integration", () => {
  beforeEach(() => {
    ClientLogger.resetTelemetry();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (window as any).Sentry;
    delete (window as any).LogRocket;
  });

  it("should record log entries to the memory buffer with correct timestamps and log levels", () => {
    ClientLogger.info("System booted successfully", { version: "1.0.0" });
    ClientLogger.debug("Cache warm-up finished");
    ClientLogger.warn("Approaching memory threshold", { usage: 85 });
    ClientLogger.error("Failed to connect to microservice", new Error("Connection refused"));

    const logs = ClientLogger.getLogs();
    expect(logs.length).toBe(4);

    expect(logs[0].level).toBe(ClientLogLevel.INFO);
    expect(logs[0].message).toBe("System booted successfully");
    expect(logs[0].context).toEqual({ version: "1.0.0" });

    expect(logs[1].level).toBe(ClientLogLevel.DEBUG);
    expect(logs[2].level).toBe(ClientLogLevel.WARN);

    expect(logs[3].level).toBe(ClientLogLevel.ERROR);
    expect(logs[3].error?.message).toBe("Connection refused");
    expect(logs[3].error?.name).toBe("Error");
  });

  it("should clear the rolling log and metrics buffer correctly", () => {
    ClientLogger.info("Log 1");
    ClientLogger.captureMetric("render_latency", 42, "ms");

    expect(ClientLogger.getLogs().length).toBe(1);
    expect(ClientLogger.getMetrics().length).toBe(1);

    ClientLogger.clearLogs();
    ClientLogger.clearMetrics();

    expect(ClientLogger.getLogs().length).toBe(0);
    expect(ClientLogger.getMetrics().length).toBe(0);
  });

  it("should initialize Sentry and dispatch breadcrumbs and exceptions to window.Sentry", () => {
    const mockSentry = {
      init: vi.fn(),
      addBreadcrumb: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setTag: vi.fn(),
      metrics: {
        gauge: vi.fn(),
      },
    };
    (window as any).Sentry = mockSentry;

    ClientLogger.initSentry({
      dsn: "https://mockPublicKey@o0.ingest.sentry.io/0",
      environment: "test",
      release: "1.0.0",
    });

    expect(mockSentry.init).toHaveBeenCalledTimes(1);

    ClientLogger.info("User clicked checkout button", { cartId: "cart-123" });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "app.logger",
        message: "User clicked checkout button",
        level: "info",
      })
    );

    const testError = new Error("Payment Gateway Timeout");
    ClientLogger.captureException(testError, { orderId: "order-999" });

    expect(mockSentry.captureException).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        extra: expect.objectContaining({
          orderId: "order-999",
        }),
      })
    );
  });

  it("should initialize LogRocket and dispatch user identification and session tracking", () => {
    const mockLogRocket = {
      init: vi.fn(),
      identify: vi.fn(),
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      captureException: vi.fn(),
      track: vi.fn(),
    };
    (window as any).LogRocket = mockLogRocket;

    ClientLogger.initLogRocket({
      appId: "dorkq/enterprise-app",
      dom: { inputSanitization: true },
    });

    expect(mockLogRocket.init).toHaveBeenCalledTimes(1);

    ClientLogger.setUser({
      id: "usr_456",
      email: "alice@example.com",
      username: "alice_admin",
      role: "vendor",
      tenantId: "tenant_tokyo",
    });

    expect(mockLogRocket.identify).toHaveBeenCalledWith(
      "usr_456",
      expect.objectContaining({
        email: "alice@example.com",
        name: "alice_admin",
        role: "vendor",
        tenantId: "tenant_tokyo",
      })
    );
  });

  it("should capture performance metrics and forward to Sentry and LogRocket", () => {
    const mockSentry = {
      metrics: { gauge: vi.fn() },
      setMeasurement: vi.fn(),
    };
    const mockLogRocket = {
      track: vi.fn(),
    };
    (window as any).Sentry = mockSentry;
    (window as any).LogRocket = mockLogRocket;

    ClientLogger.setTag("region", "ap-northeast-1");
    ClientLogger.captureMetric("api.response_time", 145.5, "ms", { endpoint: "/api/queue/status" });

    const metrics = ClientLogger.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe("api.response_time");
    expect(metrics[0].value).toBe(145.5);
    expect(metrics[0].unit).toBe("ms");
    expect(metrics[0].tags?.endpoint).toBe("/api/queue/status");
    expect(metrics[0].tags?.region).toBe("ap-northeast-1");

    expect(mockSentry.metrics.gauge).toHaveBeenCalledWith(
      "api.response_time",
      145.5,
      expect.objectContaining({
        unit: "ms",
        tags: expect.objectContaining({ endpoint: "/api/queue/status", region: "ap-northeast-1" }),
      })
    );

    expect(mockLogRocket.track).toHaveBeenCalledWith(
      "perf:api.response_time",
      expect.objectContaining({
        value: 145.5,
        unit: "ms",
        endpoint: "/api/queue/status",
      })
    );
  });

  it("should measure execution duration of async functions using measurePerformance", async () => {
    const asyncTask = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { success: true };
    };

    const result = await ClientLogger.measurePerformance("fetch_customer_queue", asyncTask, {
      queueId: "q_123",
    });

    expect(result).toEqual({ success: true });
    const metrics = ClientLogger.getMetrics();
    expect(metrics.some((m) => m.name === "fetch_customer_queue" && m.tags?.status === "success")).toBe(true);
  });

  it("should capture exception when measurePerformance fails", async () => {
    const failingTask = async () => {
      throw new Error("Failed to fetch tickets");
    };

    await expect(ClientLogger.measurePerformance("failing_query", failingTask)).rejects.toThrow(
      "Failed to fetch tickets"
    );

    const metrics = ClientLogger.getMetrics();
    expect(metrics.some((m) => m.name === "failing_query" && m.tags?.status === "error")).toBe(true);

    const logs = ClientLogger.getLogs();
    expect(logs.some((l) => l.level === ClientLogLevel.ERROR && l.message.includes("Failed to fetch tickets"))).toBe(
      true
    );
  });

  it("should trace transactions and child spans with duration and status tracking", () => {
    const tx = ClientLogger.startTransaction("order_fulfillment", "checkout", { plan: "enterprise" });
    const span = tx.startChild("validate_stock", "db");
    
    const spanDuration = span.finish("ok");
    expect(typeof spanDuration).toBe("number");

    const txDuration = tx.finish("ok", { paymentProvider: "stripe" });
    expect(typeof txDuration).toBe("number");

    const transactions = ClientLogger.getTransactions();
    expect(transactions.length).toBe(1);
    expect(transactions[0].name).toBe("order_fulfillment");
    expect(transactions[0].op).toBe("checkout");
    expect(transactions[0].status).toBe("ok");
    expect(transactions[0].tags.plan).toBe("enterprise");
    expect(transactions[0].tags.paymentProvider).toBe("stripe");
  });

  it("should generate a comprehensive diagnostic report snapshot", () => {
    ClientLogger.setUser({ id: "usr_999", email: "admin@dork.com" });
    ClientLogger.info("Diagnostic heartbeat log");
    ClientLogger.captureMetric("memory_rss", 256, "kilobyte");

    const report = ClientLogger.getDiagnosticReport();

    expect(report.user?.id).toBe("usr_999");
    expect(report.recentLogs.length).toBeGreaterThan(0);
    expect(report.recentMetrics.length).toBeGreaterThan(0);
    expect(report.telemetry).toBeDefined();
    expect(report.timestamp).toBeDefined();
  });
});
