import { KnowledgeRecord } from "./KnowledgeRecord";

export type FailureType = "Latency Injection" | "Network Interruption" | "Database Outage" | "API Outage" | "Resource Exhaustion" | "Unknown";
export type RecoveryPattern = "Rollback" | "Manual Approval" | "Pause Experiments" | "Escalation" | "No Action" | "Unknown";
export type DependencyType = "Database" | "Internal Service" | "External API" | "Gateway" | "Unknown";
export type InfrastructureType = "Application" | "Database" | "External API";
export type SREPillar = "Security" | "Performance" | "Reliability";

export interface KnowledgeClassification {
  readonly failureType: FailureType;
  readonly recoveryPattern: RecoveryPattern;
  readonly dependencyType: DependencyType;
  readonly infrastructure: InfrastructureType;
  readonly pillar: SREPillar;
}

export class KnowledgeClassifier {
  /**
   * Automatically classifies a KnowledgeRecord based on metrics, dependency snapshot,
   * tags, and SRE context.
   */
  public static classify(record: KnowledgeRecord): KnowledgeClassification {
    const expNameLower = record.experimentName.toLowerCase();
    const expIdLower = record.experimentId.toLowerCase();
    const tagsLower = record.tags.map((t) => t.toLowerCase());

    // 1. Failure Type
    let failureType: FailureType = "Unknown";
    if (
      expNameLower.includes("latency") ||
      expNameLower.includes("delay") ||
      expNameLower.includes("slow") ||
      tagsLower.includes("latency") ||
      tagsLower.includes("slow")
    ) {
      failureType = "Latency Injection";
    } else if (
      expNameLower.includes("database") ||
      expNameLower.includes("firestore") ||
      expNameLower.includes("sql") ||
      tagsLower.includes("database")
    ) {
      failureType = "Database Outage";
    } else if (
      expNameLower.includes("api") ||
      expNameLower.includes("http") ||
      expNameLower.includes("external") ||
      expNameLower.includes("twilio") ||
      tagsLower.includes("api")
    ) {
      failureType = "API Outage";
    } else if (
      expNameLower.includes("network") ||
      expNameLower.includes("disconnect") ||
      tagsLower.includes("network")
    ) {
      failureType = "Network Interruption";
    } else if (
      expNameLower.includes("exhaustion") ||
      expNameLower.includes("cpu") ||
      expNameLower.includes("memory") ||
      tagsLower.includes("resource")
    ) {
      failureType = "Resource Exhaustion";
    }

    // 2. Recovery Pattern
    let recoveryPattern: RecoveryPattern = "Unknown";
    const wfLower = record.workflow.toLowerCase();
    if (wfLower.includes("rollback") || record.rollback.occurred) {
      recoveryPattern = "Rollback";
    } else if (wfLower.includes("approval") || record.status === "PENDING_APPROVAL") {
      recoveryPattern = "Manual Approval";
    } else if (wfLower.includes("pause")) {
      recoveryPattern = "Pause Experiments";
    } else if (wfLower.includes("escalat")) {
      recoveryPattern = "Escalation";
    } else if (wfLower.includes("no action")) {
      recoveryPattern = "No Action";
    }

    // 3. Dependency Type & Infrastructure classification
    let dependencyType: DependencyType = "Unknown";
    let infrastructure: InfrastructureType = "Application";

    const nodeTypes = record.dependencyGraphSnapshot?.nodes?.map((n) => n.type) || [];

    if (
      expNameLower.includes("api") ||
      expNameLower.includes("twilio") ||
      expNameLower.includes("external") ||
      tagsLower.includes("api")
    ) {
      dependencyType = "External API";
      infrastructure = "External API";
    } else if (
      expNameLower.includes("database") ||
      expNameLower.includes("firestore") ||
      expNameLower.includes("sql") ||
      tagsLower.includes("database")
    ) {
      dependencyType = "Database";
      infrastructure = "Database";
    } else if (nodeTypes.includes("database")) {
      dependencyType = "Database";
      infrastructure = "Database";
    } else if (nodeTypes.includes("service") || expNameLower.includes("service") || expIdLower.includes("service")) {
      dependencyType = "Internal Service";
      infrastructure = "Application";
    } else {
      dependencyType = "Gateway";
      infrastructure = "Application";
    }

    // 4. SRE Pillar Classification (Security, Performance, Reliability)
    let pillar: SREPillar = "Reliability";
    if (failureType === "Latency Injection" || record.health?.latencyAddedMs > 0 || expNameLower.includes("slow")) {
      pillar = "Performance";
    } else if (expNameLower.includes("auth") || expNameLower.includes("security") || tagsLower.includes("security") || expIdLower.includes("auth")) {
      pillar = "Security";
    }

    return Object.freeze({
      failureType,
      recoveryPattern,
      dependencyType,
      infrastructure,
      pillar,
    });
  }
}
