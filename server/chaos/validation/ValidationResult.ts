export type ValidationSeverity = "Critical" | "High" | "Medium" | "Low" | "Info";

export interface ValidationResult {
  validationId: string;
  timestamp: string;
  ruleId: string;
  ruleName: string;
  severity: ValidationSeverity;
  component: string;
  success: boolean;
  expected: string;
  actual: string;
  recommendation: string;
  evidence: string[];
}
