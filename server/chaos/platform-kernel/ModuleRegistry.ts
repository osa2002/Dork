import { EngineManifest } from "./EngineManifest";
import { ControlPlaneRegistry } from "../control-plane/ControlPlaneRegistry";

export class ModuleRegistry {
  private static registeredModules = new Map<string, EngineManifest>();

  static {
    this.bootstrapRegistry();
  }

  /**
   * Registers a new module manifest.
   */
  public static register(manifest: EngineManifest): void {
    if (this.registeredModules.has(manifest.id)) {
      throw new Error(`Subsystem with ID '${manifest.id}' is already registered in the Module Registry.`);
    }
    this.registeredModules.set(manifest.id, Object.freeze(manifest));
  }

  /**
   * Unregisters a module.
   */
  public static unregister(id: string): boolean {
    return this.registeredModules.delete(id);
  }

  /**
   * Gets a module manifest by ID.
   */
  public static get(id: string): EngineManifest | undefined {
    return this.registeredModules.get(id);
  }

  /**
   * Retrieves all registered module manifests.
   */
  public static getAll(): readonly EngineManifest[] {
    return Object.freeze(Array.from(this.registeredModules.values()));
  }

  /**
   * Clear the registry.
   */
  public static clear(): void {
    this.registeredModules.clear();
  }

  /**
   * Reset registry to defaults.
   */
  public static resetToDefault(): void {
    this.clear();
    this.bootstrapRegistry();
  }

  /**
   * Dynamically bootstraps all enterprise systems including core and SRE extensions.
   */
  private static bootstrapRegistry(): void {
    // 1. Enterprise Event Bus
    this.register({
      id: "enterprise-event-bus",
      name: "Enterprise Event Bus",
      version: "1.2.0",
      owner: "GovernanceTeam",
      capabilities: ["pubsub", "correlation", "audit-trail"],
      dependencies: [],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: true, hasExecute: false, hasCleanup: false },
      supportedAPIs: ["publish", "subscribe", "clear", "getLogs"],
      compatibilityVersions: {},
    });

    // 2. Operational Control Plane
    this.register({
      id: "operational-control-plane",
      name: "Operational Control Plane",
      version: "2.1.0",
      owner: "SREFoundations",
      capabilities: ["health-evaluation", "orchestration", "dependency-auditing"],
      dependencies: ["enterprise-event-bus"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: true, hasExecute: true, hasCleanup: true },
      supportedAPIs: ["evaluateHealth", "auditDependencies", "coordinateExecution"],
      compatibilityVersions: { "enterprise-event-bus": "^1.2.0" },
    });

    // 3. Operations Center
    this.register({
      id: "operations-center",
      name: "Operations Center",
      version: "1.3.0",
      owner: "GlobalNOC",
      capabilities: ["telemetry-collection", "live-monitoring"],
      dependencies: ["enterprise-event-bus"],
      readiness: 98,
      health: "ACTIVE",
      lifecycle: { hasInitialize: true, hasExecute: false, hasCleanup: false },
      supportedAPIs: ["collectLiveState"],
      compatibilityVersions: { "enterprise-event-bus": "^1.2.0" },
    });

    // 4. Governance Engine
    this.register({
      id: "governance",
      name: "Enterprise Score & Governance Engine",
      version: "1.3.0",
      owner: "ComplianceTeam",
      capabilities: ["score-calculation", "sla-reporting", "audit-compliance"],
      dependencies: ["enterprise-event-bus"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["calculateScores"],
      compatibilityVersions: { "enterprise-event-bus": "^1.2.0" },
    });

    // 5. Chaos Orchestrator
    this.register({
      id: "chaos-orchestrator",
      name: "Chaos Orchestrator",
      version: "1.5.0",
      owner: "ChaosTeam",
      capabilities: ["chaos-injection", "plan-execution", "rollback"],
      dependencies: ["enterprise-event-bus"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["executePlan", "stopAll"],
      compatibilityVersions: { "enterprise-event-bus": "^1.2.0" },
    });

    // 6. Operational Intelligence
    this.register({
      id: "operational-intelligence",
      name: "Operational Intelligence Engine",
      version: "1.1.0",
      owner: "SREIntelligenceTeam",
      capabilities: ["anomaly-detection", "coverage-analysis", "impact-scoring"],
      dependencies: ["chaos-orchestrator"],
      readiness: 95,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["getRecommendations"],
      compatibilityVersions: { "chaos-orchestrator": "^1.5.0" },
    });

    // 7. Knowledge Engine
    this.register({
      id: "knowledge-engine",
      name: "Knowledge Engine",
      version: "1.0.0",
      owner: "KnowledgeTeam",
      capabilities: ["knowledge-ingest", "history-tracking"],
      dependencies: ["governance"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: true, hasExecute: false, hasCleanup: false },
      supportedAPIs: ["receiveCompletedExecution"],
      compatibilityVersions: { governance: "^1.3.0" },
    });

    // 8. Knowledge Intelligence (Correlation)
    this.register({
      id: "knowledge-intelligence",
      name: "Knowledge Intelligence Engine",
      version: "1.0.0",
      owner: "KnowledgeTeam",
      capabilities: ["correlation-analysis", "semantic-insights"],
      dependencies: ["knowledge-engine"],
      readiness: 95,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["analyze"],
      compatibilityVersions: { "knowledge-engine": "^1.0.0" },
    });

    // 9. Prediction Engine
    this.register({
      id: "prediction-engine",
      name: "Prediction Engine",
      version: "1.4.0",
      owner: "DataScienceTeam",
      capabilities: ["risk-forecasting", "blast-radius-prediction"],
      dependencies: ["knowledge-intelligence"],
      readiness: 92,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["generatePrediction"],
      compatibilityVersions: { "knowledge-intelligence": "^1.0.0" },
    });

    // 10. Digital Twin
    this.register({
      id: "digital-twin",
      name: "Digital Twin Engine",
      version: "1.2.5",
      owner: "SimulationTeam",
      capabilities: ["sandbox-calibration", "predictive-simulation"],
      dependencies: ["prediction-engine"],
      readiness: 96,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["createTwinFromProduction", "getData"],
      compatibilityVersions: { "prediction-engine": "^1.4.0" },
    });

    // 11. Decision Engine
    this.register({
      id: "decision-engine",
      name: "Autonomous Decision Engine",
      version: "1.1.5",
      owner: "AutonomicTeam",
      capabilities: ["policy-evaluation", "remediation-routing"],
      dependencies: ["digital-twin"],
      readiness: 94,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["evaluate"],
      compatibilityVersions: { "digital-twin": "^1.2.5" },
    });

    // 12. Recovery Engine
    this.register({
      id: "recovery-engine",
      name: "Autonomous Recovery Engine",
      version: "1.6.0",
      owner: "SRETeam",
      capabilities: ["automated-recovery", "rollback-orchestration"],
      dependencies: ["decision-engine"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["handleDecision", "triggerRollback"],
      compatibilityVersions: { "decision-engine": "^1.1.5" },
    });

    // 13. Continuous Validation Platform
    this.register({
      id: "continuous-validation-platform",
      name: "Continuous Validation Platform",
      version: "1.0.0",
      owner: "SecurityComplianceTeam",
      capabilities: ["continuous-rules-validation", "sre-compliance-reporting"],
      dependencies: ["recovery-engine", "governance"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["validatePlatform"],
      compatibilityVersions: { "recovery-engine": "^1.6.0", governance: "^1.3.0" },
    });

    // 14. Integration Validator
    this.register({
      id: "integration-validator",
      name: "Integration Validator",
      version: "1.0.0",
      owner: "QAAutomationTeam",
      capabilities: ["end-to-end-loop-verification"],
      dependencies: ["continuous-validation-platform"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["validateEndToEnd"],
      compatibilityVersions: { "continuous-validation-platform": "^1.0.0" },
    });

    // 15. Incident Command Engine
    this.register({
      id: "incident-command",
      name: "Incident Command Engine",
      version: "1.1.0",
      owner: "SRECore",
      capabilities: ["incident-coordination", "automated-triage", "postmortem-generation"],
      dependencies: ["operational-control-plane"],
      readiness: 97,
      health: "ACTIVE",
      lifecycle: { hasInitialize: true, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["coordinate", "classify", "staff"],
      compatibilityVersions: { "operational-control-plane": "^2.1.0" },
    });

    // 16. Observability Engine
    this.register({
      id: "observability-engine",
      name: "Observability Engine",
      version: "1.2.1",
      owner: "SRETelemetryTeam",
      capabilities: ["distributed-tracing", "metrics-aggregation", "otel-export"],
      dependencies: ["operational-control-plane"],
      readiness: 99,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["evaluate", "compileState", "export"],
      compatibilityVersions: { "operational-control-plane": "^2.1.0" },
    });

    // 17. Change Management Engine
    this.register({
      id: "change-management",
      name: "Change Management Engine",
      version: "1.0.0",
      owner: "ReleaseOperations",
      capabilities: ["impact-analysis", "risk-evaluation", "audit-logging"],
      dependencies: ["operational-control-plane"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["plan", "execute", "audit"],
      compatibilityVersions: { "operational-control-plane": "^2.1.0" },
    });

    // 18. Release Management Engine
    this.register({
      id: "release-management",
      name: "Release Management Engine",
      version: "1.0.0",
      owner: "ReleaseOperations",
      capabilities: ["pipeline-gating", "canary-validation", "rollback-planning"],
      dependencies: ["change-management"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["plan", "execute", "validate"],
      compatibilityVersions: { "change-management": "^1.0.0" },
    });

    // 19. Enterprise Security Engine
    this.register({
      id: "security-engine",
      name: "Enterprise Security Hardening Engine",
      version: "1.0.0",
      owner: "SecurityOperations",
      capabilities: ["threat-modeling", "attack-surface-analysis", "runtime-security", "supply-chain-audit"],
      dependencies: ["operational-control-plane"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["evaluate"],
      compatibilityVersions: { "operational-control-plane": "^2.1.0" },
    });

    // 20. Enterprise Deployment Engine
    this.register({
      id: "deployment-engine",
      name: "Enterprise Deployment Automation Engine",
      version: "1.0.0",
      owner: "ReleaseOperations",
      capabilities: ["deployment-orchestration", "promotion-pipeline", "strategy-recommendation", "automated-rollback"],
      dependencies: ["release-management"],
      readiness: 100,
      health: "ACTIVE",
      lifecycle: { hasInitialize: false, hasExecute: true, hasCleanup: false },
      supportedAPIs: ["execute", "recommendStrategy"],
      compatibilityVersions: { "release-management": "^1.0.0" },
    });
  }
}
