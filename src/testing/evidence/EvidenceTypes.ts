export type TestExecutionStatus = "PASSED" | "FAILED" | "WARNING" | "NOT_EXECUTED";

export interface LatencyHistogram {
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
}

export interface OperationalMetric {
  metricName: string;
  value: number;
  unit: string;
  targetThreshold?: number;
  status: "OPTIMAL" | "DEGRADED" | "BREACHED";
}

export interface TestExecutionRecord {
  testId: string;
  testName: string;
  category: "LOAD" | "STRESS" | "CHAOS" | "RECOVERY";
  status: TestExecutionStatus;
  executedAtIso: string;
  durationMs: number;
  requestsTotal: number;
  successfulRequests: number;
  failedRequests: number;
  throughputRps: number;
  latency: LatencyHistogram;
  metrics: OperationalMetric[];
  evidenceData: Record<string, any>;
  failureReason?: string;
  executionEnvironment: {
    runtime: string;
    cloudRunStateless: boolean;
    firestoreConnected: boolean;
    nodeVersion: string;
  };
}

export interface AggregatedEvidencePackage {
  packageId: string;
  generatedAtIso: string;
  environment: string;
  totalTestsRun: number;
  passCount: number;
  failCount: number;
  notExecutedCount: number;
  overallStatus: TestExecutionStatus;
  records: TestExecutionRecord[];
}
