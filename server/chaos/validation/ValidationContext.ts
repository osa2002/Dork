export interface ValidationContext {
  validationId: string;
  timestamp: string;
  validationType: "CONTINUOUS" | "MANUAL";
  correlationId: string;
}
