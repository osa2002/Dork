import { DecisionContext, DecisionContextBuilder } from "./DecisionContext";
import { AutonomousDecision, DecisionType } from "./AutonomousDecision";
import { DecisionPolicy, DecisionPolicyConfig } from "./DecisionPolicy";
import { DecisionHistory } from "./DecisionHistory";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class DecisionEngine {
  /**
   * Compiles the real-time operational context and evaluates SRE rules against the current policy
   * to determine the absolute safest course of autonomous action.
   */
  public static evaluate(customPolicy?: Partial<DecisionPolicyConfig>): AutonomousDecision {
    // 1. Load active policy configuration
    if (customPolicy) {
      DecisionPolicy.updatePolicy(customPolicy);
    }
    const policy = DecisionPolicy.getPolicy();

    // 2. Compile comprehensive platform context
    const context = DecisionContextBuilder.compileContext();
    const errorBudgetConsumed = 100 - context.standardSlo.availability.errorBudgetRemaining;

    // 3. Evaluate multi-dimensional SRE rules
    let decision: DecisionType = "NO_ACTION";
    let confidence = 100;
    const evidence: string[] = [];
    let reasoning = "";

    // Rule A: Active Unresolved Incidents (Highest Priority Safety Gate)
    const activeIncidents = context.incidents.filter(
      (inc) => inc.status === "INVESTIGATING" || inc.status === "IDENTIFIED" || inc.status === "MONITORING"
    );

    if (activeIncidents.length >= policy.maxIncidentCount) {
      decision = "PAUSE_EXPERIMENTS";
      confidence = 95;
      evidence.push(`Active incidents count (${activeIncidents.length}) meets or exceeds threshold (${policy.maxIncidentCount}).`);
      evidence.push(`Unresolved Incidents: ${activeIncidents.map((i) => `${i.title} (${i.severity})`).join(", ")}`);
      reasoning = "The platform is currently responding to active, unresolved production incidents. To safeguard remaining capacity and avoid noise, the autonomous safety governor has halted further chaos execution plans.";
    }

    // Rule B: Severe Health Degradation / Outage
    else if (policy.unacceptableHealthStates.includes(context.health.status)) {
      if (context.chaosStatus.isEnabled && context.chaosStatus.activeScenarios.length > 0) {
        decision = "ROLLBACK";
        confidence = 98;
        evidence.push(`System health has deteriorated to an unacceptable level: ${context.health.status}.`);
        evidence.push(`Active chaos scenarios currently executing: ${context.chaosStatus.activeScenarios.join(", ")}.`);
        reasoning = "Critical platform degradation detected while a chaos scenario is active. SRE boundaries require immediate rollback execution to isolate injected faults and restore baseline availability.";
      } else {
        // Severe health failure, but no chaos is enabled! We need to escalate or open incident
        decision = "OPEN_INCIDENT";
        confidence = 92;
        evidence.push(`System health has deteriorated to ${context.health.status} without any active chaos simulation.`);
        evidence.push(`System health reason: ${context.health.reason}`);
        reasoning = "Unacceptable platform health degradation occurred organically with no active chaos scenarios. The engine advises opening a critical alert incident and paging the on-call responder team.";
      }
    }

    // Rule C: High-Stress Degradation (Reduce Risk)
    else if (context.health.status === "DEGRADED" && context.chaosStatus.isEnabled) {
      decision = "REDUCE_RISK";
      confidence = 85;
      evidence.push(`System health status is DEGRADED.`);
      evidence.push(`Chaos probability: ${Math.round(context.chaosStatus.probability * 100)}%, global latency: ${context.chaosStatus.globalLatency}ms.`);
      reasoning = "System telemetry indicates mild degradation under active chaos testing. To maintain SLO compliance, the engine advises scaling back the injection probability and latency bounds before a full outage is triggered.";
    }

    // Rule D: SLO Compliance Breach or Excessive Error Budget Consumption
    else if (
      context.standardSlo.availability.actual < policy.sloAvailabilityThreshold ||
      errorBudgetConsumed > policy.errorBudgetConsumedThreshold
    ) {
      decision = "PAUSE_EXPERIMENTS";
      confidence = 90;
      if (context.standardSlo.availability.actual < policy.sloAvailabilityThreshold) {
        evidence.push(`SLO Availability (${context.standardSlo.availability.actual}%) is below acceptable threshold (${policy.sloAvailabilityThreshold}%).`);
      }
      if (errorBudgetConsumed > policy.errorBudgetConsumedThreshold) {
        evidence.push(`SLO Error Budget consumed (${errorBudgetConsumed.toFixed(2)}%) is above threshold (${policy.errorBudgetConsumedThreshold}%).`);
      }
      reasoning = "Key Performance Indicators (KPIs) show that SLO boundaries are severely depleted. Further chaos injection is restricted until availability margins stabilize.";
    }

    // Rule E: Critical Recoverability MTTR Degradation
    else if (context.slo.meanTimeToRecoveryMs > policy.maxAllowedMttrMs) {
      decision = "ESCALATE";
      confidence = 88;
      evidence.push(`Mean Time To Recovery (MTTR) is ${context.slo.meanTimeToRecoveryMs}ms, exceeding the SRE ceiling (${policy.maxAllowedMttrMs}ms).`);
      reasoning = "The platform's recovery pipeline is experiencing critical bottlenecks, exceeding our targeted MTTR limit. Immediate technical escalation is advised to audit automated recovery runbooks.";
    }

    // Rule F: Recovery Failure Detected
    else if (
      context.slo.recentRecoveries.filter((r) => !r.success).length > policy.recentFailedRecoveriesAllowed
    ) {
      decision = "PAUSE_EXPERIMENTS";
      confidence = 82;
      evidence.push(`Recent failed recovery operations detected in SLO audit records.`);
      reasoning = "One or more automated recoveries failed during active testing. New experiment executions are paused to prevent cascading risk while the rollback mechanisms are inspected.";
    }

    // Rule G: Severe Regression Anomalies Detected
    else if (context.regressionReport.isRegressed && context.regressionReport.scoreImpact > policy.regressionImpactAllowed) {
      decision = "MONITOR";
      confidence = 75;
      evidence.push(`System regression detected with stability score deduction of -${context.regressionReport.scoreImpact} points.`);
      evidence.push(`Detected anomalies: ${context.regressionReport.anomalies.map((a) => `${a.metric} (deviation: ${a.deviationPercentage}%)`).join(", ")}`);
      reasoning = "Significant stability or latency anomalies have been detected relative to pre-chaos historical baseline snapshots. The engine recommends stepping up observation resolution and deferring experimental execution.";
    }

    // Rule H: Stability Score Drop below Excellence Threshold
    else if (context.enterpriseScores.overallEnterpriseScore < policy.minOverallEnterpriseScore) {
      decision = "REQUEST_APPROVAL";
      confidence = 80;
      evidence.push(`Overall SRE stability score is ${context.enterpriseScores.overallEnterpriseScore}/100, which is below the excellence gate of ${policy.minOverallEnterpriseScore}/100.`);
      reasoning = "The overall SRE maturity and operational readiness score has dipped below SRE guidelines. New scheduled experiments require manual review and explicit approval by an operator.";
    }

    // Rule I: Green SRE Platform - Proactive Experimentation candidate
    else if (context.health.status === "HEALTHY" && !context.chaosStatus.isEnabled) {
      decision = "RUN_EXPERIMENT";
      confidence = 92;
      evidence.push(`Overall SRE score is ${context.enterpriseScores.overallEnterpriseScore}/100 with an operational letter grade of ${context.enterpriseScores.letterGrade}.`);
      evidence.push(`System health is fully HEALTHY with zero active faults or unresolved regressions.`);
      evidence.push(`Resilience blast radius coverage is currently at ${context.coverage.overallCoveragePercentage}%.`);
      reasoning = "The platform is operating at peak efficiency with fully intact error budgets. The SRE governor has approved proactive execution of scheduled scenarios to discover latent dependencies and extend blast-radius coverage.";
    }

    // Rule J: Active Simulation running flawlessly
    else if (context.health.status === "HEALTHY" && context.chaosStatus.isEnabled) {
      decision = "MONITOR";
      confidence = 90;
      evidence.push("Chaos testing is actively running on the platform.");
      evidence.push("Telemetry indicates system continues to behave in a HEALTHY state with zero breaches.");
      reasoning = "An active resilience simulation is currently executing in production. Telemetry verifies the architecture is digesting the faults flawlessly; continuing normal real-time monitoring.";
    }

    // Default Fallback
    else {
      decision = "NO_ACTION";
      confidence = 95;
      evidence.push("All platform systems are functioning within normal design parameters.");
      reasoning = "No actionable anomalies or trigger-events have been observed. The system is in an optimal stationary state.";
    }

    // Create decision payload
    const finalDecision: AutonomousDecision = {
      id: `dec-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      decision,
      confidence,
      reasoning,
      context,
      evidence,
    };

    // 4. Record decision to log history
    DecisionHistory.addDecision(finalDecision);

    // 5. Integrate through EventBus subscription/publish (non-blocking)
    EnterpriseEventBus.publish("SystemStateChanged", {
      trigger: "Autonomous Resilience Evaluation",
      state: {
        status: context.health.status,
        decision: finalDecision.decision,
        confidence: finalDecision.confidence,
        reasoning: finalDecision.reasoning,
      },
    });

    return finalDecision;
  }
}
