import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { getDatabaseProvider } from "../lib/DatabaseProvider";
import { MetricsService } from "../services/MetricsService";
import { ConfigValidator } from "../services/ConfigValidator";
import { FeatureFlagService, FeatureFlag } from "../services/FeatureFlagService";
import { ChaosHealthContributor } from "../../server/chaos/intelligence/ChaosHealthContributor";
import { RuntimeDependencyGraph } from "../../server/chaos/intelligence/RuntimeDependencyGraph";

// Cache package version
let packageVersion = "1.0.0";
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  packageVersion = pkg.version || "1.0.0";
} catch {
  // Safe fallback if package.json can't be read in container
}

/**
 * Measure Event Loop Lag/Delay
 */
async function measureEventLoopDelay(): Promise<number> {
  const start = Date.now();
  return new Promise<number>((resolve) => {
    setImmediate(() => {
      resolve(Date.now() - start);
    });
  });
}

/**
 * Perform a lightweight read to verify Firestore connectivity
 */
async function verifyFirestoreConnectivity(): Promise<{ status: "connected" | "disconnected"; error?: string }> {
  const start = Date.now();
  const timeoutMs = 1500;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Firestore check timed out after 1.5s")), timeoutMs)
  );

  try {
    const dbPromise = (async () => {
      const provider = await getDatabaseProvider();
      // Execute a super fast dry-run limit(1) query
      const rawDb = (provider as any).adminDb || (provider as any).clientDb;
      if (!rawDb) {
        throw new Error("No database provider active");
      }

      if (typeof rawDb.collection === "function") {
        // Admin SDK path
        await rawDb.collection("shops").limit(1).get();
      } else {
        // Client SDK path
        const { collection, getDocs, query, limit } = await import("firebase/firestore");
        const q = query(collection(rawDb, "shops"), limit(1));
        await getDocs(q);
      }
      return true;
    })();

    await Promise.race([dbPromise, timeoutPromise]);
    const durationMs = Date.now() - start;
    RuntimeDependencyGraph.recordCall("ExpressServer", "Firestore", durationMs, true);
    return { status: "connected" };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    RuntimeDependencyGraph.recordCall("ExpressServer", "Firestore", durationMs, false);
    return { status: "disconnected", error: err.message };
  }
}

/**
 * GET /live
 * Minimal check to verify the process is alive.
 */
export function getLive(req: Request, res: Response) {
  res.status(200).json({ status: "alive" });
}

/**
 * GET /ready
 * Verify application is ready to accept traffic.
 */
export async function getReady(req: Request, res: Response) {
  try {
    const diagnostics = ConfigValidator.validate({ silent: true });
    const provider = await getDatabaseProvider();
    const isDbProviderActive = !!provider;

    const ready = diagnostics.valid && isDbProviderActive;

    const body = {
      status: ready ? "ready" : "unready",
      databaseProvider: isDbProviderActive ? "active" : "failed",
      environment: process.env.NODE_ENV || "development",
      diagnostics: {
        valid: diagnostics.valid,
        errors: diagnostics.errors,
      }
    };

    if (ready) {
      res.status(200).json(body);
    } else {
      res.status(503).json(body);
    }
  } catch (err: any) {
    res.status(503).json({
      status: "unready",
      error: err.message,
    });
  }
}

/**
 * GET /health
 * Rich check inspecting external systems and loop lag.
 */
export async function getHealth(req: Request, res: Response) {
  const start = Date.now();
  const eventLoopLag = await measureEventLoopDelay();
  const sysMetrics = MetricsService.getSystemMetrics();
  const firestoreCheck = await verifyFirestoreConnectivity();

  const isStripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const isGeminiConfigured = !!process.env.GEMINI_API_KEY;

  // Derive general status
  const baseHealthy = firestoreCheck.status === "connected" && eventLoopLag < 100;
  const chaosHealth = ChaosHealthContributor.getHealthStatus();

  let overallStatus = "healthy";
  if (!baseHealthy) {
    overallStatus = "unhealthy";
  } else if (chaosHealth.status !== "HEALTHY") {
    overallStatus = chaosHealth.status.toLowerCase();
  }

  const healthData = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - start,
    services: {
      express: "healthy",
      eventLoop: eventLoopLag < 50 ? "healthy" : "degraded",
      eventLoopLagMs: eventLoopLag,
      firestore: firestoreCheck.status === "connected" ? "healthy" : "unhealthy",
      stripeConfig: isStripeConfigured ? "configured" : "using_fallback_sandbox",
      geminiConfig: isGeminiConfigured ? "configured" : "using_fallback_local",
      chaosHealth: {
        status: chaosHealth.status,
        reason: chaosHealth.reason,
        activeScenarios: chaosHealth.activeScenarios,
        impactScore: chaosHealth.impactScore,
      },
    },
    system: {
      memory: sysMetrics.memory,
      cpu: sysMetrics.cpu,
    },
  };

  const isUp = overallStatus === "healthy" || overallStatus === "degraded" || overallStatus === "partial_outage";

  if (isUp) {
    res.status(200).json(healthData);
  } else {
    res.status(503).json(healthData);
  }
}

/**
 * GET /version
 * Return semantic version and deployment details.
 */
export function getVersion(req: Request, res: Response) {
  res.status(200).json({
    version: packageVersion,
    commit: process.env.COMMIT_SHA || "unknown",
    buildTimestamp: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
}

/**
 * GET /api/metrics
 * Expose lightweight system, counts, and business KPIs for scraping/monitoring.
 */
export function getMetrics(req: Request, res: Response) {
  res.status(200).json({
    system: MetricsService.getSystemMetrics(),
    counts: MetricsService.getCounts(),
    business: MetricsService.getBusinessMetrics(),
  });
}

/**
 * GET /api/features
 * Expose active feature flags and overrides.
 */
export function getFeatureFlags(req: Request, res: Response) {
  res.status(200).json(FeatureFlagService.getAllFlags());
}

