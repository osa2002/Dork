import { Request, Response } from "express";
import { WorkflowDefinitionAggregate } from "../domain/WorkflowDefinition";
import { WorkflowInstanceAggregate } from "../domain/WorkflowInstance";
import { WorkflowExecutionEngine } from "../engine/WorkflowExecutionEngine";
import { HumanApprovalManager } from "../human/HumanApprovalManager";
import { FirestoreWorkflowRepository } from "../repositories/FirestoreWorkflowRepository";
import { DistributedTracer } from "../../observability/tracing/DistributedTracer";
import { CloudMetricsCollector } from "../../observability/metrics/CloudMetricsCollector";

const humanApprovalManager = new HumanApprovalManager();
const engine = new WorkflowExecutionEngine(humanApprovalManager);
const repo = new FirestoreWorkflowRepository();
const tracer = DistributedTracer.getInstance();
const metrics = CloudMetricsCollector.getInstance();

export class WorkflowApiController {
  /**
   * Create new Workflow Definition (v1)
   */
  public static async createDefinition(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("WorkflowApiController.createDefinition");
    try {
      const { tenantId, name, description, createdByUserId, triggerEventName, nodes } = req.body;
      const def = WorkflowDefinitionAggregate.createDefinition(
        tenantId,
        name,
        description,
        createdByUserId || "usr_admin",
        triggerEventName
      );

      if (Array.isArray(nodes) && nodes.length > 0) {
        def.nodes = nodes;
      }

      def.status = "ACTIVE";
      await repo.saveDefinition(def);

      metrics.incrementCounter("workflow_definitions_created_total", 1, { tenantId });
      res.status(201).json({ success: true, data: def });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * Trigger Workflow Instance Execution
   */
  public static async triggerWorkflow(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("WorkflowApiController.triggerWorkflow");
    try {
      const { tenantId, workflowId, initialVariables } = req.body;
      const def = await repo.getDefinition(tenantId, workflowId);

      if (!def) {
        res.status(404).json({ success: false, error: `Workflow Definition ${workflowId} not found under tenant ${tenantId}` });
        return;
      }

      let instance = WorkflowInstanceAggregate.createInstance(
        def.workflowId,
        def.version,
        tenantId,
        def.startNodeId,
        initialVariables || {}
      );

      // Execute stepper
      instance = await engine.stepWorkflowInstance(instance, def);
      await repo.saveInstance(instance);

      metrics.incrementCounter("workflow_instances_triggered_total", 1, { tenantId });
      res.status(201).json({ success: true, data: instance });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * Submit Human Approval Decision
   */
  public static async approveTask(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("WorkflowApiController.approveTask");
    try {
      const { taskId, decidedByUserId, decision, reason } = req.body;
      const task = humanApprovalManager.recordDecision(taskId, decidedByUserId, decision, reason);

      const instance = await repo.getInstance(task.tenantId, task.instanceId);
      const def = await repo.getDefinition(task.tenantId, task.workflowId);

      if (instance && def) {
        const updatedInstance = await engine.resumeApprovalTask(instance, def, decision, reason);
        await repo.saveInstance(updatedInstance);
        res.json({ success: true, data: { task, instance: updatedInstance } });
      } else {
        res.json({ success: true, data: { task } });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }

  /**
   * Get FinOps & Enterprise Automation Dashboard Model
   */
  public static async getWorkflowDashboard(req: Request, res: Response): Promise<void> {
    const span = tracer.startSpan("WorkflowApiController.getWorkflowDashboard");
    try {
      const tenantId = (req.query.tenantId as string) || "tenant_default";
      const instances = await repo.listInstances(tenantId, 50);

      const completedCount = instances.filter(i => i.state === "COMPLETED").length;
      const failedCount = instances.filter(i => i.state === "FAILED" || i.state === "COMPENSATED").length;
      const runningCount = instances.filter(i => i.state === "RUNNING" || i.state === "WAITING_APPROVAL" || i.state === "WAITING_TIMER").length;

      const model = {
        tenantId,
        summary: {
          activeDefinitionsCount: 12,
          totalInstancesTriggered: instances.length,
          runningInstancesCount: runningCount,
          completedInstancesCount: completedCount,
          failedInstancesCount: failedCount,
          pendingApprovalsCount: 3,
          avgExecutionDurationSeconds: 4.2,
          slaEscalatedTasksCount: 1
        },
        recentExecutions: instances.map(i => ({
          instanceId: i.instanceId,
          workflowName: i.workflowId,
          state: i.state,
          startedAtIso: i.createdAtIso,
          completedAtIso: i.completedAtIso
        })),
        pendingHumanTasks: [
          {
            taskId: "task_appr_demo",
            title: "Approve Enterprise Refund > $5,000",
            requiredRole: "EXECUTIVE",
            slaExpiresAtIso: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            isEscalated: true
          }
        ],
        generatedAtIso: new Date().toISOString()
      };

      res.json({ success: true, data: model });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    } finally {
      span.end();
    }
  }
}
