import { WorkflowDefinition } from "../domain/WorkflowDefinition";
import { StepExecutionAuditLog, WorkflowInstance } from "../domain/WorkflowInstance";
import { WorkflowRuleEngine } from "../rules/WorkflowRuleEngine";
import { HumanApprovalManager } from "../human/HumanApprovalManager";
import { WebhookActionExecutor } from "../actions/WebhookActionExecutor";
import { SagaCompensationManager } from "../compensation/SagaCompensationManager";
import { DistributedTracer } from "../../observability/tracing/DistributedTracer";
import { CloudMetricsCollector } from "../../observability/metrics/CloudMetricsCollector";

const tracer = DistributedTracer.getInstance();
const metrics = CloudMetricsCollector.getInstance();

export class WorkflowExecutionEngine {
  constructor(private humanApprovalManager: HumanApprovalManager) {}

  public async stepWorkflowInstance(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): Promise<WorkflowInstance> {
    const span = tracer.startSpan("WorkflowExecutionEngine.stepWorkflowInstance");

    try {
      if (instance.state === "COMPLETED" || instance.state === "FAILED" || instance.state === "COMPENSATED") {
        return instance;
      }

      instance.state = "RUNNING";
      instance.updatedAtIso = new Date().toISOString();

      let currentNode = definition.nodes.find(n => n.nodeId === instance.currentNodeId);
      if (!currentNode) {
        instance.state = "FAILED";
        instance.errorMessage = `Workflow Execution Exception: Node ${instance.currentNodeId} not found in definition`;
        await SagaCompensationManager.compensateWorkflowInstance(instance, definition);
        return instance;
      }

      // Loop through synchronous node execution until waiting state or terminal state is reached
      while (currentNode) {
        const auditLog: StepExecutionAuditLog = {
          stepId: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          nodeId: currentNode.nodeId,
          nodeName: currentNode.name,
          nodeType: currentNode.type,
          startedAtIso: new Date().toISOString(),
          status: "SUCCESS",
          attemptNumber: 1
        };

        // 1. Process Node Execution based on Type
        if (currentNode.type === "START_EVENT") {
          // Pass-through
          instance.completedNodeIds.push(currentNode.nodeId);
        } else if (currentNode.type === "SERVICE_TASK") {
          // Execute internal service task logic
          instance.contextVariables[`${currentNode.nodeId}_result`] = { executed: true, timestamp: new Date().toISOString() };
          instance.completedNodeIds.push(currentNode.nodeId);
        } else if (currentNode.type === "WEBHOOK_CALL") {
          const webhookUrl = currentNode.config?.webhookUrl || "https://api.example.com/webhook";
          const res = await WebhookActionExecutor.executeWebhook(webhookUrl, "POST", instance.contextVariables);
          instance.contextVariables[`${currentNode.nodeId}_webhookResponse`] = res;
          instance.completedNodeIds.push(currentNode.nodeId);
        } else if (currentNode.type === "HUMAN_APPROVAL") {
          const task = this.humanApprovalManager.createApprovalTask(
            instance.instanceId,
            instance.workflowId,
            instance.tenantId,
            currentNode.nodeId,
            currentNode.config?.approvalRoleRequired || "MANAGER",
            `Approval Required: ${currentNode.name}`,
            `Human approval task required for workflow instance ${instance.instanceId}`,
            currentNode.config?.approvalSlaHours || 24
          );

          instance.state = "WAITING_APPROVAL";
          instance.pendingApprovalTaskId = task.taskId;
          auditLog.status = "WAITING";
          auditLog.outputPayload = { pendingTaskId: task.taskId };
          instance.auditTrail.push(auditLog);

          metrics.incrementCounter("workflow_human_approvals_created_total", 1, { tenantId: instance.tenantId });
          return instance; // Pause execution until approval decision
        } else if (currentNode.type === "DELAY_TIMER") {
          const delaySec = currentNode.config?.delaySeconds || 60;
          const expiresAt = new Date(Date.now() + delaySec * 1000).toISOString();

          instance.state = "WAITING_TIMER";
          instance.timerExpiresAtIso = expiresAt;
          auditLog.status = "WAITING";
          auditLog.outputPayload = { timerExpiresAtIso: expiresAt };
          instance.auditTrail.push(auditLog);

          metrics.incrementCounter("workflow_timers_scheduled_total", 1, { tenantId: instance.tenantId });
          return instance; // Pause execution until timer fires
        } else if (currentNode.type === "END_EVENT") {
          instance.completedNodeIds.push(currentNode.nodeId);
          instance.state = "COMPLETED";
          instance.completedAtIso = new Date().toISOString();
          auditLog.completedAtIso = new Date().toISOString();
          instance.auditTrail.push(auditLog);

          metrics.incrementCounter("workflow_instances_completed_total", 1, { tenantId: instance.tenantId });
          return instance;
        }

        auditLog.completedAtIso = new Date().toISOString();
        instance.auditTrail.push(auditLog);

        // 2. Select Next Transition
        const nextNodeId = this.selectNextNodeId(currentNode, instance.contextVariables);
        if (!nextNodeId) {
          // Terminal if no transition target
          instance.state = "COMPLETED";
          instance.completedAtIso = new Date().toISOString();
          return instance;
        }

        currentNode = definition.nodes.find(n => n.nodeId === nextNodeId);
        if (currentNode) {
          instance.currentNodeId = currentNode.nodeId;
        }
      }

      return instance;
    } catch (err: any) {
      instance.state = "FAILED";
      instance.errorMessage = err.message;
      await SagaCompensationManager.compensateWorkflowInstance(instance, definition);
      metrics.incrementCounter("workflow_instances_failed_total", 1, { tenantId: instance.tenantId });
      return instance;
    } finally {
      span.end();
    }
  }

  public async resumeApprovalTask(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
    decision: "APPROVED" | "REJECTED",
    reason?: string
  ): Promise<WorkflowInstance> {
    if (instance.state !== "WAITING_APPROVAL") {
      throw new Error(`Workflow Execution Exception: Instance is not waiting for approval`);
    }

    instance.contextVariables.lastApprovalDecision = decision;
    instance.contextVariables.lastApprovalReason = reason;

    if (decision === "REJECTED") {
      instance.state = "FAILED";
      instance.errorMessage = `Human Approval Rejected: ${reason || "No reason provided"}`;
      await SagaCompensationManager.compensateWorkflowInstance(instance, definition);
      return instance;
    }

    // Approved: find human approval node and transition to next
    const currentNode = definition.nodes.find(n => n.nodeId === instance.currentNodeId);
    if (!currentNode) {
      instance.state = "FAILED";
      return instance;
    }

    instance.completedNodeIds.push(currentNode.nodeId);
    instance.pendingApprovalTaskId = undefined;

    const nextNodeId = this.selectNextNodeId(currentNode, instance.contextVariables);
    if (nextNodeId) {
      instance.currentNodeId = nextNodeId;
      return this.stepWorkflowInstance(instance, definition);
    } else {
      instance.state = "COMPLETED";
      instance.completedAtIso = new Date().toISOString();
      return instance;
    }
  }

  private selectNextNodeId(currentNode: any, context: Record<string, any>): string | null {
    if (!currentNode.transitions || currentNode.transitions.length === 0) return null;

    for (const trans of currentNode.transitions) {
      if (trans.conditionExpression) {
        const isMatch = WorkflowRuleEngine.evaluateExpression(trans.conditionExpression, context);
        if (isMatch) return trans.targetNodeId;
      } else {
        // Fallback default or unconditioned transition
        return trans.targetNodeId;
      }
    }

    const defaultTrans = currentNode.transitions.find((t: any) => t.isDefault);
    return defaultTrans ? defaultTrans.targetNodeId : currentNode.transitions[0]?.targetNodeId || null;
  }
}
