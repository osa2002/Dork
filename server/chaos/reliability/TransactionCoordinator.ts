import { AtomicOperation, OperationExecutionResult } from "./AtomicOperation";
import { TransactionContext } from "./TransactionContext";
import { TransactionPolicy } from "./TransactionPolicy";
import { TransactionValidator, ValidationReport } from "./TransactionValidator";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface TransactionStoreAdapter {
  get<T = any>(path: string): Promise<T>;
  set(path: string, data: any): Promise<void>;
  update(path: string, data: any): Promise<void>;
  delete(path: string): Promise<void>;
}

export class TransactionCoordinator {
  /**
   * Executes a list of atomic operations within the provided context, policy, and storage adapter.
   */
  public static async executeBatch(
    operations: AtomicOperation[],
    context: TransactionContext,
    policy: TransactionPolicy,
    store: TransactionStoreAdapter
  ): Promise<{ success: boolean; results: OperationExecutionResult[]; error?: any }> {
    const results: OperationExecutionResult[] = [];
    const stateMap = new Map<string, any>();

    // 1. Pre-flight Validation
    const preFlightReport = TransactionValidator.validatePreFlight(operations, context, policy);
    if (!preFlightReport.isValid) {
      const firstError = preFlightReport.issues.find((i) => i.severity === "ERROR");
      const err = new Error(firstError?.message || "Pre-flight transaction validation failed");
      (err as any).isFatal = true;
      (err as any).code = firstError?.code || "VALIDATION_FAILED";
      return { success: false, results: [], error: err };
    }

    // 2. Fetch required state for READ and CHECK ops
    for (const op of operations) {
      if (!stateMap.has(op.targetPath)) {
        try {
          const currentVal = await store.get(op.targetPath);
          stateMap.set(op.targetPath, currentVal);
          context.addSnapshot({
            path: op.targetPath,
            beforeData: currentVal,
            capturedAt: new Date().toISOString(),
          });
        } catch (fetchErr: any) {
          // If entity doesn't exist, store null
          stateMap.set(op.targetPath, null);
        }
      }
    }

    // 3. Evaluate Conditions
    const conditionReport = await TransactionValidator.evaluateConditions(operations, stateMap);
    if (!conditionReport.isValid) {
      context.setStatus("ROLLED_BACK");
      const firstError = conditionReport.issues.find((i) => i.severity === "ERROR");
      const err = new Error(firstError?.message || "Transaction condition evaluation failed");
      (err as any).code = firstError?.code || "CONDITION_FAILED";
      return { success: false, results: [], error: err };
    }

    // 4. Apply Operations sequentially
    const executedOpsForRollback: AtomicOperation[] = [];

    try {
      for (const op of operations) {
        const beforeData = stateMap.get(op.targetPath);
        let afterData: any = beforeData;

        switch (op.type) {
          case "READ":
            afterData = beforeData;
            break;
          case "WRITE":
            afterData = op.payload;
            await store.set(op.targetPath, op.payload);
            break;
          case "UPDATE":
            afterData = typeof op.payload === "object" && op.payload !== null && typeof beforeData === "object" && beforeData !== null
              ? { ...beforeData, ...op.payload }
              : op.payload;
            await store.update(op.targetPath, afterData);
            break;
          case "DELETE":
            afterData = null;
            await store.delete(op.targetPath);
            break;
          case "CHECK":
            afterData = beforeData;
            break;
        }

        stateMap.set(op.targetPath, afterData);
        context.markOperationExecuted(op.id);
        executedOpsForRollback.push(op);

        const opResult: OperationExecutionResult = {
          operationId: op.id,
          type: op.type,
          targetPath: op.targetPath,
          success: true,
          beforeData,
          afterData,
          executedAt: new Date().toISOString(),
        };
        op.setResult(opResult);
        results.push(opResult);
      }

      // Publish success telemetry
      try {
        EnterpriseEventBus.publish(
          "SystemStateChanged",
          {
            transactionId: context.transactionId,
            status: "COMMITTED",
            operationsCount: operations.length,
            durationMs: context.durationMs,
          },
          context.correlationId
        );
      } catch (busErr) {
        // Telemetry failure should not crash transaction execution
      }

      return { success: true, results };
    } catch (executionErr: any) {
      // 5. Compensation / Rollback Trigger if needed
      await TransactionCoordinator.rollback(executedOpsForRollback, context, store);

      try {
        EnterpriseEventBus.publish(
          "SystemStateChanged",
          {
            transactionId: context.transactionId,
            status: "ROLLED_BACK",
            error: executionErr?.message || String(executionErr),
            durationMs: context.durationMs,
          },
          context.correlationId
        );
      } catch (busErr) {
        // Telemetry failure ignored
      }

      return { success: false, results, error: executionErr };
    }
  }

  /**
   * Executes compensating actions in reverse order for ops that executed before failure.
   */
  public static async rollback(
    executedOps: AtomicOperation[],
    context: TransactionContext,
    store: TransactionStoreAdapter
  ): Promise<void> {
    context.setStatus("ROLLED_BACK");
    const reversedOps = [...executedOps].reverse();

    for (const op of reversedOps) {
      if (op.compensatingAction) {
        try {
          await op.compensatingAction({ context, store, operation: op });
        } catch (compErr) {
          console.error(`[TransactionCoordinator] Compensating action failed for op ${op.id}:`, compErr);
        }
      } else {
        // Default restore before snapshot if available
        const snapshot = context.snapshots.find((s) => s.path === op.targetPath);
        if (snapshot && (op.type === "WRITE" || op.type === "UPDATE" || op.type === "DELETE")) {
          try {
            if (snapshot.beforeData === null || snapshot.beforeData === undefined) {
              await store.delete(op.targetPath);
            } else {
              await store.set(op.targetPath, snapshot.beforeData);
            }
          } catch (restoreErr) {
            console.error(`[TransactionCoordinator] Default rollback restore failed for ${op.targetPath}:`, restoreErr);
          }
        }
      }
    }
  }
}
