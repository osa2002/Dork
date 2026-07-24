import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryResult } from "../recovery/RecoveryResult";
import { ChaosHealthDetails } from "../intelligence/ChaosHealthContributor";
import { SLOMetrics } from "../../../src/services/SLOService";
import { EnterpriseScores } from "../governance/EnterpriseScoreEngine";
import { DependencyNode, DependencyEdge } from "../intelligence/RuntimeDependencyGraph";

export interface DependencyGraphSnapshot {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface RollbackSnapshot {
  occurred: boolean;
  durationMs: number;
  success: boolean;
}

export interface KnowledgeRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly experimentId: string;
  readonly experimentName: string;
  readonly workflow: string; // resolved workflow name (e.g., "Rollback Workflow", "No Action")
  readonly decision: string; // decision type (e.g., "ROLLBACK", "NO_ACTION")
  readonly recovery: RecoveryResult | null; // recovery result, if executed
  readonly health: ChaosHealthDetails; // health snapshot
  readonly impact: number; // impact score
  readonly blastRadius: "Minimal" | "Low" | "Medium" | "High"; // classified blast radius
  readonly SLO: SLOMetrics; // SLO metrics scorecard
  readonly MTTR: number; // mean time to recovery in ms
  readonly rollback: RollbackSnapshot; // rollback performance
  readonly incidentId: string | null; // related incident identifier
  readonly enterpriseScore: EnterpriseScores; // SRE enterprise score scorecard snapshot
  readonly dependencyGraphSnapshot: DependencyGraphSnapshot; // dependencies at moment of impact
  readonly correlationId: string;
  readonly status: "SUCCESS" | "FAILED" | "DEGRADED" | "SKIPPED" | "PENDING_APPROVAL";
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, any>>;
}
