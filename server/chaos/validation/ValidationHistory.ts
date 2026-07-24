import { ValidationResult } from "./ValidationResult";

export interface ValidationRunRecord {
  validationId: string;
  timestamp: string;
  validationType: "CONTINUOUS" | "MANUAL";
  correlationId: string;
  results: ValidationResult[];
  successRate: number;
  passedCount: number;
  failedCount: number;
}

export class ValidationHistory {
  private static history: ValidationRunRecord[] = [];
  private static readonly MAX_LIMIT = 50;

  /**
   * Adds a validation run record, trimming if it exceeds MAX_LIMIT.
   */
  public static add(record: ValidationRunRecord): void {
    this.history.push(record);
    while (this.history.length > this.MAX_LIMIT) {
      this.history.shift();
    }
  }

  /**
   * Returns all stored records.
   */
  public static getHistory(): ValidationRunRecord[] {
    return [...this.history];
  }

  /**
   * Clears all stored records.
   */
  public static clear(): void {
    this.history = [];
  }
}
