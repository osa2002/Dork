import { ControlPlaneContext } from "./ControlPlaneContext";

export interface ExecutionTask {
  id: string;
  engineId: string;
  name: string;
  action: (ctx: ControlPlaneContext) => Promise<any>;
  condition?: (ctx: ControlPlaneContext) => boolean | Promise<boolean>;
  priority?: number; // Higher number executes first
  dependencies?: string[]; // Array of task IDs this task depends on
}

export interface TaskExecutionResult {
  taskId: string;
  engineId: string;
  name: string;
  success: boolean;
  durationMs: number;
  output?: any;
  error?: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
}

export interface ExecutionSessionReport {
  executionId: string;
  timestamp: string;
  mode: "SEQUENTIAL" | "PARALLEL" | "CONDITIONAL" | "DEPENDENCY_AWARE";
  success: boolean;
  tasks: TaskExecutionResult[];
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  totalDurationMs: number;
}

export class ExecutionCoordinator {
  /**
   * Orchestrates a list of ExecutionTasks under a specified execution mode and context.
   */
  public static async coordinate(
    tasks: ExecutionTask[],
    ctx: ControlPlaneContext,
    options: {
      failFast?: boolean;
      rollbackOnFailure?: boolean;
    } = { failFast: true, rollbackOnFailure: false }
  ): Promise<ExecutionSessionReport> {
    const startTime = Date.now();
    const executionId = `exec-cp-${Math.random().toString(36).substring(2, 9)}`;
    const results: TaskExecutionResult[] = [];

    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 1. Resolve execution ordering
    let orderedTasks = [...tasks];

    if (ctx.executionMode === "DEPENDENCY_AWARE") {
      orderedTasks = this.topologicalSortTasks(tasks);
    } else {
      // Sort primarily by priority (descending, defaults to 0)
      orderedTasks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    const failedTaskIds = new Set<string>();
    const completedTaskIds = new Set<string>();

    const executeTaskInternal = async (task: ExecutionTask): Promise<TaskExecutionResult> => {
      const taskStart = Date.now();

      // Check if task dependencies failed (for DEPENDENCY_AWARE)
      if (ctx.executionMode === "DEPENDENCY_AWARE" && task.dependencies) {
        const hasFailedDep = task.dependencies.some((depId) => failedTaskIds.has(depId));
        if (hasFailedDep) {
          skippedCount++;
          return {
            taskId: task.id,
            engineId: task.engineId,
            name: task.name,
            success: false,
            durationMs: 0,
            status: "SKIPPED",
            error: `Dependency failed`
          };
        }
      }

      // Check conditional gate
      if (task.condition) {
        try {
          const proceed = await task.condition(ctx);
          if (!proceed) {
            skippedCount++;
            return {
              taskId: task.id,
              engineId: task.engineId,
              name: task.name,
              success: true,
              durationMs: Date.now() - taskStart,
              status: "SKIPPED",
              output: "Condition evaluated to false"
            };
          }
        } catch (condErr: any) {
          failedCount++;
          failedTaskIds.add(task.id);
          return {
            taskId: task.id,
            engineId: task.engineId,
            name: task.name,
            success: false,
            durationMs: Date.now() - taskStart,
            status: "FAILED",
            error: `Condition evaluation crashed: ${condErr.message}`
          };
        }
      }

      // Execute action
      try {
        const output = await task.action(ctx);
        passedCount++;
        completedTaskIds.add(task.id);
        return {
          taskId: task.id,
          engineId: task.engineId,
          name: task.name,
          success: true,
          durationMs: Date.now() - taskStart,
          status: "PASSED",
          output
        };
      } catch (execErr: any) {
        failedCount++;
        failedTaskIds.add(task.id);
        return {
          taskId: task.id,
          engineId: task.engineId,
          name: task.name,
          success: false,
          durationMs: Date.now() - taskStart,
          status: "FAILED",
          error: execErr.message
        };
      }
    };

    // 2. Execute based on mode
    if (ctx.executionMode === "PARALLEL") {
      // Execute all concurrently
      const promises = orderedTasks.map((t) => executeTaskInternal(t));
      const resolved = await Promise.all(promises);
      results.push(...resolved);
    } else {
      // Sequential, Conditional, or Dependency-aware Execution
      for (const task of orderedTasks) {
        if (options.failFast && failedCount > 0) {
          // Skip remaining due to preceding failures
          skippedCount++;
          results.push({
            taskId: task.id,
            engineId: task.engineId,
            name: task.name,
            success: false,
            durationMs: 0,
            status: "SKIPPED",
            error: "Aborted due to failFast policy constraint"
          });
          continue;
        }

        const res = await executeTaskInternal(task);
        results.push(res);
      }
    }

    const overallSuccess = failedCount === 0;

    return {
      executionId,
      timestamp: new Date().toISOString(),
      mode: ctx.executionMode,
      success: overallSuccess,
      tasks: results,
      passedCount,
      failedCount,
      skippedCount,
      totalDurationMs: Date.now() - startTime
    };
  }

  /**
   * Sorts tasks topologically based on their dependencies.
   */
  private static topologicalSortTasks(tasks: ExecutionTask[]): ExecutionTask[] {
    const taskMap = new Map<string, ExecutionTask>();
    const resolvedOrder: ExecutionTask[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    for (const t of tasks) {
      taskMap.set(t.id, t);
    }

    const visit = (taskId: string) => {
      if (temp.has(taskId)) {
        // Cycle in task-level dependencies! Break out to avoid infinite loop
        return;
      }
      if (!visited.has(taskId)) {
        temp.add(taskId);
        const task = taskMap.get(taskId);
        if (task && task.dependencies) {
          for (const depId of task.dependencies) {
            visit(depId);
          }
        }
        temp.delete(taskId);
        visited.add(taskId);
        if (task) {
          resolvedOrder.push(task);
        }
      }
    };

    // Prioritize visiting tasks with higher priority first
    const sortedTasks = [...tasks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const t of sortedTasks) {
      if (!visited.has(t.id)) {
        visit(t.id);
      }
    }

    return resolvedOrder;
  }
}
