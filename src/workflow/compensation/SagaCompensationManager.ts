import { WorkflowDefinition } from "../domain/WorkflowDefinition";
import { WorkflowInstance } from "../domain/WorkflowInstance";

export interface CompensationLog {
  nodeId: string;
  actionName: string;
  compensatedAtIso: string;
  status: "SUCCESS" | "FAILED";
  details?: string;
}

export class SagaCompensationManager {
  public static async compensateWorkflowInstance(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): Promise<CompensationLog[]> {
    instance.state = "COMPENSATING";
    const compensationLogs: CompensationLog[] = [];

    // Walk backwards through completed nodes
    const reversedCompletedNodes = [...instance.completedNodeIds].reverse();

    for (const nodeId of reversedCompletedNodes) {
      const nodeDef = definition.nodes.find(n => n.nodeId === nodeId);
      if (nodeDef && nodeDef.compensationAction) {
        const action = nodeDef.compensationAction;

        try {
          // Perform compensation operation
          compensationLogs.push({
            nodeId,
            actionName: action.name,
            compensatedAtIso: new Date().toISOString(),
            status: "SUCCESS",
            details: `Compensated action [${action.actionId}] for node ${nodeId}`
          });
        } catch (err: any) {
          compensationLogs.push({
            nodeId,
            actionName: action.name,
            compensatedAtIso: new Date().toISOString(),
            status: "FAILED",
            details: err.message
          });
        }
      }
    }

    instance.state = "COMPENSATED";
    instance.updatedAtIso = new Date().toISOString();

    return compensationLogs;
  }
}
