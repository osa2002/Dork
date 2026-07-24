import { ChaosState } from "../ChaosState";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { ChaosSLOIntegration } from "../intelligence/ChaosSLOIntegration";
import { ChaosCoverageAnalyzer } from "../intelligence/ChaosCoverageAnalyzer";
import { ChaosIntelligenceEngine } from "../intelligence/ChaosIntelligenceEngine";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";
import { EnterpriseScoreEngine } from "./EnterpriseScoreEngine";
import { TrendAnalysisEngine } from "./TrendAnalysis";
import { RegressionDetector } from "./RegressionDetector";
import { ChaosAuditTrail } from "./ChaosAuditTrail";

export class OperationalDashboardModel {
  /**
   * Compiles the full aggregated enterprise operations dashboard model.
   */
  public static getDashboardPayload() {
    const isEnabled = ChaosState.getIsEnabled();
    const activeScenarios = ChaosState.getActiveScenarios();
    const probability = ChaosState.getProbability();
    const globalLatency = ChaosState.getLatency();

    const health = ChaosHealthContributor.getHealthStatus();
    const slo = ChaosSLOIntegration.getSLOMetrics();
    const coverage = ChaosCoverageAnalyzer.getCoverageReport();
    const recommendations = ChaosIntelligenceEngine.getRecommendations();
    const dependencyGraph = RuntimeDependencyGraph.getGraph();
    const scores = EnterpriseScoreEngine.calculateScores();
    const trends = TrendAnalysisEngine.analyzeTrends();
    const regressionReport = RegressionDetector.detectRegressions();
    const auditLogs = ChaosAuditTrail.getLogs();

    return {
      timestamp: new Date().toISOString(),
      chaosStatus: {
        isEnabled,
        activeScenarios,
        probability,
        globalLatency,
      },
      health,
      slo,
      coverage,
      recommendations,
      dependencyGraph,
      enterpriseScores: scores,
      trends,
      regressionReport,
      auditLogs,
    };
  }
}
