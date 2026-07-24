import { SLOMetrics } from "../../../src/services/SLOService";
import { SystemMetrics, QueueBusinessMetrics } from "../../../src/services/MetricsService";
import { DependencyNode, DependencyEdge } from "../intelligence/RuntimeDependencyGraph";
import { KnowledgeRecord } from "../knowledge/KnowledgeRecord";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryResult } from "../recovery/RecoveryResult";
import { EnterpriseScores } from "../governance/EnterpriseScoreEngine";
import { TrendAnalysisReport } from "../governance/TrendAnalysis";

export interface TwinSnapshot {
  readonly health: any;
  readonly dependencyGraph: {
    readonly nodes: readonly DependencyNode[];
    readonly edges: readonly DependencyEdge[];
  };
  readonly metrics: {
    readonly system: SystemMetrics;
    readonly counts: any;
    readonly business: QueueBusinessMetrics;
  };
  readonly prediction: any;
  readonly knowledge: readonly KnowledgeRecord[];
  readonly decisionState: readonly AutonomousDecision[];
  readonly recoveryState: readonly RecoveryResult[];
  readonly governance: {
    readonly scores: EnterpriseScores;
    readonly trends: TrendAnalysisReport;
    readonly logs: readonly any[];
  };
  readonly slo: SLOMetrics;
  readonly experimentRegistry: readonly string[];
  readonly chaosConfig: {
    readonly isEnabled: boolean;
    readonly globalProbability: number;
    readonly globalLatency: number;
    readonly activeScenarios: readonly string[];
    readonly targetEndpoints: readonly string[];
  };
  readonly timestamp: string;
  readonly correlationId: string;
  readonly executionId: string;
}
