import { PredictionContext, PredictionContextData } from "./PredictionContext";
import { PredictionModel, PredictionType } from "./PredictionModel";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class PredictionEngine {
  /**
   * Generates a deterministic, rule-weighted SRE prediction based on historical and live context.
   * Completely stateless, stateless-conforming, with no machine learning or AI services.
   * Publishes "PredictionCreated" to the Enterprise Event Bus.
   */
  public static generatePrediction(type: PredictionType, correlationId?: string): PredictionModel {
    const context = PredictionContext.collect();
    const corrId = correlationId || `corr-pred-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const predictionId = `pred-${Math.random().toString(36).substring(2, 9)}`;

    let prediction: PredictionModel;

    switch (type) {
      case "FAILURE_PROBABILITY":
        prediction = this.predictFailureProbability(predictionId, timestamp, corrId, context);
        break;
      case "RECOVERY_PROBABILITY":
        prediction = this.predictRecoveryProbability(predictionId, timestamp, corrId, context);
        break;
      case "ERROR_BUDGET_CONSUMPTION":
        prediction = this.predictErrorBudgetConsumption(predictionId, timestamp, corrId, context);
        break;
      case "MTTR_EVOLUTION":
        prediction = this.predictMTTREvolution(predictionId, timestamp, corrId, context);
        break;
      case "BLAST_RADIUS_EVOLUTION":
        prediction = this.predictBlastRadiusEvolution(predictionId, timestamp, corrId, context);
        break;
      case "SUBSYSTEM_DEGRADATION":
        prediction = this.predictSubsystemDegradation(predictionId, timestamp, corrId, context);
        break;
      case "DEPENDENCY_INSTABILITY":
        prediction = this.predictDependencyInstability(predictionId, timestamp, corrId, context);
        break;
      default:
        throw new Error(`Unsupported prediction type: ${type}`);
    }

    // Publish event asynchronously via Enterprise Event Bus
    EnterpriseEventBus.publish("PredictionCreated", prediction, corrId);

    return Object.freeze(prediction);
  }

  private static predictFailureProbability(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    let probability = 0.05; // 5% base failure probability
    const evidence: string[] = ["Calculated base operational risk profile (5%)."];

    // 1. Evaluate active dependency node statuses
    const degradedNodes = ctx.dependencyGraph.nodes.filter((n) => n.status !== "HEALTHY");
    if (degradedNodes.length > 0) {
      for (const node of degradedNodes) {
        if (node.status === "UNAVAILABLE") {
          probability += 0.30;
          evidence.push(`Active critical dependency outage detected on: ${node.name} (+30% risk).`);
        } else if (node.status === "PARTIAL_OUTAGE") {
          probability += 0.20;
          evidence.push(`Active partial outage detected on: ${node.name} (+20% risk).`);
        } else if (node.status === "DEGRADED") {
          probability += 0.10;
          evidence.push(`Active latency degradation detected on: ${node.name} (+10% risk).`);
        }
      }
    }

    // 2. Evaluate current reliability scores
    const reliability = ctx.enterpriseScores.reliabilityScore;
    if (reliability < 55) {
      probability += 0.35;
      evidence.push(`Governance reliability score is critically low: ${reliability}/100 (+35% risk).`);
    } else if (reliability < 70) {
      probability += 0.20;
      evidence.push(`Governance reliability score is degraded: ${reliability}/100 (+20% risk).`);
    } else if (reliability < 90) {
      probability += 0.08;
      evidence.push(`Governance reliability score is nominal but imperfect: ${reliability}/100 (+8% risk).`);
    }

    // 3. Evaluate trends
    if (ctx.trends.errorBudgetTrend === "regressing") {
      probability += 0.15;
      evidence.push(`Error budget consumption trend is degrading (+15% risk).`);
    }
    if (ctx.trends.mttrTrend === "regressing") {
      probability += 0.10;
      evidence.push(`MTTR evolution shows positive derivative/slowing recovery (+10% risk).`);
    }

    // 4. Bounded limit clamps
    probability = Math.max(0.01, Math.min(0.99, probability));
    const riskScore = Math.round(probability * 100);

    // Compute confidence based on historical data points
    const confidence = ctx.records.length >= 5 ? 0.90 : ctx.records.length >= 1 ? 0.75 : 0.50;
    if (ctx.records.length === 0) {
      evidence.push("Low telemetry density. Prediction confidence falls back to baseline default.");
    } else {
      evidence.push(`Telemetry validation success. Confirmed sample sizes of ${ctx.records.length} records.`);
    }

    const recommendations = [
      "Provision circuit breaker patterns for degraded external API and DB pathways.",
      "Enforce standard rate-limit thresholds on ingress points to avoid cascade saturation.",
      "Audit SLO latency compliance under simulated high concurrency load."
    ];

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "FAILURE_PROBABILITY",
      confidence,
      riskScore,
      predictedFailure: probability > 0.4 ? "Potential Cascading SLO Budget Exhaustion" : "Nominal Operational Jitter",
      predictedRecovery: "Automated Orchestrator Fast-Failback Workflow",
      predictedMTTR: ctx.insights ? ctx.insights.highestMTTRMs : 1200,
      predictedBlastRadius: probability > 0.6 ? "High" : probability > 0.3 ? "Medium" : "Low",
      predictedErrorBudgetConsumption: ctx.trends.recentDataPoints[ctx.trends.recentDataPoints.length - 1]?.errorBudgetConsumed || 12.5,
      affectedSubsystems: degradedNodes.map((n) => n.id),
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze(recommendations),
    };
  }

  private static predictRecoveryProbability(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    let recoveryProb = 0.85; // 85% base recoverability success expectation
    const evidence: string[] = ["Calculated base autonomous recoverability probability (85%)."];

    // Weight based on actual historical score
    const recScore = ctx.enterpriseScores.recoverabilityScore;
    if (recScore < 70) {
      recoveryProb -= 0.20;
      evidence.push(`Historically slow MTTR patterns. Recoverability score under review: ${recScore}/100.`);
    } else if (recScore >= 90) {
      recoveryProb += 0.10;
      evidence.push(`Excellent recoverability score: ${recScore}/100 (+10% confidence in mitigation).`);
    }

    // Rollback pattern success rate from correlation reports
    if (ctx.correlation && ctx.correlation.rollbackPatterns) {
      const rollbackSuccess = ctx.correlation.rollbackPatterns.successRate;
      const totalRollbacks = ctx.correlation.rollbackPatterns.totalRollbacks;
      if (totalRollbacks > 0) {
        if (rollbackSuccess < 100) {
          const penalty = (100 - rollbackSuccess) / 100 * 0.3;
          recoveryProb -= penalty;
          evidence.push(`Detected failed rollback attempts in historical correlation. Adjusted mitigation success downward by ${(penalty * 100).toFixed(1)}%.`);
        } else {
          recoveryProb += 0.05;
          evidence.push("Deterministic analysis of historical rollbacks confirms 100% success rate on triggers.");
        }
      }
    }

    // Recent recovery history failures
    if (ctx.recoveryHistory.length > 0) {
      const total = ctx.recoveryHistory.length;
      const failed = ctx.recoveryHistory.filter((r) => r.status === "FAILED").length;
      if (failed > 0) {
        const failureRatio = failed / total;
        recoveryProb -= (failureRatio * 0.2);
        evidence.push(`Active recovery outcomes show failures in ${failed} of ${total} executions.`);
      }
    }

    recoveryProb = Math.max(0.10, Math.min(0.99, recoveryProb));
    const riskScore = Math.round((1 - recoveryProb) * 100);
    const confidence = ctx.recoveryHistory.length >= 3 ? 0.92 : 0.65;

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "RECOVERY_PROBABILITY",
      confidence,
      riskScore,
      predictedFailure: "None",
      predictedRecovery: "Self-Healing Playbook Orchestration",
      predictedMTTR: ctx.trends.recentDataPoints[ctx.trends.recentDataPoints.length - 1]?.avgMTTRMs || 920,
      predictedBlastRadius: "Low",
      predictedErrorBudgetConsumption: 0.5,
      affectedSubsystems: [],
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze([
        "Optimize playbook timeout tolerances inside RecoveryEngine.",
        "Introduce synthetic heartbeat verifications inside clean-up stages.",
        "Map failover clusters to multiple redundant target hosts."
      ]),
    };
  }

  private static predictErrorBudgetConsumption(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    const recentPoints = ctx.trends.recentDataPoints;
    const currentBudget = recentPoints[recentPoints.length - 1]?.errorBudgetConsumed || 12.5;
    let predictedConsumption = currentBudget;
    const evidence: string[] = [`Current historical error budget consumption is: ${currentBudget.toFixed(2)}%.`];

    if (ctx.trends.errorBudgetTrend === "regressing") {
      predictedConsumption += 15.0;
      evidence.push("Regressing SRE governance indicators predict an upcoming +15.0% SLO margin erosion.");
    } else if (ctx.trends.errorBudgetTrend === "improving") {
      predictedConsumption -= 3.5;
      evidence.push("Positive resilience trends indicate an estimated -3.5% reduction in budget consumption.");
    }

    const degradedNodes = ctx.dependencyGraph.nodes.filter((n) => n.status !== "HEALTHY");
    if (degradedNodes.length > 0) {
      const addition = degradedNodes.length * 8.5;
      predictedConsumption += addition;
      evidence.push(`Found ${degradedNodes.length} degraded/unhealthy nodes in runtime topology graph (+${addition.toFixed(1)}% budget risk).`);
    }

    predictedConsumption = Math.max(0.0, Math.min(100.0, predictedConsumption));
    const riskScore = Math.round(predictedConsumption);
    const confidence = ctx.trends.recentDataPoints.length >= 7 ? 0.95 : 0.70;

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "ERROR_BUDGET_CONSUMPTION",
      confidence,
      riskScore,
      predictedFailure: predictedConsumption > 50.0 ? "SLO Margin Breach Risk" : "Budget Consumption Under Variance Bounds",
      predictedRecovery: "Proactive Incident Mitigation Engine Call",
      predictedMTTR: 1000,
      predictedBlastRadius: predictedConsumption > 60.0 ? "High" : "Low",
      predictedErrorBudgetConsumption: predictedConsumption,
      affectedSubsystems: degradedNodes.map((n) => n.id),
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze([
        "Enforce strict deployment freezes on submodules experiencing SLA deviations.",
        "Recalibrate alarm thresholds on downstream external gateways.",
        "Refactor high-latency queries to cache read operations."
      ]),
    };
  }

  private static predictMTTREvolution(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    const recentPoints = ctx.trends.recentDataPoints;
    const baseMTTR = recentPoints[recentPoints.length - 1]?.avgMTTRMs || 920;
    let predictedMTTR = baseMTTR;
    const evidence: string[] = [`Current MTTR baseline calibrated to: ${baseMTTR}ms.`];

    if (ctx.correlation && ctx.correlation.mttrTrend === "degrading") {
      predictedMTTR = Math.round(predictedMTTR * 1.35);
      evidence.push("Chronological regression analysis indicates MTTR is degrading (+35% duration).");
    } else if (ctx.correlation && ctx.correlation.mttrTrend === "improving") {
      predictedMTTR = Math.round(predictedMTTR * 0.82);
      evidence.push("SRE optimization index indicates operational MTTR is dropping (-18% duration).");
    }

    if (ctx.trends.mttrTrend === "regressing") {
      predictedMTTR = Math.round(predictedMTTR * 1.15);
      evidence.push("Active trend telemetry registers longer incident lifespans (+15% latency multiplier).");
    }

    predictedMTTR = Math.max(50, Math.min(30000, predictedMTTR));
    
    // Risk score scaled from MTTR: 1000ms is standard, > 2500ms is critical
    const riskScore = Math.min(100, Math.round((predictedMTTR / 2500) * 100));
    const confidence = ctx.records.length > 3 ? 0.88 : 0.60;

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "MTTR_EVOLUTION",
      confidence,
      riskScore,
      predictedFailure: "None",
      predictedRecovery: "Rollback and Node Restart Flow",
      predictedMTTR,
      predictedBlastRadius: "Low",
      predictedErrorBudgetConsumption: 0.1,
      affectedSubsystems: [],
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze([
        "Accelerate alert dispatch channels by bypass-caching telemetry logs.",
        "Introduce pre-provisioned cold-standby backup nodes.",
        "Verify auto-healing state machines have immediate priority execution tickets."
      ]),
    };
  }

  private static predictBlastRadiusEvolution(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    let radius: "Minimal" | "Low" | "Medium" | "High" = "Low";
    let riskScore = 30;
    const evidence: string[] = ["Identified default system failure scope profile (Low)."];

    const highestSeen = ctx.insights?.highestBlastRadiusSeen || "Minimal";
    if (highestSeen === "High" || highestSeen === "Medium") {
      radius = highestSeen;
      riskScore = highestSeen === "High" ? 85 : 60;
      evidence.push(`Telemetry scans found elevated historical blast radius records of: ${highestSeen}.`);
    }

    if (ctx.trends.blastRadiusTrend === "regressing") {
      radius = "High";
      riskScore = 85;
      evidence.push("System-wide blast radius analysis detects increased cross-dependency coupling (Regressing).");
    }

    const confidence = ctx.records.length > 0 ? 0.85 : 0.50;

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "BLAST_RADIUS_EVOLUTION",
      confidence,
      riskScore,
      predictedFailure: radius === "High" ? "System-Wide Cascading Event Risk" : "Isolated Component Failure Mode",
      predictedRecovery: "Cellular Outage Isolation Playbook",
      predictedMTTR: 1500,
      predictedBlastRadius: radius,
      predictedErrorBudgetConsumption: radius === "High" ? 45.0 : 15.0,
      affectedSubsystems: [],
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze([
        "Refactor communication links to be purely async message-driven.",
        "Decouple system components via horizontal bulkheads.",
        "Implement graceful degradation modes on premium entry portals."
      ]),
    };
  }

  private static predictSubsystemDegradation(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    let affectedSubsystem = "ExpressServer";
    let riskScore = 20;
    const evidence: string[] = ["Calculated nominal baseline for standard microservice nodes."];

    if (ctx.insights && ctx.insights.mostAffectedSubsystem) {
      const sub = ctx.insights.mostAffectedSubsystem;
      affectedSubsystem = sub.serviceId;
      riskScore = Math.min(95, Math.round(sub.accumulatedImpact + sub.occurrences * 5));
      evidence.push(`Most affected service logged: ${sub.serviceId} (Occurred: ${sub.occurrences} times, Accumulated Impact: ${sub.accumulatedImpact}).`);
    } else {
      // Look for degraded node in topology
      const degraded = ctx.dependencyGraph.nodes.find((n) => n.status !== "HEALTHY");
      if (degraded) {
        affectedSubsystem = degraded.id;
        riskScore = degraded.status === "UNAVAILABLE" ? 90 : 60;
        evidence.push(`Discovered degraded live topology element: ${degraded.id} with status: ${degraded.status}.`);
      }
    }

    const confidence = ctx.records.length > 0 ? 0.90 : 0.60;

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "SUBSYSTEM_DEGRADATION",
      confidence,
      riskScore,
      predictedFailure: `Imminent service performance degradation on: ${affectedSubsystem}`,
      predictedRecovery: "Dynamic Auto-Scale Provisioning Workflow",
      predictedMTTR: 1800,
      predictedBlastRadius: "Medium",
      predictedErrorBudgetConsumption: 18.0,
      affectedSubsystems: [affectedSubsystem],
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze([
        `Configure auto-scaling triggers for target subsystem: ${affectedSubsystem}.`,
        `Partition high frequency reads for ${affectedSubsystem} in remote storage.`,
        "Enforce request dead-letter-queues to prevent backpressure accumulation."
      ]),
    };
  }

  private static predictDependencyInstability(
    id: string,
    timestamp: string,
    correlationId: string,
    ctx: PredictionContextData
  ): PredictionModel {
    let unstableNode = "Firestore";
    let riskScore = 15;
    const evidence: string[] = ["Assessed base system third-party and DB API nodes."];

    if (ctx.insights && ctx.insights.mostUnstableDependency) {
      const dep = ctx.insights.mostUnstableDependency;
      unstableNode = dep.nodeId;
      riskScore = Math.min(98, Math.round(dep.accumulatedImpact + dep.occurrences * 10));
      evidence.push(`Most unstable dependency logged: ${dep.nodeId} (Occurred: ${dep.occurrences} times, Accumulated Impact: ${dep.accumulatedImpact}).`);
    } else {
      // Look for any external gateway or db node with status not HEALTHY
      const targetNode = ctx.dependencyGraph.nodes.find(
        (n) => n.status !== "HEALTHY" && (n.type === "database" || n.type === "external_api")
      );
      if (targetNode) {
        unstableNode = targetNode.id;
        riskScore = targetNode.status === "UNAVAILABLE" ? 95 : 65;
        evidence.push(`Live scanning flagged active instability on dependency: ${targetNode.id}.`);
      }
    }

    const confidence = ctx.records.length > 0 ? 0.90 : 0.55;

    return {
      predictionId: id,
      timestamp,
      correlationId,
      predictionType: "DEPENDENCY_INSTABILITY",
      confidence,
      riskScore,
      predictedFailure: `Dependency link degradation on: ${unstableNode}`,
      predictedRecovery: "Active Circuit Breaker Engagement",
      predictedMTTR: 500,
      predictedBlastRadius: "Low",
      predictedErrorBudgetConsumption: 8.5,
      affectedSubsystems: [unstableNode],
      supportingEvidence: Object.freeze(evidence),
      recommendations: Object.freeze([
        `Enforce a timeout policy not exceeding 1500ms on connection strings to ${unstableNode}.`,
        `Implement a local cache layer for all static and semi-static queries.`,
        `Set up a secondary redundant cluster endpoint for failover targets.`
      ]),
    };
  }
}
