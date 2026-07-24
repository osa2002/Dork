import { IChaosExperiment } from "../experiments/IChaosExperiment";
import { ChaosExecutionPlan } from "../orchestrator/ChaosExecutionPlan";
import { ChaosOrchestrator } from "../orchestrator/ChaosOrchestrator";
import { ChaosHistory } from "../orchestrator/ChaosHistory";
import { DecisionEngine } from "../autonomous/DecisionEngine";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { DecisionContextBuilder } from "../autonomous/DecisionContext";
import { RecoveryEngine } from "../recovery/RecoveryEngine";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { RecoveryResult } from "../recovery/RecoveryResult";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { KnowledgeRecord } from "../knowledge/KnowledgeRecord";
import { KnowledgeInsights } from "../knowledge/KnowledgeInsights";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { PredictionModel } from "../prediction/PredictionModel";

export interface WorkflowValidationResult {
  success: boolean;
  experimentLifecycle: { success: boolean; trace: string[] };
  rollbackLifecycle: { success: boolean; trace: string[] };
  recoveryLifecycle: { success: boolean; recoveryId?: string; status?: string };
  knowledgeLifecycle: { success: boolean; recordsCount: number };
  predictionLifecycle: { success: boolean; confidence?: number; riskScore?: number };
  decisionLifecycle: { success: boolean; decision?: string };
}

export class WorkflowValidator {
  /**
   * Evaluates and validates every operational lifecycle of the platform in-memory.
   */
  public static async validate(): Promise<WorkflowValidationResult> {
    const backupChaosMode = process.env.CHAOS_MODE;
    process.env.CHAOS_MODE = "true"; // Temporarily allow execution for the validation loop

    const results: Partial<WorkflowValidationResult> = {};

    try {
      // 1. Validate Experiment Lifecycle
      const expTrace: string[] = [];
      const testExperiment: IChaosExperiment = {
        name: "Validator Test Experiment",
        description: "Standard validator test experiment description",
        riskLevel: "Low",
        blastRadius: "Minimal",
        automaticRollback: true,
        manualRollback: "Self-heal reset",
        expectedMetrics: [],
        expectedTelemetry: [],
        expectedRecovery: "Auto healing",
        estimatedExecutionDuration: 10,
        prepare: async () => { expTrace.push("prepare"); },
        execute: async () => { expTrace.push("execute"); },
        verify: async () => { expTrace.push("verify"); return true; },
        rollback: async () => { expTrace.push("rollback"); },
        cleanup: async () => { expTrace.push("cleanup"); },
      };

      const plan = new ChaosExecutionPlan();
      plan.addExperiment(testExperiment);

      await ChaosOrchestrator.executePlan(plan, undefined, { correlationId: "validator-corr" });
      
      const expSuccess = 
        expTrace.includes("prepare") && 
        expTrace.includes("execute") && 
        expTrace.includes("verify") && 
        expTrace.includes("cleanup");

      results.experimentLifecycle = {
        success: expSuccess,
        trace: expTrace,
      };

      // 2. Validate Rollback Lifecycle (verification fails, triggers rollback)
      const rollTrace: string[] = [];
      const rollbackExperiment: IChaosExperiment = {
        name: "Validator Rollback Experiment",
        description: "Simulates failure to trigger automatic rollbacks",
        riskLevel: "Low",
        blastRadius: "Minimal",
        automaticRollback: true,
        manualRollback: "Manual reset path",
        expectedMetrics: [],
        expectedTelemetry: [],
        expectedRecovery: "Auto rollback on verification failure",
        estimatedExecutionDuration: 10,
        prepare: async () => { rollTrace.push("prepare"); },
        execute: async () => { rollTrace.push("execute"); },
        verify: async () => { rollTrace.push("verify"); return false; }, // FAILS
        rollback: async () => { rollTrace.push("rollback"); },
        cleanup: async () => { rollTrace.push("cleanup"); },
      };

      const rollPlan = new ChaosExecutionPlan();
      rollPlan.addExperiment(rollbackExperiment);

      await ChaosOrchestrator.executePlan(rollPlan, undefined, { correlationId: "validator-corr-roll" });

      const rollSuccess = 
        rollTrace.includes("prepare") && 
        rollTrace.includes("execute") && 
        rollTrace.includes("verify") && 
        rollTrace.includes("rollback") && 
        rollTrace.includes("cleanup");

      results.rollbackLifecycle = {
        success: rollSuccess,
        trace: rollTrace,
      };

      // 3. Validate Decision Lifecycle
      const decision: AutonomousDecision = DecisionEngine.evaluate();
      results.decisionLifecycle = {
        success: decision && typeof decision.decision === "string",
        decision: decision?.decision,
      };

      // 4. Validate Recovery Lifecycle
      // Feed simulated decision to the recovery engine
      const compiledContext = DecisionContextBuilder.compileContext();
      const simulatedDecision: AutonomousDecision = {
        id: `dec-sim-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toISOString(),
        decision: "ROLLBACK",
        confidence: 99,
        reasoning: "Synthetic verification fallback",
        context: compiledContext,
        evidence: ["Triggered by workflow validator"],
      };

      const recoveryRes: RecoveryResult = await RecoveryEngine.handleDecision(simulatedDecision, {
        isProductionSafetyEnabled: false, // Bypass safety gates for verification run
        isChaosModeSafetyEnabled: false,
      });

      results.recoveryLifecycle = {
        success: recoveryRes && typeof recoveryRes.recoveryId === "string",
        recoveryId: recoveryRes?.recoveryId,
        status: recoveryRes?.status,
      };

      // 5. Validate Knowledge Lifecycle
      const initialCount = KnowledgeRepository.getAll().length;
      const mockRecord: KnowledgeRecord = {
        id: `rec-validation-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date().toISOString(),
        experimentId: "validator-test",
        experimentName: "Validator Test",
        workflow: "Self-Healing Playbook",
        decision: "ROLLBACK",
        recovery: null,
        health: { status: "HEALTHY", impactScore: 0, reason: "Normal", activeScenarios: [], latencyAddedMs: 0, injectionProbability: 0 },
        impact: 0,
        blastRadius: "Minimal",
        SLO: {
          availability: { target: 99.9, actual: 100, errorBudgetRemaining: 10.0, totalRequests: 100, failedRequests: 0 },
          latency: { targetMs: 200, actualP95Ms: 15 },
          apiResponseTime: { targetMs: 300, actualP95Ms: 20 },
          queueProcessingTime: { targetSeconds: 10, actualSeconds: 1 },
          ticketCreationTime: { targetMs: 100, actualMs: 5 },
          aiResponseTime: { targetMs: 2000, actualMs: 200 },
          paymentLatency: { targetMs: 1000, actualMs: 50 },
        },
        MTTR: 0,
        rollback: { occurred: false, durationMs: 0, success: true },
        incidentId: "none",
        enterpriseScore: {
          reliabilityScore: 100,
          resilienceScore: 100,
          recoverabilityScore: 100,
          observabilityScore: 100,
          operationalReadiness: 100,
          overallEnterpriseScore: 100,
          letterGrade: "A",
        },
        dependencyGraphSnapshot: { nodes: [], edges: [] },
        correlationId: "corr-validation",
        status: "SUCCESS",
        tags: ["validation"],
        metadata: {},
      };

      KnowledgeRepository.add(mockRecord);
      const afterCount = KnowledgeRepository.getAll().length;
      const insights = KnowledgeInsights.generate();

      results.knowledgeLifecycle = {
        success: afterCount > initialCount && insights !== null,
        recordsCount: afterCount,
      };

      // 6. Validate Prediction Lifecycle
      const prediction: PredictionModel = PredictionEngine.generatePrediction("FAILURE_PROBABILITY", "corr-validation-pred");
      
      results.predictionLifecycle = {
        success: prediction && typeof prediction.predictionId === "string",
        confidence: prediction?.confidence,
        riskScore: prediction?.riskScore,
      };

    } finally {
      // Revert env variables
      process.env.CHAOS_MODE = backupChaosMode;
    }

    const success = !!(
      results.experimentLifecycle?.success &&
      results.rollbackLifecycle?.success &&
      results.recoveryLifecycle?.success &&
      results.knowledgeLifecycle?.success &&
      results.predictionLifecycle?.success &&
      results.decisionLifecycle?.success
    );

    return {
      success,
      experimentLifecycle: results.experimentLifecycle!,
      rollbackLifecycle: results.rollbackLifecycle!,
      recoveryLifecycle: results.recoveryLifecycle!,
      knowledgeLifecycle: results.knowledgeLifecycle!,
      predictionLifecycle: results.predictionLifecycle!,
      decisionLifecycle: results.decisionLifecycle!,
    };
  }
}
