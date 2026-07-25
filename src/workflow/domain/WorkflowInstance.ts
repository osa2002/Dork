import { ExecutionState } from "../value-objects/WorkflowValueObjects";

export interface StepExecutionAuditLog {
  stepId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  startedAtIso: string;
  completedAtIso?: string;
  status: "SUCCESS" | "FAILED" | "COMPENSATED" | "WAITING";
  attemptNumber: number;
  inputPayload?: any;
  outputPayload?: any;
  errorMessage?: string;
}

export interface WorkflowInstance {
  instanceId: string;
  workflowId: string;
  workflowVersion: number;
  tenantId: string;
  currentNodeId: string;
  state: ExecutionState;
  contextVariables: Record<string, any>;
  auditTrail: StepExecutionAuditLog[];
  completedNodeIds: string[];
  pendingApprovalTaskId?: string;
  timerExpiresAtIso?: string;
  createdAtIso: string;
  updatedAtIso: string;
  completedAtIso?: string;
  errorMessage?: string;
}

export class WorkflowInstanceAggregate {
  public static createInstance(
    workflowId: string,
    workflowVersion: number,
    tenantId: string,
    startNodeId: string,
    initialVariables: Record<string, any> = {}
  ): WorkflowInstance {
    const now = new Date().toISOString();
    return {
      instanceId: `wfi_${tenantId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workflowId,
      workflowVersion,
      tenantId,
      currentNodeId: startNodeId,
      state: "PENDING",
      contextVariables: { ...initialVariables },
      auditTrail: [],
      completedNodeIds: [],
      createdAtIso: now,
      updatedAtIso: now
    };
  }
}
