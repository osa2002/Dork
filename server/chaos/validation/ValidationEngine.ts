import { ValidationContext } from "./ValidationContext";
import { ValidationResult } from "./ValidationResult";
import { ValidationCatalog } from "./ValidationCatalog";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class ValidationEngine {
  /**
   * Executes validation rules against the live state of the platform.
   */
  public static async execute(ctx: ValidationContext): Promise<ValidationResult[]> {
    const rules = ValidationCatalog.getRules();
    const results: ValidationResult[] = [];

    for (const rule of rules) {
      try {
        const result = await rule.validate(ctx);
        results.push(result);
      } catch (e: any) {
        // Fallback result for failed execution
        results.push({
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          component: rule.component,
          success: false,
          expected: "Rule executes without throwing unhandled exceptions",
          actual: `Rule execution failed with error: ${e.message}`,
          recommendation: "Inspect rule implementation details for runtime errors",
          evidence: [e.stack || e.message]
        });
      }
    }

    // Publish event via Enterprise Event Bus
    const passedCount = results.filter(r => r.success).length;
    const failedCount = results.length - passedCount;

    EnterpriseEventBus.publish("SystemStateChanged", {
      validationId: ctx.validationId,
      correlationId: ctx.correlationId,
      passedCount,
      failedCount,
      totalCount: results.length
    }, ctx.correlationId);

    return results;
  }
}
