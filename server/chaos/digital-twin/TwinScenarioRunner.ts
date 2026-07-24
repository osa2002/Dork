import { TwinState } from "./TwinState";
import { TwinSimulation } from "./TwinSimulation";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";

export interface ScenarioRunResult {
  scenarioName: string;
  initialState: TwinState;
  finalState: TwinState;
  executedAt: string;
}

export class TwinScenarioRunner {
  /**
   * Executes a list of simulation steps sequentially.
   */
  public static runSequential(
    state: TwinState,
    simulations: ((s: TwinState) => TwinState)[]
  ): TwinState {
    let current = state;
    for (const sim of simulations) {
      current = sim(current);
    }
    return current;
  }

  /**
   * Executes multiple simulations in parallel on separate clones of the initial state.
   */
  public static runParallel(
    state: TwinState,
    scenarios: { name: string; sim: (s: TwinState) => TwinState }[]
  ): ScenarioRunResult[] {
    return scenarios.map((scenario) => ({
      scenarioName: scenario.name,
      initialState: state,
      finalState: scenario.sim(state),
      executedAt: new Date().toISOString(),
    }));
  }

  /**
   * Simulates a partial/canary rollout where only a subset of requests/nodes are impacted.
   */
  public static runCanary(
    state: TwinState,
    sim: (s: TwinState) => TwinState,
    canaryWeight: number = 0.1 // 10% of impact
  ): TwinState {
    const fullFailureState = sim(state);
    
    // Interpolate metrics between normal state and failed state based on canary weight
    return state.update((draft) => {
      const normalData = state.getData();
      const failedData = fullFailureState.getData();

      draft.slo.availability.actual = normalData.slo.availability.actual * (1 - canaryWeight) + failedData.slo.availability.actual * canaryWeight;
      draft.slo.latency.actualP95Ms = Math.round(normalData.slo.latency.actualP95Ms * (1 - canaryWeight) + failedData.slo.latency.actualP95Ms * canaryWeight);
      
      draft.health = {
        status: "DEGRADED",
        impactScore: Math.round(failedData.health.impactScore * canaryWeight),
        reason: `Canary execution (${Math.round(canaryWeight * 100)}% traffic) - ${failedData.health.reason}`,
        activeScenarios: failedData.chaosConfig.activeScenarios,
        latencyAddedMs: Math.round(failedData.health.latencyAddedMs * canaryWeight),
        injectionProbability: canaryWeight,
      };
    });
  }

  /**
   * Simulates a weighted scenario where multiple failures are compounded based on weight indices.
   */
  public static runWeighted(
    state: TwinState,
    weightedSimulations: { weight: number; sim: (s: TwinState) => TwinState }[]
  ): TwinState {
    let current = state;
    for (const item of weightedSimulations) {
      if (item.weight > 0.5) {
        current = item.sim(current);
      }
    }
    return current;
  }

  /**
   * Evaluates current prediction indicators to drive simulated failovers.
   */
  public static runPredictionDriven(state: TwinState): ScenarioRunResult {
    const prediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");
    let sim: (s: TwinState) => TwinState = TwinSimulation.simulateCpuSaturation;
    let name = "Virtual CPU Saturation";

    if (prediction.riskScore > 70) {
      sim = TwinSimulation.simulateCascadeFailure;
      name = "Prediction Driven Cascade Outage Simulation";
    } else if (prediction.riskScore > 40) {
      sim = TwinSimulation.simulateFirestoreFailure;
      name = "Prediction Driven Firestore Outage Simulation";
    }

    return {
      scenarioName: name,
      initialState: state,
      finalState: sim(state),
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Pulls past incident history from the Knowledge repository to run a replay.
   */
  public static runKnowledgeDriven(state: TwinState): ScenarioRunResult {
    const history = KnowledgeRepository.getAll();
    const hasDbOutages = history.some((h) => h.experimentName.toLowerCase().includes("database") || h.tags.includes("database"));

    const sim = hasDbOutages ? TwinSimulation.simulateFirestoreFailure : TwinSimulation.simulateCpuSaturation;
    const name = hasDbOutages ? "Knowledge Replay: Database Outage" : "Knowledge Replay: High-Load Simulation";

    return {
      scenarioName: name,
      initialState: state,
      finalState: sim(state),
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Validates if a simulation sequence is approved by governance policies (e.g. current reliability > 50).
   */
  public static isGovernanceApproved(state: TwinState): boolean {
    const reliability = state.getData().governance.scores.reliabilityScore;
    return reliability >= 50;
  }
}
