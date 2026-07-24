import { describe, it, expect, beforeAll } from "vitest";
import { OperationsCenter } from "./OperationsCenter";
import { OperationsDashboard } from "./OperationsDashboard";
import { OperationsTimeline } from "./OperationsTimeline";
import { OperationsTopology } from "./OperationsTopology";
import { OperationsSnapshot } from "./OperationsSnapshot";
import { OperationsAnalytics } from "./OperationsAnalytics";
import { OperationsHealthMatrix } from "./OperationsHealthMatrix";
import { OperationsReporter } from "./OperationsReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise SRE Operations Center Test Suite", () => {
  beforeAll(() => {
    // Ensure we have some test data in the Event Bus history
    EnterpriseEventBus.clear();
    EnterpriseEventBus.publish("SystemStateChanged", { trigger: "Test Boot" }, "corr-test-123");
    EnterpriseEventBus.publish("PredictionCreated", { riskScore: 12 }, "corr-test-123");
  });

  describe("OperationsCenter", () => {
    it("should aggregate live SRE state from all subsystems", () => {
      const state = OperationsCenter.collectLiveState();
      expect(state).toBeDefined();
      expect(state.timestamp).toBeTypeOf("string");
      expect(state.eventBus.historyCount).toBeGreaterThan(0);
      expect(state.controlPlane.healthStatus).toBeDefined();
      expect(state.predictions.activeRiskScore).toBeLessThanOrEqual(100);
      expect(state.decisions.lastDecision).toBeDefined();
      expect(state.recovery.successRate).toBeTypeOf("number");
      expect(state.knowledge.recordCount).toBeTypeOf("number");
    });
  });

  describe("OperationsDashboard", () => {
    it("should compute enterprise-level health and readiness indicators", () => {
      const dashboard = OperationsDashboard.computeDashboard();
      expect(dashboard).toBeDefined();
      expect(dashboard.enterpriseHealthScore).toBeLessThanOrEqual(100);
      expect(dashboard.readinessScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.availability).toBeTypeOf("number");
      expect(dashboard.resilienceGrade).toMatch(/^[A-F](\+)?$/);
      expect(dashboard.predictionRisk).toBeGreaterThanOrEqual(0);
      expect(dashboard.validationStatus).toBeTypeOf("string");
      expect(dashboard.knowledgeCoverage).toBeTypeOf("number");
      expect(dashboard.integrationHealth).toBeTypeOf("number");
    });
  });

  describe("OperationsTimeline", () => {
    it("should reconstruct execution chains from correlationId", () => {
      const chains = OperationsTimeline.reconstructExecutionChains();
      expect(chains).toBeInstanceOf(Array);
      expect(chains.length).toBeGreaterThan(0);
      
      const testChain = chains.find(c => c.correlationId === "corr-test-123");
      expect(testChain).toBeDefined();
      expect(testChain?.events.length).toBe(2);
      expect(testChain?.status).toBe("SUCCESS");
    });

    it("should retrieve a single execution chain by ID", () => {
      const chain = OperationsTimeline.getChainById("corr-test-123");
      expect(chain).toBeDefined();
      expect(chain?.correlationId).toBe("corr-test-123");
    });
  });

  describe("OperationsTopology", () => {
    it("should map control plane engines into a live topological node-edge grid", () => {
      const topology = OperationsTopology.generateTopology();
      expect(topology).toBeDefined();
      expect(topology.nodes.length).toBeGreaterThan(0);
      expect(topology.edges).toBeInstanceOf(Array);
      expect(topology.resolvedOrder).toBeInstanceOf(Array);
      expect(topology.circularDependencies).toBeInstanceOf(Array);
    });
  });

  describe("OperationsSnapshot", () => {
    it("should capture deeply frozen immutable snapshots", () => {
      const snapshot = OperationsSnapshot.takeSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toMatch(/^snap-/);
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.controlPlane)).toBe(true);
      expect(Object.isFrozen(snapshot.historySizes)).toBe(true);

      // Verify immutability prevents property mutations
      expect(() => {
        (snapshot as any).healthScore = 999;
      }).toThrow();
    });
  });

  describe("OperationsAnalytics", () => {
    it("should calculate SRE operational metrics", () => {
      const analytics = OperationsAnalytics.calculateAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.mttrMs).toBeGreaterThan(0);
      expect(analytics.mtbfMs).toBeGreaterThan(0);
      expect(analytics.recoverySuccessRate).toBeTypeOf("number");
      expect(analytics.validationSuccessRate).toBeTypeOf("number");
      expect(analytics.predictionAccuracy).toBeTypeOf("number");
      expect(analytics.failureDistribution).toHaveProperty("Orchestrator");
      expect(analytics.engineActivity).toHaveProperty("SystemStateChanged");
    });
  });

  describe("OperationsHealthMatrix", () => {
    it("should produce a matrix structure of subsystem health records", () => {
      const matrix = OperationsHealthMatrix.generateMatrix();
      expect(matrix).toBeInstanceOf(Array);
      expect(matrix.length).toBeGreaterThan(0);
      
      const firstRow = matrix[0];
      expect(firstRow).toHaveProperty("subsystem");
      expect(firstRow).toHaveProperty("status");
      expect(firstRow).toHaveProperty("readiness");
      expect(firstRow).toHaveProperty("exceptionsCount");
      expect(firstRow).toHaveProperty("activeAlerts");
    });
  });

  describe("OperationsReporter", () => {
    it("should generate beautiful JSON and Executive Markdown reports", () => {
      const report = OperationsReporter.generateReport();
      expect(report).toBeDefined();
      expect(report.architectureScore).toBeLessThanOrEqual(100);
      expect(report.riskScore).toBeLessThanOrEqual(100);
      expect(report.markdown).toContain("🎛️ ENTERPRISE OPERATIONS CENTER EXECUTIVE REPORT");
      expect(report.markdown).toContain("SUBSYSTEM HEALTH MATRIX");
      expect(report.json).toBeTypeOf("string");
      
      const parsed = JSON.parse(report.json);
      expect(parsed).toHaveProperty("architectureScore");
      expect(parsed).toHaveProperty("analytics");
    });
  });
});
