import { AggregatedEvidencePackage, TestExecutionRecord, TestExecutionStatus } from "./EvidenceTypes";
import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";

export class EvidenceCollector {
  private static instance: EvidenceCollector;
  private records: Map<string, TestExecutionRecord> = new Map();

  private constructor() {}

  public static getInstance(): EvidenceCollector {
    if (!EvidenceCollector.instance) {
      EvidenceCollector.instance = new EvidenceCollector();
    }
    return EvidenceCollector.instance;
  }

  public recordTestExecution(record: TestExecutionRecord): void {
    this.records.set(record.testId, record);
  }

  public recordNotExecuted(testId: string, testName: string, category: "LOAD" | "STRESS" | "CHAOS" | "RECOVERY", reason: string = "Execution skipped or dry-run requested"): TestExecutionRecord {
    const record: TestExecutionRecord = {
      testId,
      testName,
      category,
      status: "NOT_EXECUTED",
      executedAtIso: new Date().toISOString(),
      durationMs: 0,
      requestsTotal: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throughputRps: 0,
      latency: { p50Ms: 0, p90Ms: 0, p95Ms: 0, p99Ms: 0, minMs: 0, maxMs: 0, avgMs: 0 },
      metrics: [],
      evidenceData: { note: reason },
      failureReason: reason,
      executionEnvironment: {
        runtime: "Cloud Run Container",
        cloudRunStateless: true,
        firestoreConnected: true,
        nodeVersion: process.version
      }
    };
    this.records.set(testId, record);
    return record;
  }

  public getRecord(testId: string): TestExecutionRecord | undefined {
    return this.records.get(testId);
  }

  public getAllRecords(): TestExecutionRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
  }

  public generateEvidencePackage(environment: string = "CLOUD_RUN_STATELESS"): AggregatedEvidencePackage {
    const records = this.getAllRecords();
    const passCount = records.filter(r => r.status === "PASSED").length;
    const failCount = records.filter(r => r.status === "FAILED").length;
    const notExecutedCount = records.filter(r => r.status === "NOT_EXECUTED").length;

    let overallStatus: TestExecutionStatus = "PASSED";
    if (failCount > 0) {
      overallStatus = "FAILED";
    } else if (notExecutedCount > 0 && passCount === 0) {
      overallStatus = "NOT_EXECUTED";
    } else if (notExecutedCount > 0) {
      overallStatus = "WARNING";
    }

    return {
      packageId: `evid_pkg_${Date.now()}`,
      generatedAtIso: new Date().toISOString(),
      environment,
      totalTestsRun: records.length,
      passCount,
      failCount,
      notExecutedCount,
      overallStatus,
      records
    };
  }

  public async persistToFirestore(tenantId: string = "default"): Promise<boolean> {
    try {
      const db = getAdminFirestoreDb();
      const pkg = this.generateEvidencePackage();
      
      const docRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("operational_evidence")
        .doc(pkg.packageId);

      await docRef.set(pkg, { merge: true });
      return true;
    } catch (err) {
      console.error("[EvidenceCollector] Failed to persist evidence to Firestore:", err);
      return false;
    }
  }

  public exportAsJson(pkg?: AggregatedEvidencePackage): string {
    const data = pkg || this.generateEvidencePackage();
    return JSON.stringify(data, null, 2);
  }

  public exportAsMarkdown(pkg?: AggregatedEvidencePackage): string {
    const data = pkg || this.generateEvidencePackage();
    const lines: string[] = [];

    lines.push(`# Enterprise Operational Evidence Package Report`);
    lines.push(`**Package ID:** ${data.packageId}`);
    lines.push(`**Generated At:** ${data.generatedAtIso}`);
    lines.push(`**Environment:** ${data.environment}`);
    lines.push(`**Overall Status:** ${data.overallStatus}`);
    lines.push(``);
    lines.push(`## Summary Statistics`);
    lines.push(`- Total Tests Registered: ${data.totalTestsRun}`);
    lines.push(`- Passed: ${data.passCount}`);
    lines.push(`- Failed: ${data.failCount}`);
    lines.push(`- Not Executed: ${data.notExecutedCount}`);
    lines.push(``);
    lines.push(`## Executed Test Details`);
    lines.push(`| Test ID | Category | Status | RPS | P95 (ms) | P99 (ms) | Duration (ms) |`);
    lines.push(`|---------|----------|--------|-----|----------|----------|---------------|`);

    for (const r of data.records) {
      lines.push(
        `| ${r.testId} | ${r.category} | ${r.status} | ${r.throughputRps.toFixed(1)} | ${r.latency.p95Ms.toFixed(1)} | ${r.latency.p99Ms.toFixed(1)} | ${r.durationMs} |`
      );
    }

    return lines.join("\n");
  }

  public exportAsCsv(pkg?: AggregatedEvidencePackage): string {
    const data = pkg || this.generateEvidencePackage();
    const header = "testId,testName,category,status,throughputRps,p50Ms,p95Ms,p99Ms,durationMs,executedAtIso\n";
    const rows = data.records.map(r =>
      `"${r.testId}","${r.testName}","${r.category}","${r.status}",${r.throughputRps},${r.latency.p50Ms},${r.latency.p95Ms},${r.latency.p99Ms},${r.durationMs},"${r.executedAtIso}"`
    ).join("\n");

    return header + rows;
  }
}
