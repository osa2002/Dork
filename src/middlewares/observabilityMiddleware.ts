import { Request, Response, NextFunction } from "express";
import { TelemetryService } from "../services/TelemetryService";
import { MetricsService } from "../services/MetricsService";
import { SLOService } from "../services/SLOService";

/**
 * Global observability middleware for automated tracing, metrics collection, and SLA performance profiling.
 */
export function observabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const { method, path, originalUrl } = req;

  // Skip asset / developer server requests to keep telemetry clear of noisy polling
  if (
    path.startsWith("/@vite") ||
    path.startsWith("/node_modules") ||
    path.startsWith("/src") ||
    path.includes(".")
  ) {
    return next();
  }

  // 1. Record vendor/queue activity in background if shopId resides in request context
  const shopId = (req as any).shopId || req.body?.shopId || req.query?.shopId || req.params?.shopId;
  if (shopId && typeof shopId === "string") {
    MetricsService.recordVendorActivity(shopId);
    
    const serviceId = req.body?.serviceId || req.query?.serviceId || req.params?.serviceId;
    if (serviceId && typeof serviceId === "string") {
      MetricsService.recordQueueActivity(shopId, serviceId);
    }
  }

  // 2. Start a formal OpenTelemetry Trace Span for the incoming transaction
  const span = TelemetryService.startSpan(`express-request:${method}:${path}`);
  span.setAttribute("http.method", method);
  span.setAttribute("http.url", originalUrl);
  span.setAttribute("http.user_agent", req.headers["user-agent"] || "unknown");
  span.setAttribute("http.ip", req.ip || "unknown");

  // Intercept the end of the response stream to finish our span and capture metrics
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400;

    span.setAttribute("http.status_code", statusCode);
    if (!success) {
      span.setAttribute("error", true);
      span.setAttribute("http.error_status", statusCode);
    }

    // Capture response payload sizes if header exists
    const contentLength = res.get("content-length");
    if (contentLength) {
      span.setAttribute("http.response_size_bytes", parseInt(contentLength, 10));
    }

    // Record API Call in SLOService (Phase 6.1)
    SLOService.recordApiCall(durationMs, success);

    // End span (triggers performance SLA detection and metrics dispatch)
    span.end();
  });

  next();
}
