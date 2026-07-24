import { TwinSnapshot } from "./TwinSnapshot";
import { TwinState } from "./TwinState";
import { TwinSimulation } from "./TwinSimulation";
import { TwinComparison } from "./TwinComparison";
import { TwinReporter, TwinReporterOutput } from "./TwinReporter";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { SLOService } from "../../../src/services/SLOService";
import { MetricsService } from "../../../src/services/MetricsService";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { EnterpriseScoreEngine } from "../governance/EnterpriseScoreEngine";
import { TrendAnalysisEngine } from "../governance/TrendAnalysis";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { ChaosRegistry } from "../ChaosRegistry";
import { ChaosState } from "../ChaosState";
import { ChaosAuditTrail } from "../governance/ChaosAuditTrail";

export class DigitalTwinEngine {
  /**
   * Captures the live production state and converts it into a digital TwinState.
   */
  public static createTwinFromProduction(correlationId?: string): TwinState {
    const snap = this.captureSnapshot(correlationId);
    return new TwinState(snap);
  }

  /**
   * Internal capture helper to compile raw platform components into a standard TwinSnapshot structure.
   */
  private static captureSnapshot(correlationId?: string): TwinSnapshot {
    const corrId = correlationId || `corr-twin-${Math.random().toString(36).substring(2, 9)}`;
    const execId = `exec-twin-${Math.random().toString(36).substring(2, 9)}`;

    const prediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY", corrId);

    const snapshot: TwinSnapshot = {
      health: ChaosHealthContributor.getHealthStatus(),
      dependencyGraph: RuntimeDependencyGraph.getGraph(),
      metrics: {
        system: MetricsService.getSystemMetrics(),
        counts: MetricsService.getCounts(),
        business: MetricsService.getBusinessMetrics(),
      },
      prediction,
      knowledge: KnowledgeRepository.getAll(),
      decisionState: DecisionHistory.getHistory(),
      recoveryState: RecoveryHistory.getHistory(),
      governance: {
        scores: EnterpriseScoreEngine.calculateScores(),
        trends: TrendAnalysisEngine.analyzeTrends(),
        logs: ChaosAuditTrail.getLogs(),
      },
      slo: SLOService.getSLOSummary(),
      experimentRegistry: ChaosRegistry.getAll().map((s) => s.name),
      chaosConfig: {
        isEnabled: ChaosState.getIsEnabled(),
        globalProbability: ChaosState.getProbability(),
        globalLatency: ChaosState.getLatency(),
        activeScenarios: ChaosState.getActiveScenarios(),
        targetEndpoints: ChaosState.getTargetEndpoints(),
      },
      timestamp: new Date().toISOString(),
      correlationId: corrId,
      executionId: execId,
    };

    return Object.freeze(snapshot);
  }

  /**
   * Complete Digital Twin orchestration flow.
   */
  public static async runTwinSimulation(
    scenarioType: "firestore_failure" | "stripe_failure" | "gemini_timeout" | "memory_pressure" | "cpu_saturation" | "cascade_failure",
    correlationId?: string
  ): Promise<TwinReporterOutput> {
    const corrId = correlationId || `corr-twin-sim-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Snapshot + Virtual State Creation
    const beforeState = this.createTwinFromProduction(corrId);

    // 2. Scenario Simulation Selector
    let sim: (s: TwinState) => TwinState;
    let scenarioName: string;

    switch (scenarioType) {
      case "firestore_failure":
        sim = TwinSimulation.simulateFirestoreFailure;
        scenarioName = "Virtual Firestore Outage Simulation";
        break;
      case "stripe_failure":
        sim = TwinSimulation.simulateStripeFailure;
        scenarioName = "Virtual Stripe Gateway Disruption";
        break;
      case "gemini_timeout":
        sim = TwinSimulation.simulateGeminiTimeout;
        scenarioName = "Virtual Gemini API High-Latency Timeout";
        break;
      case "memory_pressure":
        sim = TwinSimulation.simulateMemoryPressure;
        scenarioName = "Virtual Server Memory Pressure Saturation";
        break;
      case "cpu_saturation":
        sim = TwinSimulation.simulateCpuSaturation;
        scenarioName = "Virtual CPU Core Saturation Stress Test";
        break;
      case "cascade_failure":
        sim = TwinSimulation.simulateCascadeFailure;
        scenarioName = "Virtual Cascading Infrastructure Meltdown Scenario";
        break;
      default:
        throw new Error(`Unsupported digital twin simulation scenario: ${scenarioType}`);
    }

    const afterState = sim(beforeState);

    // 3. Comparison Delta Analysis
    const delta = TwinComparison.compare(beforeState, afterState);

    // 4. Verification and Prediction Validation
    // Check if the afterState prediction is validated
    const predictionScore = afterState.getData().prediction.riskScore;
    const isPredictionValid = delta.riskDelta.isRiskIncreased && predictionScore > 20;

    // 5. Generate complete Report Output
    const report = TwinReporter.generateReport(scenarioName, beforeState, afterState, delta);

    // Publish event asynchronously via Enterprise Event Bus
    EnterpriseEventBus.publish("SystemStateChanged", {
      reportId: report.reportId,
      scenarioName,
      correlationId: corrId,
      readinessScore: report.enterpriseReadinessScore,
      isPredictionValid,
    }, corrId);

    return report;
  }
}
