import { TwinState } from "./TwinState";
import { TwinDependencyGraph } from "./TwinDependencyGraph";

export class TwinSimulation {
  /**
   * Simulates a virtual Firestore failure on a given TwinState and returns the new virtual state.
   */
  public static simulateFirestoreFailure(state: TwinState): TwinState {
    return state.update((draft) => {
      // 1. Update virtual chaos config
      draft.chaosConfig.activeScenarios = [...draft.chaosConfig.activeScenarios, "DatabaseFailureScenario"];
      draft.chaosConfig.isEnabled = true;

      // 2. Update virtual dependency graph
      const graph = new TwinDependencyGraph(draft.dependencyGraph.nodes as any, draft.dependencyGraph.edges as any);
      graph.injectVirtualFailure("Firestore", "UNAVAILABLE");
      draft.dependencyGraph.nodes = graph.getNodes();
      draft.dependencyGraph.edges = graph.getEdges();

      // 3. Update virtual health
      draft.health = {
        status: "DEGRADED",
        impactScore: 75,
        reason: "Virtual Firestore outage triggered in Digital Twin simulation",
        activeScenarios: ["DatabaseFailureScenario"],
        latencyAddedMs: 500,
        injectionProbability: 1.0,
      };

      // 4. Degrade SLO metrics
      draft.slo.availability.actual = 92.45;
      draft.slo.availability.failedRequests += 120;
      draft.slo.availability.errorBudgetRemaining = Math.max(0, draft.slo.availability.errorBudgetRemaining - 40);
      draft.slo.latency.actualP95Ms = 650;

      // 5. Degrade counts
      draft.metrics.counts.apiErrors += 120;
      draft.metrics.counts.avgLatencyMs = 650;

      // 6. Degrade enterprise score
      draft.governance.scores = {
        reliabilityScore: 50,
        resilienceScore: 40,
        recoverabilityScore: 30,
        observabilityScore: 90,
        operationalReadiness: 45,
        overallEnterpriseScore: 51,
        letterGrade: "D",
      };

      // 7. Update timestamp
      draft.timestamp = new Date().toISOString();
    });
  }

  /**
   * Simulates a Stripe Gateway failure virtually.
   */
  public static simulateStripeFailure(state: TwinState): TwinState {
    return state.update((draft) => {
      draft.chaosConfig.activeScenarios = [...draft.chaosConfig.activeScenarios, "TransactionFailureScenario"];
      draft.chaosConfig.isEnabled = true;

      const graph = new TwinDependencyGraph(draft.dependencyGraph.nodes as any, draft.dependencyGraph.edges as any);
      graph.injectVirtualFailure("StripeAPI", "PARTIAL_OUTAGE");
      draft.dependencyGraph.nodes = graph.getNodes();
      draft.dependencyGraph.edges = graph.getEdges();

      draft.health = {
        status: "PARTIALLY_DEGRADED",
        impactScore: 40,
        reason: "Virtual Stripe API degradation simulated",
        activeScenarios: ["TransactionFailureScenario"],
        latencyAddedMs: 200,
        injectionProbability: 0.5,
      };

      draft.slo.availability.actual = 97.2;
      draft.slo.availability.errorBudgetRemaining = Math.max(0, draft.slo.availability.errorBudgetRemaining - 15);
      draft.slo.paymentLatency.actualMs = 3800; // high latency

      draft.metrics.business.notificationSuccessRate = 95.0;
      draft.metrics.counts.apiErrors += 35;

      draft.governance.scores.reliabilityScore = 75;
      draft.governance.scores.overallEnterpriseScore = 78;
      draft.governance.scores.letterGrade = "C";

      draft.timestamp = new Date().toISOString();
    });
  }

  /**
   * Simulates a Gemini LLM timeout virtually.
   */
  public static simulateGeminiTimeout(state: TwinState): TwinState {
    return state.update((draft) => {
      draft.chaosConfig.activeScenarios = [...draft.chaosConfig.activeScenarios, "LatencyScenario"];
      draft.chaosConfig.isEnabled = true;

      const graph = new TwinDependencyGraph(draft.dependencyGraph.nodes as any, draft.dependencyGraph.edges as any);
      graph.injectVirtualFailure("GeminiAI", "DEGRADED");
      draft.dependencyGraph.nodes = graph.getNodes();
      draft.dependencyGraph.edges = graph.getEdges();

      draft.health.status = "PARTIALLY_DEGRADED";
      draft.health.impactScore = 30;
      draft.health.latencyAddedMs = 3000;

      draft.slo.aiResponseTime.actualMs = 5200; // timeout threshold exceeded
      draft.slo.latency.actualP95Ms = 1200;

      draft.governance.scores.reliabilityScore = 80;
      draft.governance.scores.overallEnterpriseScore = 82;
      draft.governance.scores.letterGrade = "B";

      draft.timestamp = new Date().toISOString();
    });
  }

  /**
   * Simulates Virtual Memory Pressure.
   */
  public static simulateMemoryPressure(state: TwinState): TwinState {
    return state.update((draft) => {
      draft.metrics.system.memory.heapUsed = Math.round(draft.metrics.system.memory.heapTotal * 0.95);
      draft.metrics.system.memory.freePercent = 2; // Critical low memory

      draft.health = {
        status: "DEGRADED",
        impactScore: 60,
        reason: "Virtual Node.js Heap Exhaustion (>95% Used)",
        activeScenarios: [],
        latencyAddedMs: 400,
        injectionProbability: 0,
      };

      draft.slo.latency.actualP95Ms = 850;
      draft.governance.scores.resilienceScore = 55;
      draft.governance.scores.overallEnterpriseScore = 72;
      draft.governance.scores.letterGrade = "C";

      draft.timestamp = new Date().toISOString();
    });
  }

  /**
   * Simulates CPU saturation virtually.
   */
  public static simulateCpuSaturation(state: TwinState): TwinState {
    return state.update((draft) => {
      draft.metrics.system.cpu.loadAvg = [8.5, 7.2, 5.8]; // heavy load on high cores

      draft.health = {
        status: "DEGRADED",
        impactScore: 50,
        reason: "Virtual CPU Saturation (>8.0 load average)",
        activeScenarios: [],
        latencyAddedMs: 250,
        injectionProbability: 0,
      };

      draft.slo.latency.actualP95Ms = 500;
      draft.governance.scores.overallEnterpriseScore = 78;
      draft.governance.scores.letterGrade = "C";

      draft.timestamp = new Date().toISOString();
    });
  }

  /**
   * Simulates absolute loss of a critical downstream dependency (e.g., TwilioSMS).
   */
  public static simulateDependencyLoss(state: TwinState, nodeId: string): TwinState {
    return state.update((draft) => {
      const graph = new TwinDependencyGraph(draft.dependencyGraph.nodes as any, draft.dependencyGraph.edges as any);
      graph.injectVirtualFailure(nodeId, "UNAVAILABLE");
      draft.dependencyGraph.nodes = graph.getNodes();
      draft.dependencyGraph.edges = graph.getEdges();

      draft.health = {
        status: "PARTIALLY_DEGRADED",
        impactScore: 35,
        reason: `Virtual absolute failure on dependency: ${nodeId}`,
        activeScenarios: [],
        latencyAddedMs: 50,
        injectionProbability: 0,
      };

      draft.slo.availability.actual = 98.1;
      draft.governance.scores.resilienceScore = 70;
      draft.governance.scores.overallEnterpriseScore = 80;
      draft.governance.scores.letterGrade = "B";

      draft.timestamp = new Date().toISOString();
    });
  }

  /**
   * Simulates a cascading outage: Firestore goes down, which fills the connection pool,
   * leading to Express Web Server memory pressure, then leading to payment gateway Stripe failure.
   */
  public static simulateCascadeFailure(state: TwinState): TwinState {
    let virtualState = TwinSimulation.simulateFirestoreFailure(state);
    virtualState = TwinSimulation.simulateMemoryPressure(virtualState);
    virtualState = TwinSimulation.simulateStripeFailure(virtualState);

    return virtualState.update((draft) => {
      draft.health = {
        status: "UNAVAILABLE",
        impactScore: 95,
        reason: "Simulated Cascading Outage (Firestore Outage ➔ Memory Saturation ➔ Stripe Failure)",
        activeScenarios: ["DatabaseFailureScenario", "TransactionFailureScenario"],
        latencyAddedMs: 2500,
        injectionProbability: 1.0,
      };

      draft.governance.scores = {
        reliabilityScore: 15,
        resilienceScore: 10,
        recoverabilityScore: 10,
        observabilityScore: 95,
        operationalReadiness: 20,
        overallEnterpriseScore: 15,
        letterGrade: "F",
      };

      draft.slo.availability.actual = 81.2;
      draft.slo.availability.errorBudgetRemaining = 0; // budget exhausted!
      draft.timestamp = new Date().toISOString();
    });
  }
}
