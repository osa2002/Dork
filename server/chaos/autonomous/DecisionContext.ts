import { ChaosState } from "../ChaosState";
import { ChaosHealthContributor, ChaosHealthDetails } from "../intelligence/ChaosHealthContributor";
import { ChaosSLOIntegration, ChaosSLOReport } from "../intelligence/ChaosSLOIntegration";
import { ChaosCoverageAnalyzer, CoverageReport } from "../intelligence/ChaosCoverageAnalyzer";
import { RuntimeDependencyGraph, DependencyNode, DependencyEdge } from "../intelligence/RuntimeDependencyGraph";
import { EnterpriseScoreEngine, EnterpriseScores } from "../governance/EnterpriseScoreEngine";
import { TrendAnalysisEngine, TrendAnalysisReport } from "../governance/TrendAnalysis";
import { RegressionDetector, RegressionReport } from "../governance/RegressionDetector";
import { ChaosAuditTrail, ChaosAuditRecord } from "../governance/ChaosAuditTrail";
import { EnterpriseEventBus, OperationalEvent } from "../governance/EnterpriseEventBus";
import { IncidentService, Incident } from "../../../src/services/IncidentService";
import { SLOService, SLOMetrics } from "../../../src/services/SLOService";

export interface DecisionContext {
  timestamp: string;
  health: ChaosHealthDetails;
  chaosStatus: {
    isEnabled: boolean;
    activeScenarios: string[];
    probability: number;
    globalLatency: number;
  };
  slo: ChaosSLOReport;
  standardSlo: SLOMetrics;
  coverage: CoverageReport;
  dependencyGraph: {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
  };
  enterpriseScores: EnterpriseScores;
  trends: TrendAnalysisReport;
  regressionReport: RegressionReport;
  auditLogs: ChaosAuditRecord[];
  events: OperationalEvent[];
  incidents: Incident[];
}

export class DecisionContextBuilder {
  public static compileContext(): DecisionContext {
    const isEnabled = ChaosState.getIsEnabled();
    const activeScenarios = ChaosState.getActiveScenarios();
    const probability = ChaosState.getProbability();
    const globalLatency = ChaosState.getLatency();

    return {
      timestamp: new Date().toISOString(),
      health: ChaosHealthContributor.getHealthStatus(),
      chaosStatus: {
        isEnabled,
        activeScenarios,
        probability,
        globalLatency,
      },
      slo: ChaosSLOIntegration.getSLOMetrics(),
      standardSlo: SLOService.getSLOSummary(),
      coverage: ChaosCoverageAnalyzer.getCoverageReport(),
      dependencyGraph: RuntimeDependencyGraph.getGraph(),
      enterpriseScores: EnterpriseScoreEngine.calculateScores(),
      trends: TrendAnalysisEngine.analyzeTrends(),
      regressionReport: RegressionDetector.detectRegressions(),
      auditLogs: ChaosAuditTrail.getLogs(),
      events: EnterpriseEventBus.getHistory(),
      incidents: IncidentService.getIncidents(),
    };
  }
}
