import { CloudMetricsCollector } from "../metrics/CloudMetricsCollector";

export interface SloDefinition {
  sloId: string;
  name: string;
  targetPercentage: number; // e.g. 99.9%
  metricType: "AVAILABILITY" | "LATENCY";
  maxLatencyThresholdMs?: number;
}

export interface SloReport {
  sloId: string;
  name: string;
  targetPercentage: number;
  currentPercentage: number;
  isCompliant: boolean;
  errorBudgetRemainingPercentage: number;
}

export class SlaSloTracker {
  private static instance: SlaSloTracker;
  private slos: SloDefinition[] = [];

  constructor() {
    this.registerDefaultSlos();
  }

  public static getInstance(): SlaSloTracker {
    if (!SlaSloTracker.instance) {
      SlaSloTracker.instance = new SlaSloTracker();
    }
    return SlaSloTracker.instance;
  }

  private registerDefaultSlos(): void {
    // 1. Payment Authorization Availability SLO (99.9%)
    this.slos.push({
      sloId: "slo-auth-availability",
      name: "Payment Authorization High Availability",
      targetPercentage: 99.9,
      metricType: "AVAILABILITY"
    });

    // 2. Payment Authorization Latency SLO (95% under 1000ms)
    this.slos.push({
      sloId: "slo-auth-latency",
      name: "Payment Authorization Fast Response (P95 < 1000ms)",
      targetPercentage: 95.0,
      metricType: "LATENCY",
      maxLatencyThresholdMs: 1000
    });
  }

  public evaluateSlos(): SloReport[] {
    const collector = CloudMetricsCollector.getInstance();
    const snapshot = collector.snapshotAllMetrics();

    return this.slos.map(slo => {
      let currentPercentage = 100.0;

      if (slo.metricType === "AVAILABILITY") {
        const successCounter = snapshot.counters.filter(c => c.name === "billing_authorization_requests_total" && c.labels.status === "SUCCESS");
        const totalCounter = snapshot.counters.filter(c => c.name === "billing_authorization_requests_total");

        const totalSuccess = successCounter.reduce((acc, c) => acc + c.value, 0);
        const totalReqs = totalCounter.reduce((acc, c) => acc + c.value, 0);

        if (totalReqs > 0) {
          currentPercentage = Number(((totalSuccess / totalReqs) * 100).toFixed(2));
        }
      } else if (slo.metricType === "LATENCY") {
        const hist = snapshot.histograms.find(h => h.name === "billing_authorization_latency_ms");
        if (hist && hist.snapshot.count > 0) {
          const p95 = hist.snapshot.p95;
          currentPercentage = p95 <= (slo.maxLatencyThresholdMs || 1000) ? 100.0 : 80.0;
        }
      }

      const isCompliant = currentPercentage >= slo.targetPercentage;
      const allowedErrorFraction = (100 - slo.targetPercentage) / 100;
      const currentErrorFraction = (100 - currentPercentage) / 100;

      let errorBudgetRemainingPercentage = 100;
      if (allowedErrorFraction > 0) {
        errorBudgetRemainingPercentage = Math.max(0, Number((((allowedErrorFraction - currentErrorFraction) / allowedErrorFraction) * 100).toFixed(2)));
      }

      return {
        sloId: slo.sloId,
        name: slo.name,
        targetPercentage: slo.targetPercentage,
        currentPercentage,
        isCompliant,
        errorBudgetRemainingPercentage
      };
    });
  }
}
