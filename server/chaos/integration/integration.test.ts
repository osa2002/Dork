import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DependencyValidator } from "./DependencyValidator";
import { EventFlowValidator } from "./EventFlowValidator";
import { WorkflowValidator } from "./WorkflowValidator";
import { IntegrationValidator } from "./IntegrationValidator";
import { IntegrationReporter } from "./IntegrationReporter";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { ChaosHistory } from "../orchestrator/ChaosHistory";

describe("Enterprise Integration Validation Suite (Phase 10.16)", () => {
  beforeEach(() => {
    KnowledgeRepository.clear();
    DecisionHistory.clear();
    RecoveryHistory.clear();
    ChaosHistory.clearHistory();
  });

  afterEach(() => {
    KnowledgeRepository.clear();
    DecisionHistory.clear();
    RecoveryHistory.clear();
    ChaosHistory.clearHistory();
  });

  it("should validate that there are zero circular dependencies or duplicate stores", () => {
    const res = DependencyValidator.validate();
    expect(res.success).toBe(true);
    expect(res.circularDependencies.length).toBe(0);
    expect(res.duplicateStores.length).toBe(0);
    expect(res.duplicateRepositories.length).toBe(0);
    expect(res.duplicateEventSources.length).toBe(0);
  });

  it("should validate that event flow is correct and preserves key SRE values", async () => {
    const res = await EventFlowValidator.validate();
    expect(res.success).toBe(true);
    expect(res.duplicateEvents.length).toBe(0);
    expect(res.preservedFields.correlationId).toBe(true);
    expect(res.preservedFields.executionId).toBe(true);
    expect(res.preservedFields.timestamp).toBe(true);
  });

  it("should validate all system lifecycles inside the workflow suite", async () => {
    const res = await WorkflowValidator.validate();
    expect(res.success).toBe(true);
    expect(res.experimentLifecycle.success).toBe(true);
    expect(res.rollbackLifecycle.success).toBe(true);
    expect(res.decisionLifecycle.success).toBe(true);
    expect(res.recoveryLifecycle.success).toBe(true);
    expect(res.knowledgeLifecycle.success).toBe(true);
    expect(res.predictionLifecycle.success).toBe(true);
  });

  it("should validate the complete end-to-end integration lifecycle", async () => {
    const res = await IntegrationValidator.validateEndToEnd();
    expect(res.success).toBe(true);
    expect(res.steps.chaosExperimentRun).toBe(true);
    expect(res.steps.orchestratorExecuted).toBe(true);
    expect(res.steps.governanceCaptured).toBe(true);
    expect(res.steps.knowledgeStored).toBe(true);
    expect(res.steps.predictionGenerated).toBe(true);
    expect(res.steps.decisionEvaluated).toBe(true);
    expect(res.steps.recoveryHandled).toBe(true);
    expect(res.steps.eventBusDispatched).toBe(true);
    expect(res.steps.dashboardCompiled).toBe(true);
  });

  it("should generate a beautifully formatted enterprise reporter suite", async () => {
    const { report, markdown } = await IntegrationReporter.generateReport();
    expect(report.enterpriseReadyScore).toBe(100);
    expect(report.architectureValidated).toBe(true);
    expect(markdown).toContain("# 🛠️ ENTERPRISE CHAOS PLATFORM INTEGRATION REPORT");
    expect(markdown).toContain("Enterprise Readiness Score:");
    expect(markdown).toContain("🟩 READY FOR ENTERPRISE");
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
