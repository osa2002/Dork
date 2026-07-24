import { ValidationContext } from "./ValidationContext";
import { ValidationResult } from "./ValidationResult";
import { ValidationEngine } from "./ValidationEngine";
import { ValidationHistory, ValidationRunRecord } from "./ValidationHistory";
import { ValidationReporter, ValidationReportOutput } from "./ValidationReporter";
import { ValidationDashboard, ValidationDashboardPayload } from "./ValidationDashboard";

export interface ContinuousValidationOutput {
  validationId: string;
  timestamp: string;
  correlationId: string;
  results: ValidationResult[];
  dashboard: ValidationDashboardPayload;
  report: ValidationReportOutput;
}

export class ContinuousValidationService {
  /**
   * Orchestrates a complete platform validation run on-demand.
   * Fully stateless, cloud-run compatible, zero background timers or loop processes.
   */
  public static async validatePlatform(
    type: "CONTINUOUS" | "MANUAL" = "CONTINUOUS",
    correlationId?: string
  ): Promise<ContinuousValidationOutput> {
    const valId = `val-${Math.random().toString(36).substring(2, 9)}`;
    const corrId = correlationId || `corr-val-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const context: ValidationContext = {
      validationId: valId,
      timestamp,
      validationType: type,
      correlationId: corrId,
    };

    // 1. Run all checks via the Validation Engine
    const results = await ValidationEngine.execute(context);

    // 2. Aggregate dashboard metrics
    const dashboard = ValidationDashboard.getDashboard(results);

    // 3. Compile report outputs (Markdown + JSON)
    const report = ValidationReporter.generateReport(valId, timestamp, results);

    // 4. Save to bounded ValidationHistory queue
    const total = results.length;
    const passedCount = results.filter((r) => r.success).length;
    const failedCount = total - passedCount;
    const successRate = total > 0 ? Number(((passedCount / total) * 100).toFixed(2)) : 100;

    const record: ValidationRunRecord = {
      validationId: valId,
      timestamp,
      validationType: type,
      correlationId: corrId,
      results,
      successRate,
      passedCount,
      failedCount,
    };

    ValidationHistory.add(record);

    return {
      validationId: valId,
      timestamp,
      correlationId: corrId,
      results,
      dashboard,
      report,
    };
  }
}
