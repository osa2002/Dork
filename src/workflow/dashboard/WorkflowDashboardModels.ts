export interface WorkflowMetricsSummary {
  activeDefinitionsCount: number;
  totalInstancesTriggered: number;
  runningInstancesCount: number;
  completedInstancesCount: number;
  failedInstancesCount: number;
  pendingApprovalsCount: number;
  avgExecutionDurationSeconds: number;
  slaEscalatedTasksCount: number;
}

export interface WorkflowDashboardModel {
  tenantId: string;
  summary: WorkflowMetricsSummary;
  recentExecutions: Array<{
    instanceId: string;
    workflowName: string;
    state: string;
    startedAtIso: string;
    completedAtIso?: string;
  }>;
  pendingHumanTasks: Array<{
    taskId: string;
    title: string;
    requiredRole: string;
    slaExpiresAtIso: string;
    isEscalated: boolean;
  }>;
  generatedAtIso: string;
}
