import { RecoveryResult } from "./RecoveryResult";

export class RecoveryHistory {
  private static results: RecoveryResult[] = [];
  private static maxHistorySize = 50;

  /**
   * Appends a recovery result into history, enforcing bounded memory limits.
   */
  public static addResult(result: RecoveryResult) {
    this.results.unshift(result);
    
    // Trim history to prevent memory leaks in continuous environments
    if (this.results.length > this.maxHistorySize) {
      this.results.pop();
    }
  }

  /**
   * Retrieves the current list of logged recovery outcomes.
   */
  public static getHistory(): RecoveryResult[] {
    return [...this.results];
  }

  /**
   * Configures the maximum size of the historical buffer.
   */
  public static setMaxHistorySize(size: number) {
    this.maxHistorySize = Math.max(1, size);
    
    // Trim immediately if size is reduced
    while (this.results.length > this.maxHistorySize) {
      this.results.pop();
    }
  }

  /**
   * Clears the historical log.
   */
  public static clear() {
    this.results = [];
  }
}
