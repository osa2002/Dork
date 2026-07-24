import { EngineDescriptor } from "./EngineDescriptor";

// Core Engine Imports
import { ChaosOrchestrator } from "../orchestrator/ChaosOrchestrator";
import { ChaosPolicy } from "../orchestrator/ChaosPolicy";
import { ChaosIntelligenceEngine } from "../intelligence/ChaosIntelligenceEngine";
import { EnterpriseScoreEngine } from "../governance/EnterpriseScoreEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { KnowledgeEngine } from "../knowledge/KnowledgeEngine";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { KnowledgeCorrelation } from "../knowledge/KnowledgeCorrelation";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { DigitalTwinEngine } from "../digital-twin/DigitalTwinEngine";
import { DecisionEngine } from "../autonomous/DecisionEngine";
import { RecoveryEngine } from "../recovery/RecoveryEngine";
import { ContinuousValidationService } from "../validation/ContinuousValidationService";
import { IntegrationValidator } from "../integration/IntegrationValidator";

export class ControlPlaneRegistry {
  private static engines = new Map<string, EngineDescriptor>();

  /**
   * Automatically bootstrap standard enterprise engines upon class load
   */
  static {
    this.bootstrapDefaultEngines();
  }

  /**
   * Registers a new engine in the Control Plane.
   */
  public static register(descriptor: EngineDescriptor): void {
    if (this.engines.has(descriptor.id)) {
      throw new Error(`Engine with ID '${descriptor.id}' is already registered in the Control Plane.`);
    }
    this.engines.set(descriptor.id, descriptor);
  }

  /**
   * Unregisters an engine by its identifier.
   */
  public static unregister(id: string): boolean {
    return this.engines.delete(id);
  }

  /**
   * Retrieves an engine descriptor by ID.
   */
  public static get(id: string): EngineDescriptor | undefined {
    return this.engines.get(id);
  }

  /**
   * Retrieves all registered engine descriptors.
   */
  public static getAll(): EngineDescriptor[] {
    return Array.from(this.engines.values());
  }

  /**
   * Finds all engines declaring a specific capability.
   */
  public static findByCapability(capability: string): EngineDescriptor[] {
    return this.getAll().filter((eng) => eng.capabilities.includes(capability));
  }

  /**
   * Clears the entire registry.
   */
  public static clear(): void {
    this.engines.clear();
  }

  /**
   * Reset registry to the bootstrapped default engines.
   */
  public static resetToDefault(): void {
    this.clear();
    this.bootstrapDefaultEngines();
  }

  /**
   * Bootstraps the 12 target systems with their official metadata,
   * dependencies, capabilities, versions, and lifecycle hooks.
   */
  private static bootstrapDefaultEngines(): void {
    // 1. Enterprise Event Bus
    this.register({
      id: "enterprise-event-bus",
      name: "Enterprise Event Bus",
      version: "1.2.0",
      status: "ACTIVE",
      owner: "GovernanceTeam",
      capabilities: ["pubsub", "correlation", "audit"],
      dependencies: [],
      compatibilityMatrix: {},
      priority: 100,
      instance: EnterpriseEventBus,
      lifecycle: {
        async initialize(ctx) {
          // Verify event bus functions are reachable
          if (typeof EnterpriseEventBus.publish !== "function") {
            throw new Error("EnterpriseEventBus lacks publish function");
          }
        }
      }
    });

    // 2. Chaos Orchestrator
    this.register({
      id: "chaos-orchestrator",
      name: "Chaos Orchestrator",
      version: "1.5.0",
      status: "ACTIVE",
      owner: "ChaosTeam",
      capabilities: ["chaos-injection", "plan-execution", "rollback"],
      dependencies: ["enterprise-event-bus"],
      compatibilityMatrix: { "enterprise-event-bus": "^1.2.0" },
      priority: 90,
      instance: ChaosOrchestrator,
      lifecycle: {
        async execute(ctx, input) {
          // Direct coordination trigger of a sequential or parallel chaos plan if passed in input
          if (input?.plan) {
            return await ChaosOrchestrator.executePlan(input.plan, ChaosPolicy.DEFAULT_POLICY, { correlationId: ctx.correlationId });
          }
          return { status: "STANDBY", msg: "No active chaos plan supplied to execute hook" };
        }
      }
    });

    // 3. Operational Intelligence
    this.register({
      id: "operational-intelligence",
      name: "Operational Intelligence Engine",
      version: "1.1.0",
      status: "ACTIVE",
      owner: "SREIntelligenceTeam",
      capabilities: ["anomaly-detection", "coverage-analysis", "impact-scoring"],
      dependencies: ["chaos-orchestrator"],
      compatibilityMatrix: { "chaos-orchestrator": "^1.5.0" },
      priority: 80,
      instance: ChaosIntelligenceEngine,
      lifecycle: {
        async execute(ctx) {
          return ChaosIntelligenceEngine.getRecommendations();
        }
      }
    });

    // 4. Governance Engine
    this.register({
      id: "governance",
      name: "Enterprise Score & Governance Engine",
      version: "1.3.0",
      status: "ACTIVE",
      owner: "ComplianceTeam",
      capabilities: ["score-calculation", "sla-reporting", "audit-compliance"],
      dependencies: ["enterprise-event-bus"],
      compatibilityMatrix: { "enterprise-event-bus": "^1.2.0" },
      priority: 75,
      instance: EnterpriseScoreEngine,
      lifecycle: {
        async execute(ctx) {
          return EnterpriseScoreEngine.calculateScores();
        }
      }
    });

    // 5. Knowledge Engine
    this.register({
      id: "knowledge-engine",
      name: "Knowledge Engine",
      version: "1.0.0",
      status: "ACTIVE",
      owner: "KnowledgeTeam",
      capabilities: ["knowledge-ingest", "history-tracking"],
      dependencies: ["governance"],
      compatibilityMatrix: { "governance": "^1.3.0" },
      priority: 70,
      instance: KnowledgeEngine,
      lifecycle: {
        async initialize(ctx) {
          // Initial checks
          if (typeof KnowledgeEngine.receiveCompletedExecution !== "function") {
            throw new Error("KnowledgeEngine lacks receiveCompletedExecution function");
          }
        }
      }
    });

    // 6. Knowledge Intelligence
    this.register({
      id: "knowledge-intelligence",
      name: "Knowledge Intelligence Engine",
      version: "1.0.0",
      status: "ACTIVE",
      owner: "KnowledgeTeam",
      capabilities: ["correlation-analysis", "semantic-insights"],
      dependencies: ["knowledge-engine"],
      compatibilityMatrix: { "knowledge-engine": "^1.0.0" },
      priority: 65,
      instance: KnowledgeCorrelation,
      lifecycle: {
        async execute(ctx) {
          const records = KnowledgeRepository.getAll();
          return KnowledgeCorrelation.analyze(records);
        }
      }
    });

    // 7. Prediction Engine
    this.register({
      id: "prediction-engine",
      name: "Prediction Engine",
      version: "1.4.0",
      status: "ACTIVE",
      owner: "DataScienceTeam",
      capabilities: ["risk-forecasting", "blast-radius-prediction"],
      dependencies: ["knowledge-intelligence"],
      compatibilityMatrix: { "knowledge-intelligence": "^1.0.0" },
      priority: 60,
      instance: PredictionEngine,
      lifecycle: {
        async execute(ctx) {
          return PredictionEngine.generatePrediction("FAILURE_PROBABILITY", ctx.correlationId);
        }
      }
    });

    // 8. Digital Twin
    this.register({
      id: "digital-twin",
      name: "Digital Twin Engine",
      version: "1.2.5",
      status: "ACTIVE",
      owner: "SimulationTeam",
      capabilities: ["sandbox-calibration", "predictive-simulation"],
      dependencies: ["prediction-engine"],
      compatibilityMatrix: { "prediction-engine": "^1.4.0" },
      priority: 55,
      instance: DigitalTwinEngine,
      lifecycle: {
        async execute(ctx) {
          const twin = DigitalTwinEngine.createTwinFromProduction(ctx.correlationId);
          return twin.getData();
        }
      }
    });

    // 9. Decision Engine
    this.register({
      id: "decision-engine",
      name: "Autonomous Decision Engine",
      version: "1.1.5",
      status: "ACTIVE",
      owner: "AutonomicTeam",
      capabilities: ["policy-evaluation", "remediation-routing"],
      dependencies: ["digital-twin"],
      compatibilityMatrix: { "digital-twin": "^1.2.5" },
      priority: 50,
      instance: DecisionEngine,
      lifecycle: {
        async execute(ctx) {
          return DecisionEngine.evaluate();
        }
      }
    });

    // 10. Recovery Engine
    this.register({
      id: "recovery-engine",
      name: "Autonomous Recovery Engine",
      version: "1.6.0",
      status: "ACTIVE",
      owner: "SRETeam",
      capabilities: ["automated-recovery", "rollback-orchestration"],
      dependencies: ["decision-engine"],
      compatibilityMatrix: { "decision-engine": "^1.1.5" },
      priority: 45,
      instance: RecoveryEngine,
      lifecycle: {
        async execute(ctx) {
          // Trigger a silent recovery validation or direct execution query if relevant
          const decision = DecisionEngine.evaluate();
          return await RecoveryEngine.handleDecision(decision);
        }
      }
    });

    // 11. Continuous Validation Platform
    this.register({
      id: "continuous-validation-platform",
      name: "Continuous Validation Platform",
      version: "1.0.0",
      status: "ACTIVE",
      owner: "SecurityComplianceTeam",
      capabilities: ["continous-rules-validation", "sre-compliance-reporting"],
      dependencies: ["recovery-engine", "governance"],
      compatibilityMatrix: { "recovery-engine": "^1.6.0", "governance": "^1.3.0" },
      priority: 40,
      instance: ContinuousValidationService,
      lifecycle: {
        async execute(ctx) {
          return await ContinuousValidationService.validatePlatform("CONTINUOUS", ctx.correlationId);
        }
      }
    });

    // 12. Integration Validator
    this.register({
      id: "integration-validator",
      name: "Integration Validator",
      version: "1.0.0",
      status: "ACTIVE",
      owner: "QAAutomationTeam",
      capabilities: ["end-to-end-loop-verification"],
      dependencies: ["continuous-validation-platform"],
      compatibilityMatrix: { "continuous-validation-platform": "^1.0.0" },
      priority: 30,
      instance: IntegrationValidator,
      lifecycle: {
        async execute(ctx) {
          return await IntegrationValidator.validateEndToEnd();
        }
      }
    });
  }
}
