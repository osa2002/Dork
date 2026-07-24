import { ValidationContext } from "./ValidationContext";
import { ValidationResult } from "./ValidationResult";

export interface ValidationRule {
  id: string;
  name: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  component: string;
  validate(ctx: ValidationContext): Promise<ValidationResult>;
}
