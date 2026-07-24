import { IChaosScenario, LatencyScenario, DatabaseFailureScenario, DependencyFailureScenario, CleanupFailureScenario, SchedulerFailureScenario, TransactionFailureScenario, RateLimitScenario, AuthenticationFailureScenario } from "./ChaosScenarios";
import { ChaosState } from "./ChaosState";

export class ChaosRegistry {
  private static scenarios = new Map<string, IChaosScenario>();

  static {
    // Auto-register standard scenarios
    this.register(new LatencyScenario());
    this.register(new DatabaseFailureScenario());
    this.register(new DependencyFailureScenario());
    this.register(new CleanupFailureScenario());
    this.register(new SchedulerFailureScenario());
    this.register(new TransactionFailureScenario());
    this.register(new RateLimitScenario());
    this.register(new AuthenticationFailureScenario());
  }

  public static register(scenario: IChaosScenario) {
    this.scenarios.set(scenario.name.toLowerCase(), scenario);
    this.scenarios.set(scenario.constructor.name.toLowerCase(), scenario);
  }

  public static get(name: string): IChaosScenario | undefined {
    return this.scenarios.get(name.toLowerCase());
  }

  public static getAll(): IChaosScenario[] {
    return Array.from(new Set(this.scenarios.values()));
  }

  public static unregister(name: string) {
    this.scenarios.delete(name.toLowerCase());
  }

  public static clear() {
    this.scenarios.clear();
  }

  /**
   * Graceful cleanup of any ongoing timers, intervals, and active state
   */
  public static shutdown() {
    console.log("[ChaosRegistry] Gracefully shutting down Chaos module. Cleaning timers and resetting state...");
    ChaosState.clearAllTimers();
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();
    ChaosState.setEnabled(false);
  }
}
