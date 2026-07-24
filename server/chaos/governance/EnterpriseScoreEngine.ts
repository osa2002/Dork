import { ChaosSLOIntegration } from "../intelligence/ChaosSLOIntegration";
import { ChaosCoverageAnalyzer } from "../intelligence/ChaosCoverageAnalyzer";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { MetricsService } from "../../../src/services/MetricsService";
import { SLOService } from "../../../src/services/SLOService";

export interface EnterpriseScores {
  reliabilityScore: number;     // SLO compliance & availability bounds (0-100)
  resilienceScore: number;      // Scenario coverage and failure mitigation (0-100)
  recoverabilityScore: number;  // MTTR performance and rollback success (0-100)
  observabilityScore: number;   // Telemetry density & dependency mapping (0-100)
  operationalReadiness: number; // Actionable recommendations & health state (0-100)
  overallEnterpriseScore: number; // Weighted average (0-100)
  letterGrade: "A+" | "A" | "B" | "C" | "D" | "F";
}

export class EnterpriseScoreEngine {
  /**
   * Compiles dynamic, multi-dimensional reliability and resilience scores.
   */
  public static calculateScores(): EnterpriseScores {
    const slo = SLOService.getSLOSummary();
    const chaosSlo = ChaosSLOIntegration.getSLOMetrics();
    const coverage = ChaosCoverageAnalyzer.getCoverageReport();
    const dependencyGraph = RuntimeDependencyGraph.getGraph();
    const health = ChaosHealthContributor.getHealthStatus();
    const counts = MetricsService.getCounts();

    // 1. Reliability Score: Based on SLO Availability and remaining error budget
    const avPercent = slo.availability.actual; // e.g. 99.9%
    const budgetRemaining = slo.availability.errorBudgetRemaining; // e.g. 85%
    // Deduct from 100 based on availability shortfall
    const avLoss = Math.max(0, (100 - avPercent) * 10);
    const budgetLoss = (100 - budgetRemaining) * 0.3;
    const reliabilityScore = Math.max(10, Math.round(100 - avLoss - budgetLoss));

    // 2. Resilience Score: Based on overall coverage percentage and active chaos impact
    const coverageImpact = coverage.overallCoveragePercentage * 0.6; // e.g. 60% of score comes from coverage
    const statePenalty = health.impactScore * 0.4; // up to 40 points penalty if heavy chaos is actively degrading the system
    const resilienceScore = Math.max(10, Math.min(100, Math.round(40 + coverageImpact - statePenalty)));

    // 3. Recoverability Score: Based on MTTR and rollback success rate
    let mttrPenalty = 0;
    const mttr = chaosSlo.meanTimeToRecoveryMs;
    if (mttr > 3000) mttrPenalty = 40;
    else if (mttr > 1500) mttrPenalty = 25;
    else if (mttr > 500) mttrPenalty = 10;

    // Check failed recoveries
    const totalRecoveries = chaosSlo.recentRecoveries.length;
    const failedRecoveries = chaosSlo.recentRecoveries.filter((r) => !r.success).length;
    const recoverySuccessRate = totalRecoveries > 0 ? (totalRecoveries - failedRecoveries) / totalRecoveries : 1;
    const successPenalty = (1 - recoverySuccessRate) * 50;

    const recoverabilityScore = Math.max(10, Math.round(100 - mttrPenalty - successPenalty));

    // 4. Observability Score: Based on active telemetry points and dependency nodes registered
    const telemetryPoints = Math.min(20, counts.apiRequests > 0 ? 10 : 0 + counts.firestoreReads > 0 ? 10 : 0);
    const graphNodesCount = dependencyGraph.nodes.length;
    const graphScore = Math.min(50, graphNodesCount * 8); // scale node mappings
    const observabilityScore = Math.min(100, Math.round(30 + telemetryPoints + graphScore));

    // 5. Operational Readiness: Adherence to policies, absence of critical recommendations, and system health status
    let healthBonus = 50;
    if (health.status === "UNAVAILABLE") healthBonus = 10;
    else if (health.status === "PARTIAL_OUTAGE") healthBonus = 25;
    else if (health.status === "DEGRADED") healthBonus = 40;

    // Check coverage status
    const testedRatio = coverage.testedSubsystemsCount / (coverage.subsystems.length || 1);
    const operationalReadiness = Math.round(healthBonus + (testedRatio * 50));

    // 6. Overall Enterprise Score: Average of the 5 key pillars
    const overallEnterpriseScore = Math.round(
      (reliabilityScore + resilienceScore + recoverabilityScore + observabilityScore + operationalReadiness) / 5
    );

    // Letter grade allocation
    let letterGrade: "A+" | "A" | "B" | "C" | "D" | "F" = "F";
    if (overallEnterpriseScore >= 95) letterGrade = "A+";
    else if (overallEnterpriseScore >= 85) letterGrade = "A";
    else if (overallEnterpriseScore >= 70) letterGrade = "B";
    else if (overallEnterpriseScore >= 55) letterGrade = "C";
    else if (overallEnterpriseScore >= 40) letterGrade = "D";

    return {
      reliabilityScore,
      resilienceScore,
      recoverabilityScore,
      observabilityScore,
      operationalReadiness,
      overallEnterpriseScore,
      letterGrade,
    };
  }
}
