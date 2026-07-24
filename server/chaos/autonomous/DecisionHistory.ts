import { AutonomousDecision } from "./AutonomousDecision";
import { DecisionPolicy } from "./DecisionPolicy";

export class DecisionHistory {
  private static history: AutonomousDecision[] = [];

  /**
   * Appends a new decision to the bounded history.
   */
  public static addDecision(decision: AutonomousDecision): void {
    const policy = DecisionPolicy.getPolicy();
    const maxSize = policy.maxHistorySize;

    this.history.unshift(decision);
    
    // Enforce the bounded limit
    if (this.history.length > maxSize) {
      this.history = this.history.slice(0, maxSize);
    }
  }

  /**
   * Retrieves all logged autonomous decisions.
   */
  public static getHistory(): AutonomousDecision[] {
    return [...this.history];
  }

  /**
   * Clears the in-memory decision logs.
   */
  public static clear(): void {
    this.history = [];
  }
}
