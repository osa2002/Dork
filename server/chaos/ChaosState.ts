import { ShutdownManager } from "../../src/services/ShutdownManager";

export class ChaosState {
  private static isEnabled = false;
  private static globalProbability = 0.25; // Default 25%
  private static globalLatency = 0; // ms
  private static targetEndpoints = new Set<string>();
  private static activeScenarios = new Set<string>();
  private static seed = 123456789;
  private static initialSeed = 123456789;

  // Active timers to clean up during shutdown
  private static activeTimers = new Set<NodeJS.Timeout>();

  private static metrics = {
    chaos_events_total: 0,
    chaos_events_success: 0,
    chaos_events_failed: 0,
    chaos_latency_added: 0,
    chaos_probability_hits: 0,
  };

  public static initialize(config?: {
    enabled?: boolean;
    probability?: number;
    latency?: number;
    targetEndpoints?: string[];
    seed?: number;
  }) {
    if (config) {
      if (config.enabled !== undefined) this.isEnabled = config.enabled;
      if (config.probability !== undefined) this.globalProbability = config.probability;
      if (config.latency !== undefined) this.globalLatency = config.latency;
      if (config.targetEndpoints) {
        this.targetEndpoints = new Set(config.targetEndpoints);
      }
      if (config.seed !== undefined) {
        this.seed = config.seed;
        this.initialSeed = config.seed;
      }
    }
  }

  public static setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public static getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public static setProbability(prob: number) {
    this.globalProbability = Math.max(0, Math.min(1, prob));
  }

  public static getProbability(): number {
    return this.globalProbability;
  }

  public static setLatency(latencyMs: number) {
    this.globalLatency = Math.max(0, latencyMs);
  }

  public static getLatency(): number {
    return this.globalLatency;
  }

  public static getTargetEndpoints(): string[] {
    return Array.from(this.targetEndpoints);
  }

  public static addTargetEndpoint(endpoint: string) {
    this.targetEndpoints.add(endpoint);
  }

  public static removeTargetEndpoint(endpoint: string) {
    this.targetEndpoints.delete(endpoint);
  }

  public static clearTargetEndpoints() {
    this.targetEndpoints.clear();
  }

  public static getActiveScenarios(): string[] {
    return Array.from(this.activeScenarios);
  }

  public static activateScenario(name: string) {
    this.activeScenarios.add(name);
  }

  public static deactivateScenario(name: string) {
    this.activeScenarios.delete(name);
  }

  public static clearActiveScenarios() {
    this.activeScenarios.clear();
  }

  public static setSeed(newSeed: number) {
    this.seed = newSeed;
    this.initialSeed = newSeed;
  }

  public static resetSeed() {
    this.seed = this.initialSeed;
  }

  /**
   * Deterministic seeded random generator (Linear Congruential Generator)
   */
  public static seededRandom(): number {
    const m = 0x80000000; // 2**31
    const a = 1103515245;
    const c = 12345;
    this.seed = (a * this.seed + c) % m;
    return this.seed / (m - 1);
  }

  /**
   * Evaluates if a failure should trigger based on probability (deterministic or request-based)
   */
  public static evaluateProbability(probOverride?: number): boolean {
    const prob = probOverride !== undefined ? probOverride : this.globalProbability;
    if (prob <= 0) return false;
    if (prob >= 1) {
      this.incrementMetric("chaos_probability_hits");
      return true;
    }
    const rolled = this.seededRandom();
    const hit = rolled <= prob;
    if (hit) {
      this.incrementMetric("chaos_probability_hits");
    }
    return hit;
  }

  // Metrics Management
  public static getMetric(key: keyof typeof ChaosState.metrics): number {
    return this.metrics[key];
  }

  public static incrementMetric(key: keyof typeof ChaosState.metrics, by: number = 1) {
    this.metrics[key] += by;
  }

  public static resetMetrics() {
    this.metrics = {
      chaos_events_total: 0,
      chaos_events_success: 0,
      chaos_events_failed: 0,
      chaos_latency_added: 0,
      chaos_probability_hits: 0,
    };
  }

  // Timer Tracking with ShutdownManager Integration
  public static registerTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.activeTimers.add(timer);
    // Automatically register with ShutdownManager so it clears on exit
    ShutdownManager.registerInterval(timer);
    return timer;
  }

  public static clearTimer(timer: NodeJS.Timeout) {
    clearTimeout(timer);
    clearInterval(timer);
    this.activeTimers.delete(timer);
  }

  public static clearAllTimers() {
    this.activeTimers.forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.activeTimers.clear();
  }
}
