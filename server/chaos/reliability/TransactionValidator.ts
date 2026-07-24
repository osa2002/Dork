import { AtomicOperation } from "./AtomicOperation";
import { TransactionContext } from "./TransactionContext";
import { TransactionPolicy } from "./TransactionPolicy";

export interface ValidationIssue {
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
  targetPath?: string;
  operationId?: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
}

export class TransactionValidator {
  /**
   * Pre-flight validation prior to initiating transaction execution.
   */
  public static validatePreFlight(
    operations: AtomicOperation[],
    context: TransactionContext,
    policy: TransactionPolicy
  ): ValidationReport {
    const issues: ValidationIssue[] = [];

    if (!operations || operations.length === 0) {
      issues.push({
        severity: "ERROR",
        code: "NO_OPERATIONS",
        message: "Transaction must contain at least one atomic operation",
      });
    }

    if (policy.requireIdempotencyKey) {
      const missingKeyOps = operations.filter((op) => !op.idempotencyKey);
      if (missingKeyOps.length > 0) {
        issues.push({
          severity: "ERROR",
          code: "MISSING_IDEMPOTENCY_KEY",
          message: `Policy requires idempotency keys on operations. Missing on ${missingKeyOps.length} operation(s).`,
          operationId: missingKeyOps[0].id,
        });
      }
    }

    // Check payload size limit
    let totalPayloadSize = 0;
    const pathsSeen = new Map<string, string[]>(); // targetPath -> operationIds

    for (const op of operations) {
      if (op.payload) {
        try {
          const payloadStr = JSON.stringify(op.payload);
          totalPayloadSize += payloadStr.length;
        } catch (e) {
          issues.push({
            severity: "ERROR",
            code: "UNSERIALIZABLE_PAYLOAD",
            message: `Payload for operation ${op.id} on path ${op.targetPath} cannot be serialized to JSON`,
            operationId: op.id,
            targetPath: op.targetPath,
          });
        }
      }

      // Track duplicate write paths in same transaction
      if (op.type === "WRITE" || op.type === "UPDATE" || op.type === "DELETE") {
        const existing = pathsSeen.get(op.targetPath) || [];
        existing.push(op.id);
        pathsSeen.set(op.targetPath, existing);
      }
    }

    if (totalPayloadSize > policy.maxPayloadSizeBytes) {
      issues.push({
        severity: "ERROR",
        code: "PAYLOAD_TOO_LARGE",
        message: `Total payload size (${totalPayloadSize} bytes) exceeds policy max limit (${policy.maxPayloadSizeBytes} bytes)`,
      });
    }

    // Warn on multiple writes to the same path
    pathsSeen.forEach((opIds, path) => {
      if (opIds.length > 1) {
        issues.push({
          severity: "WARNING",
          code: "MULTIPLE_WRITES_SAME_PATH",
          message: `Multiple mutating operations detected on same path '${path}': [${opIds.join(", ")}]. Ensure order is deterministic.`,
          targetPath: path,
        });
      }
    });

    const hasErrors = issues.some((i) => i.severity === "ERROR");

    return {
      isValid: !hasErrors,
      issues,
    };
  }

  /**
   * Evaluate conditions on atomic operations against fetched state prior to commit.
   */
  public static async evaluateConditions(
    operations: AtomicOperation[],
    currentStateMap: Map<string, any>
  ): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];

    for (const op of operations) {
      if (op.condition) {
        const currentData = currentStateMap.get(op.targetPath);
        try {
          const conditionMet = await op.condition(currentData);
          if (!conditionMet) {
            issues.push({
              severity: "ERROR",
              code: "CONDITION_FAILED",
              message: `Condition check failed for operation ${op.id} on path ${op.targetPath}`,
              operationId: op.id,
              targetPath: op.targetPath,
            });
          }
        } catch (err: any) {
          issues.push({
            severity: "ERROR",
            code: "CONDITION_EVALUATION_ERROR",
            message: `Condition evaluation threw exception: ${err?.message || String(err)}`,
            operationId: op.id,
            targetPath: op.targetPath,
          });
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === "ERROR");
    return {
      isValid: !hasErrors,
      issues,
    };
  }
}
