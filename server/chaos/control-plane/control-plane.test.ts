import { describe, it, expect, beforeEach, vi } from "vitest";
import { ControlPlaneRegistry } from "./ControlPlaneRegistry";
import { DependencyResolver } from "./DependencyResolver";
import { HealthCoordinator } from "./HealthCoordinator";
import { ExecutionCoordinator, ExecutionTask } from "./ExecutionCoordinator";
import { ControlPlaneReporter } from "./ControlPlaneReporter";
import { OperationalControlPlane } from "./OperationalControlPlane";
import { EngineDescriptor } from "./EngineDescriptor";

describe("Phase 10.19 - Enterprise Operational Control Plane", () => {
  beforeEach(() => {
    // Reset control plane registry to standard bootstrap engines
    ControlPlaneRegistry.resetToDefault();
  });

  describe("Engine Registry", () => {
    it("should successfully bootstrap the 12 target systems automatically", () => {
      const engines = ControlPlaneRegistry.getAll();
      expect(engines.length).toBe(12);

      const ids = engines.map((e) => e.id);
      const expectedIds = [
        "enterprise-event-bus",
        "chaos-orchestrator",
        "operational-intelligence",
        "governance",
        "knowledge-engine",
        "knowledge-intelligence",
        "prediction-engine",
        "digital-twin",
        "decision-engine",
        "recovery-engine",
        "continuous-validation-platform",
        "integration-validator"
      ];

      expectedIds.forEach((id) => {
        expect(ids).toContain(id);
      });
    });

    it("should register and unregister custom engines with correct properties", () => {
      const customEngine: EngineDescriptor = {
        id: "custom-sandbox",
        name: "Custom Testing Sandbox",
        version: "2.1.0",
        status: "ACTIVE",
        owner: "QAAutomationTeam",
        capabilities: ["simulation-sandbox", "smoke-test"],
        dependencies: ["enterprise-event-bus"],
        compatibilityMatrix: { "enterprise-event-bus": "^1.2.0" },
        priority: 10,
        instance: {},
        lifecycle: {}
      };

      ControlPlaneRegistry.register(customEngine);
      expect(ControlPlaneRegistry.get("custom-sandbox")).toBeDefined();
      expect(ControlPlaneRegistry.getAll().length).toBe(13);

      const found = ControlPlaneRegistry.findByCapability("simulation-sandbox");
      expect(found.length).toBe(1);
      expect(found[0].id).toBe("custom-sandbox");

      const unregistered = ControlPlaneRegistry.unregister("custom-sandbox");
      expect(unregistered).toBe(true);
      expect(ControlPlaneRegistry.get("custom-sandbox")).toBeUndefined();
    });

    it("should prevent duplicate engine registration with the same ID", () => {
      const duplicate: EngineDescriptor = {
        id: "chaos-orchestrator",
        name: "Fake Orchestrator",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "HackerTeam",
        capabilities: [],
        dependencies: [],
        compatibilityMatrix: {},
        priority: 1,
        instance: {},
        lifecycle: {}
      };

      expect(() => ControlPlaneRegistry.register(duplicate)).toThrow();
    });
  });

  describe("Dependency Resolver", () => {
    it("should correctly resolve version compatibility using satisfies", () => {
      // ^ Range matching (same major, >= minor)
      expect(DependencyResolver.satisfies("1.2.5", "^1.2.0")).toBe(true);
      expect(DependencyResolver.satisfies("1.3.0", "^1.2.0")).toBe(true);
      expect(DependencyResolver.satisfies("2.0.0", "^1.2.0")).toBe(false);
      expect(DependencyResolver.satisfies("1.1.0", "^1.2.0")).toBe(false);

      // >= range matching
      expect(DependencyResolver.satisfies("2.0.0", ">=1.0.0")).toBe(true);
      expect(DependencyResolver.satisfies("1.0.0", ">=1.0.0")).toBe(true);
      expect(DependencyResolver.satisfies("0.9.0", ">=1.0.0")).toBe(false);

      // Wildcard and empty range
      expect(DependencyResolver.satisfies("5.6.7", "*")).toBe(true);
      expect(DependencyResolver.satisfies("5.6.7", "")).toBe(true);
    });

    it("should compile a valid dependency graph and topological sorted order for default engines", () => {
      const engines = ControlPlaneRegistry.getAll();
      const report = DependencyResolver.resolve(engines);

      expect(report.success).toBe(true);
      expect(report.cycles.length).toBe(0);
      expect(report.missing.length).toBe(0);
      expect(report.incompatible.length).toBe(0);
      expect(report.resolvedOrder.length).toBe(12);

      // Verify that dependencies come before dependants in resolvedOrder
      const eventBusIdx = report.resolvedOrder.indexOf("enterprise-event-bus");
      const orchestratorIdx = report.resolvedOrder.indexOf("chaos-orchestrator");
      const validationIdx = report.resolvedOrder.indexOf("continuous-validation-platform");

      expect(eventBusIdx).toBeLessThan(orchestratorIdx);
      expect(orchestratorIdx).toBeLessThan(validationIdx);
    });

    it("should detect missing dependencies correctly", () => {
      ControlPlaneRegistry.clear();
      ControlPlaneRegistry.register({
        id: "broken-engine",
        name: "Broken Engine",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "Tester",
        capabilities: [],
        dependencies: ["missing-engine-target"],
        compatibilityMatrix: {},
        priority: 1,
        instance: {},
        lifecycle: {}
      });

      const report = DependencyResolver.resolve(ControlPlaneRegistry.getAll());
      expect(report.success).toBe(false);
      expect(report.missing.length).toBe(1);
      expect(report.missing[0].engineId).toBe("missing-engine-target");
      expect(report.missing[0].dependentId).toBe("broken-engine");
    });

    it("should detect cycles (circular dependencies)", () => {
      ControlPlaneRegistry.clear();
      ControlPlaneRegistry.register({
        id: "engine-a",
        name: "A",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "T",
        capabilities: [],
        dependencies: ["engine-b"],
        compatibilityMatrix: {},
        priority: 1,
        instance: {},
        lifecycle: {}
      });
      ControlPlaneRegistry.register({
        id: "engine-b",
        name: "B",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "T",
        capabilities: [],
        dependencies: ["engine-a"],
        compatibilityMatrix: {},
        priority: 1,
        instance: {},
        lifecycle: {}
      });

      const report = DependencyResolver.resolve(ControlPlaneRegistry.getAll());
      expect(report.success).toBe(false);
      expect(report.cycles.length).toBeGreaterThan(0);
      expect(report.cycles[0]).toContain("engine-a");
      expect(report.cycles[0]).toContain("engine-b");
    });

    it("should detect incompatible versions based on compatibilityMatrix constraints", () => {
      ControlPlaneRegistry.clear();
      ControlPlaneRegistry.register({
        id: "dep-engine",
        name: "Dependency Engine",
        version: "2.0.0", // actual is v2.0.0
        status: "ACTIVE",
        owner: "T",
        capabilities: [],
        dependencies: [],
        compatibilityMatrix: {},
        priority: 10,
        instance: {},
        lifecycle: {}
      });
      ControlPlaneRegistry.register({
        id: "dependent-engine",
        name: "Dependent Engine",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "T",
        capabilities: [],
        dependencies: ["dep-engine"],
        compatibilityMatrix: { "dep-engine": "^1.5.0" }, // requires ^1.5.0, incompatible with v2.0.0
        priority: 1,
        instance: {},
        lifecycle: {}
      });

      const report = DependencyResolver.resolve(ControlPlaneRegistry.getAll());
      expect(report.success).toBe(false);
      expect(report.incompatible.length).toBe(1);
      expect(report.incompatible[0].engineId).toBe("dep-engine");
      expect(report.incompatible[0].dependentId).toBe("dependent-engine");
      expect(report.incompatible[0].required).toBe("^1.5.0");
      expect(report.incompatible[0].actual).toBe("2.0.0");
    });

    it("should audit duplicate ownership across instances", () => {
      ControlPlaneRegistry.clear();
      const sharedInst = {};
      ControlPlaneRegistry.register({
        id: "engine-x",
        name: "X",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "DorkHQ",
        capabilities: [],
        dependencies: [],
        compatibilityMatrix: {},
        priority: 1,
        instance: sharedInst,
        lifecycle: {}
      });
      ControlPlaneRegistry.register({
        id: "engine-y",
        name: "Y",
        version: "1.0.0",
        status: "ACTIVE",
        owner: "DorkHQ",
        capabilities: [],
        dependencies: [],
        compatibilityMatrix: {},
        priority: 1,
        instance: sharedInst, // Duplicate instance reference
        lifecycle: {}
      });

      const report = DependencyResolver.resolve(ControlPlaneRegistry.getAll());
      expect(report.duplicateOwnership.length).toBeGreaterThan(0);
      expect(report.duplicateOwnership.some((d) => d.engines.includes("engine-x") && d.engines.includes("engine-y"))).toBe(true);
    });
  });

  describe("Health Coordinator", () => {
    it("should evaluate default bootstrapped engines as fully healthy", () => {
      const summary = HealthCoordinator.evaluateHealth(ControlPlaneRegistry.getAll());

      expect(summary.overallHealth).toBe("HEALTHY");
      expect(summary.operationalReadiness).toBe(100);
      expect(summary.dependencyHealth.success).toBe(true);
      expect(summary.dependencyHealth.missingDependenciesCount).toBe(0);
      expect(summary.dependencyHealth.unresolvedCyclesCount).toBe(0);
    });

    it("should deduct readiness and degrade status when engines are UNAVAILABLE or DEGRADED", () => {
      ControlPlaneRegistry.clear();
      ControlPlaneRegistry.register({
        id: "test-engine-1",
        name: "Engine 1",
        version: "1.0.0",
        status: "UNAVAILABLE", // UNAVAILABLE triggers -25 deduction
        owner: "QA",
        capabilities: [],
        dependencies: [],
        compatibilityMatrix: {},
        priority: 1,
        instance: {},
        lifecycle: {}
      });
      ControlPlaneRegistry.register({
        id: "test-engine-2",
        name: "Engine 2",
        version: "1.0.0",
        status: "DEGRADED", // DEGRADED triggers -10 deduction
        owner: "QA",
        capabilities: [],
        dependencies: [],
        compatibilityMatrix: {},
        priority: 1,
        instance: {},
        lifecycle: {}
      });

      const summary = HealthCoordinator.evaluateHealth(ControlPlaneRegistry.getAll());
      expect(summary.operationalReadiness).toBe(65); // 100 - 25 - 10 = 65
      expect(summary.overallHealth).toBe("DEGRADED");
    });
  });

  describe("Execution Coordinator", () => {
    const mockCtx = {
      controlPlaneId: "cp-test",
      timestamp: new Date().toISOString(),
      correlationId: "corr-test",
      executionMode: "SEQUENTIAL" as const
    };

    it("should support sequential and priority-aware execution order", async () => {
      const executionOrder: string[] = [];

      const tasks: ExecutionTask[] = [
        {
          id: "task-low",
          engineId: "eng-1",
          name: "Low Priority Task",
          priority: 5,
          action: async () => {
            executionOrder.push("low");
          }
        },
        {
          id: "task-high",
          engineId: "eng-2",
          name: "High Priority Task",
          priority: 100,
          action: async () => {
            executionOrder.push("high");
          }
        }
      ];

      const report = await ExecutionCoordinator.coordinate(tasks, mockCtx);
      expect(report.success).toBe(true);
      expect(report.passedCount).toBe(2);
      expect(executionOrder).toEqual(["high", "low"]);
    });

    it("should support parallel execution concurrently", async () => {
      const tasks: ExecutionTask[] = [
        {
          id: "task-1",
          engineId: "eng-1",
          name: "Task 1",
          action: async () => {
            await new Promise((r) => setTimeout(r, 5));
            return "out1";
          }
        },
        {
          id: "task-2",
          engineId: "eng-2",
          name: "Task 2",
          action: async () => {
            await new Promise((r) => setTimeout(r, 5));
            return "out2";
          }
        }
      ];

      const parallelCtx = { ...mockCtx, executionMode: "PARALLEL" as const };
      const report = await ExecutionCoordinator.coordinate(tasks, parallelCtx);

      expect(report.success).toBe(true);
      expect(report.passedCount).toBe(2);
      expect(report.tasks[0].status).toBe("PASSED");
      expect(report.tasks[1].status).toBe("PASSED");
    });

    it("should support conditional task gating (skipping tasks)", async () => {
      let runFlag = false;

      const tasks: ExecutionTask[] = [
        {
          id: "task-skipped",
          engineId: "eng-1",
          name: "Skipped Task",
          condition: async () => false,
          action: async () => {
            runFlag = true;
          }
        }
      ];

      const report = await ExecutionCoordinator.coordinate(tasks, mockCtx);
      expect(report.success).toBe(true);
      expect(report.skippedCount).toBe(1);
      expect(report.passedCount).toBe(0);
      expect(runFlag).toBe(false);
      expect(report.tasks[0].status).toBe("SKIPPED");
    });

    it("should support dependency-aware execution and skip children if dependencies fail", async () => {
      const executionOrder: string[] = [];

      const tasks: ExecutionTask[] = [
        {
          id: "task-root",
          engineId: "eng-1",
          name: "Root Task",
          action: async () => {
            throw new Error("Root failed!");
          }
        },
        {
          id: "task-child",
          engineId: "eng-2",
          name: "Child Task",
          dependencies: ["task-root"],
          action: async () => {
            executionOrder.push("child");
          }
        }
      ];

      const depCtx = { ...mockCtx, executionMode: "DEPENDENCY_AWARE" as const };
      const report = await ExecutionCoordinator.coordinate(tasks, depCtx, { failFast: false });

      expect(report.success).toBe(false);
      expect(report.failedCount).toBe(1);
      expect(report.skippedCount).toBe(1);
      expect(executionOrder).not.toContain("child");
    });
  });

  describe("Control Plane Reporter", () => {
    it("should compile beautiful compliant SRE report outputs and structured JSON payloads", () => {
      const engines = ControlPlaneRegistry.getAll();
      const health = HealthCoordinator.evaluateHealth(engines);
      const dependencies = DependencyResolver.resolve(engines);

      const report = ControlPlaneReporter.generateReport(engines, health, dependencies);

      expect(report.json).toBeDefined();
      expect(report.json.overallHealth).toBe("HEALTHY");
      expect(report.json.readinessScore).toBe(100);
      expect(report.json.topologySummary.totalEngines).toBe(12);

      expect(report.markdown).toContain("# 🎛️ DORK ENTERPRISE OPERATIONAL CONTROL PLANE REPORT");
      expect(report.markdown).toContain("SREIntelligenceTeam");
      expect(report.markdown).toContain("Resolved Topological Execution Order");
    });
  });

  describe("Operational Control Plane Facade (E2E Integration)", () => {
    it("should execute fully coordinates, audits, compiles, and registers events on the event bus", async () => {
      const tasks: ExecutionTask[] = [
        {
          id: "e2e-t1",
          engineId: "chaos-orchestrator",
          name: "Audit Trigger Task",
          action: async () => "Triggered"
        }
      ];

      const out = await OperationalControlPlane.coordinateExecution("SEQUENTIAL", tasks);

      expect(out.executionId).toBeDefined();
      expect(out.session.success).toBe(true);
      expect(out.session.passedCount).toBe(1);
      expect(out.health.overallHealth).toBe("HEALTHY");
      expect(out.report.markdown).toContain("CONTROL PLANE REPORT");
    });
  });

  describe("Memory Safety & Stateless Execution (Cloud Run Compatibility)", () => {
    it("should execute repeatedly in isolation without shared memory leaks or stale context issues", async () => {
      const run1 = await OperationalControlPlane.coordinateExecution("SEQUENTIAL", [
        {
          id: "test-m1",
          engineId: "governance",
          name: "Stateless Audit Run 1",
          action: async () => 42
        }
      ]);

      const run2 = await OperationalControlPlane.coordinateExecution("SEQUENTIAL", [
        {
          id: "test-m2",
          engineId: "governance",
          name: "Stateless Audit Run 2",
          action: async () => 100
        }
      ]);

      expect(run1.executionId).not.toBe(run2.executionId);
      expect(run1.session.tasks[0].taskId).toBe("test-m1");
      expect(run2.session.tasks[0].taskId).toBe("test-m2");
      expect(run1.session.tasks[0].output).toBe(42);
      expect(run2.session.tasks[0].output).toBe(100);
    });
  });
});
