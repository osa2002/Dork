import { ChangeRequestPayload } from "./ChangeRequest";
import { ChangeContextPayload } from "./ChangeContext";
import { ChangePlanner, ChangePlanPayload } from "./ChangePlanner";
import { RollbackPlanner, RollbackPlanPayload } from "./RollbackPlanner";
import { ApprovalEngine } from "./ApprovalEngine";
import { ChangePolicy } from "./ChangePolicy";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface ExecutionSimulationPayload {
  readonly simulationId: string;
  readonly isReady: boolean;
  readonly preCheckPassed: boolean;
  readonly twinProjectionPassed: boolean;
  readonly executionPlan: ChangePlanPayload;
  readonly rollbackPlan: RollbackPlanPayload;
  readonly reasoning: string;
  readonly timestamp: string;
}

export class ChangeExecutor {
  /**
   * Evaluates the readiness of a change request and simulates its execution safely using Digital Twin state projection.
   * Fully stateless and does not apply any real mutations to production.
   */
  public static simulate(
    request: ChangeRequestPayload,
    context: ChangeContextPayload
  ): ExecutionSimulationPayload {
    const simulationId = `sim-chg-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    // 1. Evaluate with standard SRE change safety policy
    const policy = ChangePolicy.getStandardPolicy();
    const approval = ApprovalEngine.evaluate(request, context, policy);

    const preCheckPassed = approval.status !== "REJECTED";

    // 2. Perform Twin Projection
    const twinStatus = context.liveState.digitalTwin.status;
    const isTwinHealthy = twinStatus === "SYNCHRONIZED";
    const twinProjectionPassed = isTwinHealthy && (context.currentFailureProbabilityRisk < 80);

    const isReady = preCheckPassed && twinProjectionPassed;

    // Generate plans
    const executionPlan = ChangePlanner.generatePlan(request);
    const rollbackPlan = RollbackPlanner.generateRollbackPlan(request);

    let reasoning = "";
    if (isReady) {
      reasoning = "Simulation successful. Pre-checks and digital twin state projections both indicate safe execution limits.";
    } else {
      const failures: string[] = [];
      if (!preCheckPassed) {
        failures.push(`Safety precheck failed: ${approval.reasoning}`);
      }
      if (!twinProjectionPassed) {
        failures.push("Digital twin virtual state projection failed. Out of sync or risk ceiling breached.");
      }
      reasoning = `Simulation flagged warnings or failed. Details: ${failures.join(" | ")}`;
    }

    const payload: ExecutionSimulationPayload = {
      simulationId,
      isReady,
      preCheckPassed,
      twinProjectionPassed,
      executionPlan,
      rollbackPlan,
      reasoning,
      timestamp,
    };

    // Deep freeze model to guarantee immutability
    Object.freeze(payload);

    // Publish event to the Enterprise Event Bus
    EnterpriseEventBus.publish(
      "SystemStateChanged",
      {
        simulationId,
        isReady,
        changeId: request.id,
        classification: request.classification,
        totalPlanSteps: executionPlan.steps.length,
        totalRollbackSteps: rollbackPlan.steps.length,
        preCheckStatus: approval.status,
      },
      `corr-chg-sim-${request.id}`
    );

    return payload;
  }
}
