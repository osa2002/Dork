export interface HumanApprovalTask {
  taskId: string;
  instanceId: string;
  workflowId: string;
  tenantId: string;
  nodeId: string;
  requiredRole: string;
  title: string;
  summary: string;
  assignedUserId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED";
  slaExpiresAtIso: string;
  isEscalated: boolean;
  decidedByUserId?: string;
  decisionReason?: string;
  createdAtIso: string;
  decidedAtIso?: string;
}

export class HumanApprovalManager {
  private tasks: Map<string, HumanApprovalTask> = new Map();

  public createApprovalTask(
    instanceId: string,
    workflowId: string,
    tenantId: string,
    nodeId: string,
    requiredRole: string = "MANAGER",
    title: string,
    summary: string,
    slaHours: number = 24
  ): HumanApprovalTask {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

    const task: HumanApprovalTask = {
      taskId: `task_appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      instanceId,
      workflowId,
      tenantId,
      nodeId,
      requiredRole,
      title,
      summary,
      status: "PENDING",
      slaExpiresAtIso: expiresAt.toISOString(),
      isEscalated: false,
      createdAtIso: now.toISOString()
    };

    this.tasks.set(task.taskId, task);
    return task;
  }

  public getTask(taskId: string): HumanApprovalTask | undefined {
    return this.tasks.get(taskId);
  }

  public recordDecision(
    taskId: string,
    decidedByUserId: string,
    decision: "APPROVED" | "REJECTED",
    reason?: string
  ): HumanApprovalTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Human Approval Exception: Task ${taskId} not found`);
    }

    if (task.status !== "PENDING" && task.status !== "ESCALATED") {
      throw new Error(`Human Approval Exception: Task ${taskId} is already in final state ${task.status}`);
    }

    task.status = decision;
    task.decidedByUserId = decidedByUserId;
    task.decisionReason = reason;
    task.decidedAtIso = new Date().toISOString();

    return task;
  }

  public checkSlaEscalations(): HumanApprovalTask[] {
    const now = new Date();
    const escalatedTasks: HumanApprovalTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === "PENDING" && !task.isEscalated) {
        if (new Date(task.slaExpiresAtIso) < now) {
          task.isEscalated = true;
          task.status = "ESCALATED";
          task.requiredRole = "EXECUTIVE"; // Escalate required role to EXECUTIVE/FINANCE_ADMIN
          escalatedTasks.push(task);
        }
      }
    }

    return escalatedTasks;
  }
}
