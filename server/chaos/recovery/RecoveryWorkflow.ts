import { RecoveryContext } from "./RecoveryContext";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { ChaosState } from "../ChaosState";
import { ChaosOrchestrator } from "../orchestrator/ChaosOrchestrator";
import { IncidentService } from "../../../src/services/IncidentService";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface IRecoveryWorkflow {
  name: string;
  description: string;
  execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void>;
  rollback?(context: RecoveryContext): Promise<void>;
}

/**
 * Rollback Workflow:
 * Deactivates all active chaos experiments, and triggers individual rollback/cleanup actions on active experiments.
 */
export class RollbackWorkflow implements IRecoveryWorkflow {
  public readonly name = "Rollback Workflow";
  public readonly description = "Abruptly stops active chaos injections, triggering automated fallback mechanics.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Rollback Workflow...");
    context.addTimelineEvent("ROLLBACK_INIT", "Initiating global chaos rollback.");

    // Disable Chaos state globally
    ChaosState.setEnabled(false);
    context.log("Chaos state disabled globally.");

    const activeScenarios = ChaosState.getActiveScenarios();
    context.log(`Active scenarios detected for rollback: [${activeScenarios.join(", ")}]`);

    const registered = ChaosOrchestrator.getRegisteredExperiments();
    let rollbacksAttempted = 0;
    let rollbacksSucceeded = 0;

    for (const name of activeScenarios) {
      const experiment = registered.find((exp) => exp.name === name);
      if (experiment) {
        rollbacksAttempted++;
        context.log(`Attempting automated rollback for experiment: ${name}`);
        try {
          await experiment.rollback();
          await experiment.cleanup();
          ChaosState.deactivateScenario(name);
          rollbacksSucceeded++;
          context.log(`Successfully rolled back and cleaned up: ${name}`);
        } catch (err: any) {
          context.log(`ERROR: Failed to roll back experiment ${name}: ${err.message}`);
          throw err;
        }
      } else {
        context.log(`WARN: Active scenario '${name}' has no registered experiment instance.`);
        ChaosState.deactivateScenario(name);
      }
    }

    ChaosState.clearActiveScenarios();
    context.addTimelineEvent(
      "ROLLBACK_COMPLETE",
      `Rollback execution finished. Attempted: ${rollbacksAttempted}, Succeeded: ${rollbacksSucceeded}.`
    );
  }
}

/**
 * Pause Experiments Workflow:
 * Pauses all future chaos injections by turning off the global enablement flag.
 */
export class PauseExperimentsWorkflow implements IRecoveryWorkflow {
  public readonly name = "Pause Experiments";
  public readonly description = "Disables global chaos experimentation flags immediately.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Pause Experiments Workflow...");
    context.addTimelineEvent("PAUSE_INIT", "Suspending global chaos experimentation.");

    ChaosState.setEnabled(false);
    context.log("Chaos state disabled globally.");

    context.addTimelineEvent("PAUSE_COMPLETE", "Chaos experiments successfully paused.");
  }
}

/**
 * Reduce Risk Workflow:
 * Safely scales back experiment latency overrides and probability parameters to minimal levels.
 */
export class ReduceRiskWorkflow implements IRecoveryWorkflow {
  public readonly name = "Reduce Risk";
  public readonly description = "Tapers down probability and latency injectors to minimal hazard levels.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Reduce Risk Workflow...");
    context.addTimelineEvent("REDUCE_RISK_INIT", "Throttling down chaos injection risk configurations.");

    // Scale down probability to 1% or 0%
    const currentProb = ChaosState.getProbability();
    const currentLat = ChaosState.getLatency();

    ChaosState.setProbability(0.01);
    ChaosState.setLatency(0);

    context.log(`Scaled back probability: ${currentProb} -> 0.01, latency: ${currentLat}ms -> 0ms`);
    context.addTimelineEvent("REDUCE_RISK_COMPLETE", "Chaos blast factors successfully mitigated.");
  }
}

/**
 * Open Incident Workflow:
 * Automates SRE alerting and inserts a high-priority incident into the incident service tracking database.
 */
export class OpenIncidentWorkflow implements IRecoveryWorkflow {
  public readonly name = "Open Incident";
  public readonly description = "Funnels platform health degradation metrics into formal incident tickets.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Open Incident Workflow...");
    context.addTimelineEvent("INCIDENT_INIT", "Spawning platform health incident.");

    const incident = IncidentService.createIncident({
      title: `Autonomous SRE Recovery Alert: ${decision.reasoning.substring(0, 50)}...`,
      description: `Autonomous Resilience Engine triggered due to platform status: ${decision.context.health.status}. Reasoning: ${decision.reasoning}\n\nEvidence:\n${decision.evidence.join("\n")}`,
      severity: decision.context.health.status === "UNAVAILABLE" ? "CRITICAL" : "HIGH",
      affectedServices: decision.context.health.activeScenarios && decision.context.health.activeScenarios.length > 0
        ? decision.context.health.activeScenarios
        : ["ExpressServer"],
    });

    context.log(`Incident ticket ${incident.id} created successfully.`);
    context.addTimelineEvent("INCIDENT_COMPLETE", `Incident spawned with ID: ${incident.id}`);
  }
}

/**
 * Escalate Workflow:
 * Escalates existing active incidents by logging high-urgency timelines and firing alert notifications.
 */
export class EscalateWorkflow implements IRecoveryWorkflow {
  public readonly name = "Escalate";
  public readonly description = "Escalates unresolved active incidents to SRE paging triggers.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Escalate Workflow...");
    context.addTimelineEvent("ESCALATE_INIT", "Running automated incident escalation protocols.");

    const activeIncidents = IncidentService.getIncidents().filter((inc) => inc.status !== "RESOLVED");
    if (activeIncidents.length === 0) {
      context.log("No active incidents found to escalate. Creating a new escalation ticket instead.");
      IncidentService.createIncident({
        title: "CRITICAL SRE Escalation - No base incident found",
        description: `Autonomous recovery escalated due to critical confidence rules. Reasoning: ${decision.reasoning}`,
        severity: "CRITICAL",
        affectedServices: ["SRE Core"],
      });
    } else {
      for (const incident of activeIncidents) {
        IncidentService.addTimelineEvent(
          incident.id,
          `CRITICAL ESCALATION: Autonomous Recovery Engine escalated this ticket. Immediate operator intervention required.`,
          "Autonomous SRE Recovery Engine"
        );
        context.log(`Escalated active incident: ${incident.id}`);
      }
    }

    EnterpriseEventBus.publish("AlertTriggered", {
      alertId: `alt-escalate-${Math.random().toString(36).substring(2, 7)}`,
      metric: "sre_escalation_triggers",
      threshold: 1,
      actualValue: 1,
      severity: "CRITICAL",
    }, context.correlationId);

    context.addTimelineEvent("ESCALATE_COMPLETE", "Pagers and SRE channels escalated successfully.");
  }
}

/**
 * Request Manual Approval Workflow:
 * Locks operations down in an audited queue awaiting SRE operator confirmation.
 */
export class RequestManualApprovalWorkflow implements IRecoveryWorkflow {
  public readonly name = "Request Manual Approval";
  public readonly description = "Pockets the recovery state in a safety queue awaiting authorized human unlock.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Request Manual Approval Workflow...");
    context.addTimelineEvent("APPROVAL_PENDING", "Enqueuing manual approval lock on platform.");

    EnterpriseEventBus.publish("SystemStateChanged", {
      state: "AWAITING_SRE_APPROVAL",
      reason: decision.reasoning,
      decisionId: decision.id,
    }, context.correlationId);

    context.addTimelineEvent("APPROVAL_ENQUEUED", "Approval workflow successfully registered in audit trail.");
  }
}

/**
 * Resume Operations Workflow:
 * Enables the global chaos flag when the environment has verified health and stability.
 */
export class ResumeOperationsWorkflow implements IRecoveryWorkflow {
  public readonly name = "Resume Operations";
  public readonly description = "Enables standard chaos testing scenarios after platform stability checks out.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing Resume Operations Workflow...");
    context.addTimelineEvent("RESUME_INIT", "Restoring standard chaos experimentation.");

    ChaosState.setEnabled(true);
    context.log("Chaos state re-enabled globally.");

    context.addTimelineEvent("RESUME_COMPLETE", "Standard operations restored.");
  }
}

/**
 * No Action Workflow:
 * Log advisory decisions with zero environment impact.
 */
export class NoActionWorkflow implements IRecoveryWorkflow {
  public readonly name = "No Action";
  public readonly description = "Logs advisory decisions with zero production touch.";

  public async execute(context: RecoveryContext, decision: AutonomousDecision): Promise<void> {
    context.log("Executing No Action Workflow (Stateless Advisor Mode)...");
    context.addTimelineEvent("NO_ACTION_EXECUTED", "Advisory analysis complete. Operational states remained untouched.");
  }
}
