export type WorkflowStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type ExecutionState =
  | "PENDING"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "WAITING_TIMER"
  | "COMPLETED"
  | "FAILED"
  | "COMPENSATING"
  | "COMPENSATED";

export type NodeType =
  | "START_EVENT"
  | "SERVICE_TASK"
  | "DECISION_GATEWAY"
  | "HUMAN_APPROVAL"
  | "DELAY_TIMER"
  | "WEBHOOK_CALL"
  | "END_EVENT";

export interface RetryPolicy {
  maxAttempts: number;
  initialIntervalMs: number;
  backoffMultiplier: number; // e.g. 2.0
}

export interface CompensationAction {
  actionId: string;
  name: string;
  endpointUrl?: string;
  payloadTemplate?: Record<string, any>;
}

export interface NodeTransition {
  transitionId: string;
  targetNodeId: string;
  conditionExpression?: string; // Rule expression evaluated by Rule Engine, e.g. "amountCents > 10000"
  isDefault?: boolean;
}

export interface WorkflowNode {
  nodeId: string;
  name: string;
  type: NodeType;
  transitions: NodeTransition[];
  retryPolicy?: RetryPolicy;
  compensationAction?: CompensationAction;
  config?: {
    webhookUrl?: string;
    webhookMethod?: "POST" | "PUT" | "GET";
    approvalRoleRequired?: "MANAGER" | "EXECUTIVE" | "FINANCE_ADMIN";
    approvalSlaHours?: number;
    delaySeconds?: number;
    decisionRuleKey?: string;
    [key: string]: any;
  };
}
