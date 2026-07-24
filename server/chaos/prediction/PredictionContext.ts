import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { KnowledgeInsights, EnterpriseInsights } from "../knowledge/KnowledgeInsights";
import { KnowledgeCorrelation, CorrelationReport } from "../knowledge/KnowledgeCorrelation";
import { TrendAnalysisEngine, TrendAnalysisReport } from "../governance/TrendAnalysis";
import { EnterpriseScoreEngine, EnterpriseScores } from "../governance/EnterpriseScoreEngine";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { ChaosHistory, ChaosHistoryRecord } from "../orchestrator/ChaosHistory";
import { KnowledgeRecord } from "../knowledge/KnowledgeRecord";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryResult } from "../recovery/RecoveryResult";

export interface PredictionContextData {
  readonly timestamp: string;
  readonly records: readonly KnowledgeRecord[];
  readonly insights: EnterpriseInsights | null;
  readonly correlation: CorrelationReport | null;
  readonly trends: TrendAnalysisReport;
  readonly enterpriseScores: EnterpriseScores;
  readonly dependencyGraph: {
    nodes: any[];
    edges: any[];
  };
  readonly decisionHistory: readonly AutonomousDecision[];
  readonly recoveryHistory: readonly RecoveryResult[];
  readonly chaosHistory: readonly ChaosHistoryRecord[];
}

export class PredictionContext {
  /**
   * Collects and bundles all historical and live runtime telemetry from SRE controllers.
   */
  public static collect(): PredictionContextData {
    const records = KnowledgeRepository.getAll();
    const insights = records.length > 0 ? KnowledgeInsights.generate(records) : null;
    const correlation = records.length > 0 ? KnowledgeCorrelation.analyze(records) : null;
    const trends = TrendAnalysisEngine.analyzeTrends();
    const enterpriseScores = EnterpriseScoreEngine.calculateScores();
    const dependencyGraph = RuntimeDependencyGraph.getGraph();
    const decisionHistory = DecisionHistory.getHistory();
    const recoveryHistory = RecoveryHistory.getHistory();
    const chaosHistory = ChaosHistory.getHistory();

    return {
      timestamp: new Date().toISOString(),
      records,
      insights,
      correlation,
      trends,
      enterpriseScores,
      dependencyGraph,
      decisionHistory,
      recoveryHistory,
      chaosHistory,
    };
  }
}
