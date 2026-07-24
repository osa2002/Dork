import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryResult } from "../recovery/RecoveryResult";
import { KnowledgeRecord } from "./KnowledgeRecord";
import { KnowledgeRepository } from "./KnowledgeRepository";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { ChaosHealthContributor, ChaosHealthDetails } from "../intelligence/ChaosHealthContributor";
import { SLOService, SLOMetrics } from "../../../src/services/SLOService";
import { EnterpriseScoreEngine, EnterpriseScores } from "../governance/EnterpriseScoreEngine";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";

export interface CompletedExecutionInput {
  experimentId: string;
  experimentName: string;
  status?: "SUCCESS" | "FAILED" | "DEGRADED" | "SKIPPED" | "PENDING_APPROVAL";
  decision?: AutonomousDecision;
  recovery?: RecoveryResult;
  correlationId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class KnowledgeEngine {
  /**
   * Safe operational execution entrypoint. Receives completed execution context,
   * normalizes fields, generates immutable records, updates repository & search indexes,
   * and dispatches a 'KnowledgeCreated' event.
   */
  public static receiveCompletedExecution(input: CompletedExecutionInput): KnowledgeRecord {
    const record = this.normalize(input);

    // Save in the bounded-capacity in-memory repository
    KnowledgeRepository.add(record);

    // Publish state change to the Enterprise Event Bus
    EnterpriseEventBus.publish("KnowledgeCreated", record, record.correlationId);

    return record;
  }

  /**
   * Normalizes incoming execution context, applying default fallbacks to guarantee robust validation.
   */
  private static normalize(input: CompletedExecutionInput): KnowledgeRecord {
    const id = `knw-${Math.random().toString(36).substring(2, 15)}`;
    const timestamp = new Date().toISOString();

    // 1. Resolve Correlation Identifier
    const correlationId =
      input.correlationId ||
      input.recovery?.decisionId ||
      input.decision?.id ||
      `corr-knw-${Math.random().toString(36).substring(2, 9)}`;

    // 2. Resolve Health & Impact Heuristics
    const health: ChaosHealthDetails =
      input.decision?.context?.health ||
      ChaosHealthContributor.getHealthStatus();
    
    const impact = health.impactScore ?? 0;

    // 3. Classify Blast Radius based on Impact Score thresholds
    let blastRadius: "Minimal" | "Low" | "Medium" | "High" = "Minimal";
    if (impact >= 75) {
      blastRadius = "High";
    } else if (impact >= 40) {
      blastRadius = "Medium";
    } else if (impact >= 10) {
      blastRadius = "Low";
    }

    // 4. Resolve SLO Report Metrics
    const SLO: SLOMetrics =
      input.decision?.context?.standardSlo ||
      SLOService.getSLOSummary();

    // 5. Calculate MTTR (Mean Time to Recovery) performance
    const MTTR =
      input.decision?.context?.slo?.meanTimeToRecoveryMs ||
      input.recovery?.durationMs ||
      0;

    // 6. Map Recovery Results to Standard Workflows and Rollbacks
    const workflow =
      input.recovery?.workflowName ||
      (input.decision?.decision ? this.mapDecisionToWorkflow(input.decision.decision) : "No Action");

    const decision = input.decision?.decision || "NO_ACTION";

    const rollbackOccurred =
      !!input.recovery &&
      (input.recovery.status === "ROLLED_BACK" || (input.recovery.rollbackDurationMs ?? 0) > 0);

    const rollbackSuccess =
      !!input.recovery &&
      (input.recovery.status === "ROLLED_BACK" || input.recovery.status === "SUCCESS");

    const rollback = {
      occurred: rollbackOccurred,
      durationMs: input.recovery?.rollbackDurationMs || 0,
      success: rollbackSuccess,
    };

    // 7. Extract Associated Incident Identifiers
    const incidentId =
      input.decision?.context?.incidents?.[0]?.id ||
      this.extractIncidentIdFromRecovery(input.recovery) ||
      null;

    // 8. Capture Scorecard and Dependency Graph snapshots
    const enterpriseScore: EnterpriseScores =
      input.decision?.context?.enterpriseScores ||
      EnterpriseScoreEngine.calculateScores();

    const dependencyGraphSnapshot =
      input.decision?.context?.dependencyGraph ||
      RuntimeDependencyGraph.getGraph();

    // 9. Determine Status Outcome
    let status: "SUCCESS" | "FAILED" | "DEGRADED" | "SKIPPED" | "PENDING_APPROVAL" = "SUCCESS";
    if (input.status) {
      status = input.status;
    } else if (input.recovery) {
      if (input.recovery.status === "SUCCESS") status = "SUCCESS";
      else if (input.recovery.status === "ROLLED_BACK") status = "DEGRADED";
      else if (input.recovery.status === "FAILED") status = "FAILED";
      else if (input.recovery.status === "SKIPPED") status = "SKIPPED";
      else if (input.recovery.status === "PENDING_APPROVAL") status = "PENDING_APPROVAL";
    } else if (health.status === "UNAVAILABLE" || health.status === "PARTIAL_OUTAGE") {
      status = "FAILED";
    } else if (health.status === "DEGRADED") {
      status = "DEGRADED";
    }

    // 10. Generate Tags list
    const tagsSet = new Set<string>();
    if (input.tags) {
      input.tags.forEach((t) => tagsSet.add(t));
    }
    // Auto-generate tags from context indicators
    tagsSet.add(input.experimentId);
    tagsSet.add(blastRadius.toLowerCase());
    tagsSet.add(status.toLowerCase());
    if (rollback.occurred) {
      tagsSet.add("rollback");
    }
    if (incidentId) {
      tagsSet.add("incident-linked");
    }
    if (impact > 50) {
      tagsSet.add("high-impact");
    }

    const tags = Array.from(tagsSet);
    const metadata = input.metadata || {};

    return {
      id,
      timestamp,
      experimentId: input.experimentId,
      experimentName: input.experimentName,
      workflow,
      decision,
      recovery: input.recovery || null,
      health,
      impact,
      blastRadius,
      SLO,
      MTTR,
      rollback,
      incidentId,
      enterpriseScore,
      dependencyGraphSnapshot,
      correlationId,
      status,
      tags,
      metadata,
    };
  }

  /**
   * Fallback mapper converting autonomous decisions to standard SRE recovery workflow names.
   */
  private static mapDecisionToWorkflow(decision: string): string {
    switch (decision) {
      case "ROLLBACK":
        return "Rollback Workflow";
      case "PAUSE_EXPERIMENTS":
        return "Pause Experiments";
      case "REDUCE_RISK":
        return "Reduce Risk";
      case "OPEN_INCIDENT":
        return "Open Incident";
      case "ESCALATE":
        return "Escalate";
      case "REQUEST_APPROVAL":
        return "Request Manual Approval";
      case "RESUME_OPERATIONS":
      case "RUN_EXPERIMENT":
        return "Resume Operations";
      case "NO_ACTION":
      case "MONITOR":
      default:
        return "No Action";
    }
  }

  /**
   * Sifts through SRE recovery evidence and timelines to extract incident ticket IDs.
   */
  private static extractIncidentIdFromRecovery(recovery?: RecoveryResult): string | null {
    if (!recovery) return null;
    
    // Look in evidence strings (e.g. "Incident spawned with ID: inc-...")
    if (recovery.evidence) {
      for (const ev of recovery.evidence) {
        const match = ev.match(/inc-[a-zA-Z0-9]+/i);
        if (match) return match[0];
      }
    }

    // Look in logs/timeline messages
    if (recovery.timeline) {
      for (const event of recovery.timeline) {
        const match = event.message.match(/inc-[a-zA-Z0-9]+/i);
        if (match) return match[0];
      }
    }

    return null;
  }
}
