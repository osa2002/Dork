import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";

export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  durationMs: number;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemHealthReport {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  liveness: boolean;
  readiness: boolean;
  components: ComponentHealth[];
}

export type HealthChecker = () => Promise<ComponentHealth>;

export class HealthCheckRegistry {
  private static instance: HealthCheckRegistry;
  private checkers: Map<string, HealthChecker> = new Map();

  constructor() {
    this.registerDefaultCheckers();
  }

  public static getInstance(): HealthCheckRegistry {
    if (!HealthCheckRegistry.instance) {
      HealthCheckRegistry.instance = new HealthCheckRegistry();
    }
    return HealthCheckRegistry.instance;
  }

  public registerChecker(name: string, checker: HealthChecker): void {
    this.checkers.set(name, checker);
  }

  private registerDefaultCheckers(): void {
    // 1. Process Memory & Liveness
    this.registerChecker("process_liveness", async () => {
      const start = Date.now();
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      const isHealthy = heapUsedMB < 1024; // Less than 1GB heap used

      return {
        name: "process_liveness",
        status: isHealthy ? "HEALTHY" : "DEGRADED",
        durationMs: Date.now() - start,
        details: {
          heapUsedMB,
          heapTotalMB,
          rssMB: Math.round(mem.rss / 1024 / 1024),
          uptimeSeconds: Math.floor(process.uptime())
        }
      };
    });

    // 2. Firestore Database Connectivity & Readiness
    this.registerChecker("firestore_readiness", async () => {
      const start = Date.now();
      try {
        const db = getAdminFirestoreDb();
        // Light metadata probe query
        await db.collection("health_probes").doc("ping").get();

        return {
          name: "firestore_readiness",
          status: "HEALTHY",
          durationMs: Date.now() - start,
          details: { connected: true }
        };
      } catch (err: any) {
        return {
          name: "firestore_readiness",
          status: "UNHEALTHY",
          durationMs: Date.now() - start,
          error: err.message || String(err),
          details: { connected: false }
        };
      }
    });
  }

  public async evaluateHealth(): Promise<SystemHealthReport> {
    const results: ComponentHealth[] = [];

    for (const [name, checker] of this.checkers.entries()) {
      try {
        const res = await checker();
        results.push(res);
      } catch (err: any) {
        results.push({
          name,
          status: "UNHEALTHY",
          durationMs: 0,
          error: err.message || String(err)
        });
      }
    }

    const hasUnhealthy = results.some(r => r.status === "UNHEALTHY");
    const hasDegraded = results.some(r => r.status === "DEGRADED");

    let overallStatus: HealthStatus = "HEALTHY";
    if (hasUnhealthy) {
      overallStatus = "UNHEALTHY";
    } else if (hasDegraded) {
      overallStatus = "DEGRADED";
    }

    const livenessComp = results.find(r => r.name === "process_liveness");
    const readinessComp = results.find(r => r.name === "firestore_readiness");

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      liveness: livenessComp ? livenessComp.status !== "UNHEALTHY" : true,
      readiness: readinessComp ? readinessComp.status === "HEALTHY" : true,
      components: results
    };
  }
}
