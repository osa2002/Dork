import { ObservabilityDashboardState } from "./ObservabilityDashboard";
import { MetricSummary } from "./MetricsAggregator";
import { TraceSpan } from "./TraceSpan";

export class ObservabilityReporter {
  /**
   * Compiles executive SRE reports.
   */
  public static generateMarkdown(
    state: ObservabilityDashboardState,
    spans: readonly TraceSpan[],
    metrics: readonly MetricSummary[]
  ): string {
    return `
# ENTERPRISE SRE OBSERVABILITY REPORT

## 1. Executive Summary
- **Evaluation Timestamp**: \`${state.timestamp}\`
- **System Observability Status**: **${state.systemStatus}**
- **Environment**: \`${state.context.environment}\`
- **Control Plane Readiness Score**: **${state.context.controlPlaneHealth.operationalReadiness}%**
- **Prediction Risk Score**: **${(state.context.riskPrediction.riskScore * 100).toFixed(0)}%**

---

## 2. Distributed Tracing Overview
- **Total Captured Spans**: \`${state.traceAggregates.totalCount}\`
- **Mean Transaction Duration**: \`${state.traceAggregates.avgDurationMs.toFixed(1)}ms\`
- **Trace Error Rate**: **${(state.traceAggregates.errorRate * 100).toFixed(1)}%**

### Anomaly Ledger
${
  state.anomalies.length === 0
    ? "*Zero active anomalies or SLA violations detected.*"
    : state.anomalies
        .map((a) => `- ⚠️ **[${a.severity}]** \`${a.code}\` affecting *${a.affectedService}*: ${a.message}`)
        .join("\n")
}

---

## 3. Core Service Telemetry (Percentiles)
| Service Name | Metric | Count | Average | Min | Max | P50 | P90 | P99 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${metrics
  .map(
    (m) =>
      `| \`${m.serviceName}\` | \`${m.metricName}\` | ${m.count} | ${m.average.toFixed(1)} | ${m.min} | ${m.max} | ${m.p50} | ${m.p90} | ${m.p99} |`
  )
  .join("\n")}

---

## 4. High-Fidelity Distributed Trace Spans
${spans
  .map(
    (s) =>
      `- \`[${s.startTime}]\` Trace \`${s.traceId}\` | Span \`${s.spanId}\`${
        s.parentSpanId ? ` (Parent: \`${s.parentSpanId}\`)` : ""
      } | **${s.serviceName}::${s.name}** | Duration: \`${s.durationMs}ms\` | Status: **${s.status}**`
  )
  .join("\n")}
    `.trim();
  }

  public static generateJson(state: ObservabilityDashboardState): string {
    return JSON.stringify(state, null, 2);
  }
}
