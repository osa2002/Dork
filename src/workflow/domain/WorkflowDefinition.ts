import { WorkflowNode, WorkflowStatus } from "../value-objects/WorkflowValueObjects";

export interface WorkflowDefinition {
  workflowId: string;
  tenantId: string;
  name: string;
  description: string;
  version: number; // e.g. 1, 2, 3
  status: WorkflowStatus;
  triggerEventName?: string; // e.g. "billing.payment_failed" or "refund.requested"
  startNodeId: string;
  nodes: WorkflowNode[];
  createdAtIso: string;
  updatedAtIso: string;
  createdByUserId: string;
}

export class WorkflowDefinitionAggregate {
  public static createDefinition(
    tenantId: string,
    name: string,
    description: string,
    createdByUserId: string,
    triggerEventName?: string
  ): WorkflowDefinition {
    const startNodeId = "node_start";
    const endNodeId = "node_end";

    const defaultNodes: WorkflowNode[] = [
      {
        nodeId: startNodeId,
        name: "Start Event",
        type: "START_EVENT",
        transitions: [{ transitionId: "trans_1", targetNodeId: endNodeId }]
      },
      {
        nodeId: endNodeId,
        name: "End Event",
        type: "END_EVENT",
        transitions: []
      }
    ];

    return {
      workflowId: `wf_${tenantId}_${Date.now()}`,
      tenantId,
      name,
      description,
      version: 1,
      status: "DRAFT",
      triggerEventName,
      startNodeId,
      nodes: defaultNodes,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
      createdByUserId
    };
  }

  public static addNode(definition: WorkflowDefinition, node: WorkflowNode): void {
    definition.nodes.push(node);
    definition.updatedAtIso = new Date().toISOString();
  }

  public static createNextVersion(existing: WorkflowDefinition): WorkflowDefinition {
    return {
      ...existing,
      version: existing.version + 1,
      status: "DRAFT",
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString()
    };
  }
}
