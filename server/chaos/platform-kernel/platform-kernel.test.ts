import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PlatformKernel } from "./PlatformKernel";
import { ModuleRegistry } from "./ModuleRegistry";
import { CapabilityRegistry } from "./CapabilityRegistry";
import { ServiceDiscovery } from "./ServiceDiscovery";
import { VersionCatalog } from "./VersionCatalog";
import { DependencyCatalog } from "./DependencyCatalog";
import { CompatibilityMatrix } from "./CompatibilityMatrix";
import { PlatformTopology } from "./PlatformTopology";
import { PlatformHealth } from "./PlatformHealth";
import { PlatformKernelEngine } from "./PlatformKernelEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise Platform Kernel & Capability Registry Test Suite", () => {
  beforeEach(() => {
    // Ensure we reset state before each run
    ModuleRegistry.resetToDefault();
    EnterpriseEventBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ModuleRegistry & Bootstrapping", () => {
    it("should successfully bootstrap the standard 20 enterprise engines", () => {
      const modules = ModuleRegistry.getAll();
      expect(modules.length).toBe(20);

      const eventBus = ModuleRegistry.get("enterprise-event-bus");
      expect(eventBus).toBeDefined();
      expect(eventBus?.owner).toBe("GovernanceTeam");
      expect(eventBus?.version).toBe("1.2.0");
      expect(eventBus?.health).toBe("ACTIVE");
    });

    it("should support custom system registrations", () => {
      const initialCount = ModuleRegistry.getAll().length;
      ModuleRegistry.register({
        id: "custom-sandbox-engine",
        name: "Custom Sandbox Engine",
        version: "1.0.0",
        owner: "TestingCrew",
        capabilities: ["simulation", "testing"],
        dependencies: ["enterprise-event-bus"],
        readiness: 100,
        health: "ACTIVE",
        lifecycle: { hasInitialize: true, hasExecute: true, hasCleanup: false },
        supportedAPIs: ["simulateRun"],
        compatibilityVersions: { "enterprise-event-bus": "^1.2.0" },
      });

      expect(ModuleRegistry.getAll().length).toBe(initialCount + 1);
      const custom = ModuleRegistry.get("custom-sandbox-engine");
      expect(custom?.owner).toBe("TestingCrew");
    });

    it("should prevent double-registration of duplicate module IDs", () => {
      expect(() => {
        ModuleRegistry.register({
          id: "enterprise-event-bus",
          name: "Duplicate Event Bus",
          version: "1.0.0",
          owner: "GovernanceTeam",
          capabilities: ["pubsub"],
          dependencies: [],
          readiness: 100,
          health: "ACTIVE",
          lifecycle: { hasInitialize: false, hasExecute: false, hasCleanup: false },
          supportedAPIs: [],
          compatibilityVersions: {},
        });
      }).toThrow();
    });
  });

  describe("CapabilityRegistry", () => {
    it("should extract unique capabilities from the module ecosystem", () => {
      const caps = CapabilityRegistry.getAllCapabilities();
      expect(caps.length).toBeGreaterThan(0);
      expect(caps).toContain("pubsub");
      expect(caps).toContain("chaos-injection");
    });

    it("should discover modules offering specific capabilities", () => {
      const providers = CapabilityRegistry.findByCapability("pubsub");
      expect(providers.length).toBe(1);
      expect(providers[0].id).toBe("enterprise-event-bus");
    });

    it("should locate modules exposing specific API signatures", () => {
      const providers = CapabilityRegistry.findByAPI("collectLiveState");
      expect(providers.length).toBe(1);
      expect(providers[0].id).toBe("operations-center");
    });
  });

  describe("ServiceDiscovery", () => {
    it("should allow querying modules by ID, capability, dependency, or API", () => {
      const byId = ServiceDiscovery.discover({ id: "chaos-orchestrator" });
      expect(byId.length).toBe(1);
      expect(byId[0].name).toBe("Chaos Orchestrator");

      const byCap = ServiceDiscovery.discover({ capability: "chaos-injection" });
      expect(byCap.length).toBe(1);
      expect(byCap[0].id).toBe("chaos-orchestrator");

      const byDep = ServiceDiscovery.discover({ dependency: "chaos-orchestrator" });
      expect(byDep.length).toBe(1);
      expect(byDep[0].id).toBe("operational-intelligence");
    });

    it("should locate a single engine directly and return read-only metadata", () => {
      const engine = ServiceDiscovery.locate("operations-center");
      expect(engine).toBeDefined();
      expect(engine?.owner).toBe("GlobalNOC");
      expect(Object.isFrozen(engine)).toBe(true);
    });
  });

  describe("VersionCatalog", () => {
    it("should validate and parse basic semantic version numbers", () => {
      expect(VersionCatalog.isValidSemver("1.2.3")).toBe(true);
      expect(VersionCatalog.isValidSemver("0.1.0-beta.1")).toBe(true);
      expect(VersionCatalog.isValidSemver("invalid-version")).toBe(false);
    });

    it("should check caret and tilde satisfies conditions accurately", () => {
      expect(VersionCatalog.satisfies("1.2.5", "^1.2.0")).toBe(true);
      expect(VersionCatalog.satisfies("1.3.0", "^1.2.0")).toBe(true);
      expect(VersionCatalog.satisfies("2.0.0", "^1.2.0")).toBe(false);

      expect(VersionCatalog.satisfies("1.2.5", "~1.2.0")).toBe(true);
      expect(VersionCatalog.satisfies("1.3.0", "~1.2.0")).toBe(false);

      expect(VersionCatalog.satisfies("1.2.5", "1.2.5")).toBe(true);
      expect(VersionCatalog.satisfies("1.2.5", "1.2.0")).toBe(false);
    });

    it("should audit the registry for semver compatibility", () => {
      const report = VersionCatalog.audit();
      expect(report.isValid).toBe(true);
      expect(report.unsupportedVersions.length).toBe(0);
      expect(report.duplicateVersions.length).toBe(0);
    });
  });

  describe("DependencyCatalog", () => {
    it("should build and return an immutable dependency graph adjacency list", () => {
      const report = DependencyCatalog.audit();
      expect(report.isValid).toBe(true);
      expect(report.graph["chaos-orchestrator"]).toContain("enterprise-event-bus");
      expect(Object.isFrozen(report.graph)).toBe(true);
    });

    it("should flags circular dependencies in SRE architectures", () => {
      // Intentionally introduce a cycle: A -> B -> A
      ModuleRegistry.clear();
      ModuleRegistry.register({
        id: "module-A",
        name: "Module A",
        version: "1.0.0",
        owner: "Team A",
        capabilities: ["A"],
        dependencies: ["module-B"],
        readiness: 100,
        health: "ACTIVE",
        lifecycle: { hasInitialize: false, hasExecute: false, hasCleanup: false },
        supportedAPIs: [],
        compatibilityVersions: {},
      });

      ModuleRegistry.register({
        id: "module-B",
        name: "Module B",
        version: "1.0.0",
        owner: "Team B",
        capabilities: ["B"],
        dependencies: ["module-A"],
        readiness: 100,
        health: "ACTIVE",
        lifecycle: { hasInitialize: false, hasExecute: false, hasCleanup: false },
        supportedAPIs: [],
        compatibilityVersions: {},
      });

      const report = DependencyCatalog.audit();
      expect(report.isValid).toBe(false);
      expect(report.circularDependencies.length).toBeGreaterThan(0);
      expect(report.circularDependencies[0]).toContain("module-A");
      expect(report.circularDependencies[0]).toContain("module-B");
    });

    it("should identify missing dependencies in module registrations", () => {
      ModuleRegistry.clear();
      ModuleRegistry.register({
        id: "broken-module",
        name: "Broken Module",
        version: "1.0.0",
        owner: "SRETeam",
        capabilities: ["risk-analysis"],
        dependencies: ["non-existent-subsystem"],
        readiness: 90,
        health: "ACTIVE",
        lifecycle: { hasInitialize: false, hasExecute: false, hasCleanup: false },
        supportedAPIs: [],
        compatibilityVersions: {},
      });

      const report = DependencyCatalog.audit();
      expect(report.isValid).toBe(false);
      expect(report.missingDependencies.length).toBe(1);
      expect(report.missingDependencies[0].dependencyId).toBe("non-existent-subsystem");
    });
  });

  describe("CompatibilityMatrix", () => {
    it("should verify version matching constraints across default bootstrap engines", () => {
      const report = CompatibilityMatrix.evaluate();
      expect(report.isCompatible).toBe(true);
      expect(report.compatibilityScore).toBe(100);
    });
  });

  describe("PlatformTopology", () => {
    it("should sort registered systems topologically into dependency layers", () => {
      const topology = PlatformTopology.generate();
      expect(topology.topologicalLayers.length).toBe(20);

      // enterprise-event-bus has 0 dependencies, so it must appear before downstream dependants
      const eventBusIndex = topology.topologicalLayers.indexOf("enterprise-event-bus");
      const orchestratorIndex = topology.topologicalLayers.indexOf("chaos-orchestrator");

      expect(eventBusIndex).toBeLessThan(orchestratorIndex);
    });
  });

  describe("PlatformHealth", () => {
    it("should calculate high quantitative scores under standard healthy state", () => {
      const health = PlatformHealth.evaluate();
      expect(health.systemStatus).toBe("HEALTHY");
      expect(health.overallHealthScore).toBeGreaterThanOrEqual(95);
      expect(health.readinessScore).toBeGreaterThanOrEqual(95);
    });

    it("should degrade health classification if compatibility or component health suffers", () => {
      // Degrade health of an engine
      ModuleRegistry.clear();
      ModuleRegistry.register({
        id: "test-critical-node",
        name: "Critical Node",
        version: "1.0.0",
        owner: "SRECore",
        capabilities: ["critical-routing"],
        dependencies: [],
        readiness: 50,
        health: "UNAVAILABLE",
        lifecycle: { hasInitialize: false, hasExecute: false, hasCleanup: false },
        supportedAPIs: [],
        compatibilityVersions: {},
      });

      const health = PlatformHealth.evaluate();
      expect(health.systemStatus).toBe("CRITICAL");
      expect(health.healthScore).toBe(0);
    });
  });

  describe("PlatformKernel & PlatformKernelEngine Façade", () => {
    it("should coordinate full evaluations and trigger Event Bus notifications", async () => {
      const receivedEvents: any[] = [];
      EnterpriseEventBus.subscribe("kernel-test", "PlatformStateAudited", (event) => {
        receivedEvents.push(event);
      });

      const audit = PlatformKernel.evaluate("production");

      expect(audit.context.environment).toBe("production");
      expect(audit.topology.topologicalLayers.length).toBe(20);
      expect(audit.health.systemStatus).toBe("HEALTHY");
      expect(audit.reportMarkdown).toContain("# ENTERPRISE PLATFORM KERNEL & CAPABILITY REGISTRY AUDIT REPORT");

      // Verify notification delivery
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].payload.healthScore).toBeGreaterThanOrEqual(95);
      expect(receivedEvents[0].payload.systemStatus).toBe("HEALTHY");
    });
  });
});
