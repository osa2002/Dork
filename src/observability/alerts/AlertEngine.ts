import { CloudMetricsCollector } from "../metrics/CloudMetricsCollector";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  evaluate: (collector: CloudMetricsCollector) => { triggered: boolean; currentVal: number; threshold: number; details?: any };
  suggestedAction: string;
}

export interface AlertEvent {
  alertId: string;
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  triggeredAt: string;
  currentValue: number;
  threshold: number;
  suggestedAction: string;
  details?: any;
}

export class AlertEngine {
  private static instance: AlertEngine;
  private rules: AlertRule[] = [];
  private activeAlerts: Map<string, AlertEvent> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  public static getInstance(): AlertEngine {
    if (!AlertEngine.instance) {
      AlertEngine.instance = new AlertEngine();
    }
    return AlertEngine.instance;
  }

  public addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  private registerDefaultRules(): void {
    // 1. P99 Latency Alert
    this.addRule({
      ruleId: "alert-authorization-p99-latency",
      name: "High Authorization P99 Latency",
      description: "Triggers when billing authorization P99 latency exceeds 2000ms",
      severity: "CRITICAL",
      evaluate: (collector) => {
        const snapshot = collector.snapshotAllMetrics();
        const hist = snapshot.histograms.find(h => h.name === "billing_authorization_latency_ms");
        if (!hist) return { triggered: false, currentVal: 0, threshold: 2000 };

        const p99 = hist.snapshot.p99;
        return {
          triggered: p99 > 2000,
          currentVal: p99,
          threshold: 2000
        };
      },
      suggestedAction: "Check payment gateway provider status pages and enable fallback smart routing."
    });

    // 2. Queue Backlog / DLQ Depth Alert
    this.addRule({
      ruleId: "alert-dlq-depth-exceeded",
      name: "Dead Letter Queue Accumulation",
      description: "Triggers when unresolved DLQ messages exceed 10 items",
      severity: "WARNING",
      evaluate: (collector) => {
        const snapshot = collector.snapshotAllMetrics();
        const gauge = snapshot.gauges.find(g => g.name === "queue_pending_items_count" && g.labels.queueName === "dlq");
        const val = gauge ? gauge.value : 0;
        return {
          triggered: val > 10,
          currentVal: val,
          threshold: 10
        };
      },
      suggestedAction: "Inspect DLQ entries for recurring webhook signature or schema validation failures."
    });

    // 3. Provider Error Spike Alert
    this.addRule({
      ruleId: "alert-provider-error-rate",
      name: "Payment Provider Error Rate Spike",
      description: "Triggers when failed authorization requests exceed 5 in window",
      severity: "CRITICAL",
      evaluate: (collector) => {
        const snapshot = collector.snapshotAllMetrics();
        const failedCounter = snapshot.counters.filter(c => c.name === "billing_authorization_requests_total" && c.labels.status === "FAILED");
        const totalFailed = failedCounter.reduce((acc, curr) => acc + curr.value, 0);

        return {
          triggered: totalFailed > 5,
          currentVal: totalFailed,
          threshold: 5
        };
      },
      suggestedAction: "Trigger circuit breaker for degraded provider adapter and switch traffic to secondary providers."
    });
  }

  public evaluateAll(): AlertEvent[] {
    const collector = CloudMetricsCollector.getInstance();
    const firedAlerts: AlertEvent[] = [];

    for (const rule of this.rules) {
      const result = rule.evaluate(collector);
      if (result.triggered) {
        const alertEvent: AlertEvent = {
          alertId: `alt_${rule.ruleId}_${Date.now()}`,
          ruleId: rule.ruleId,
          name: rule.name,
          severity: rule.severity,
          triggeredAt: new Date().toISOString(),
          currentValue: result.currentVal,
          threshold: result.threshold,
          suggestedAction: rule.suggestedAction,
          details: result.details
        };
        this.activeAlerts.set(rule.ruleId, alertEvent);
        firedAlerts.push(alertEvent);
      } else {
        this.activeAlerts.delete(rule.ruleId);
      }
    }

    return firedAlerts;
  }

  public getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values());
  }
}
