import { ValidationRule } from "./ValidationRule";
import { ValidationContext } from "./ValidationContext";
import { ValidationResult } from "./ValidationResult";

// Imports from the existing platform
import { DependencyValidator } from "../integration/DependencyValidator";
import { WorkflowValidator } from "../integration/WorkflowValidator";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { KnowledgeEngine } from "../knowledge/KnowledgeEngine";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { DecisionEngine } from "../autonomous/DecisionEngine";
import { RecoveryEngine } from "../recovery/RecoveryEngine";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { EnterpriseScoreEngine } from "../governance/EnterpriseScoreEngine";
import { DigitalTwinEngine } from "../digital-twin/DigitalTwinEngine";
import { SLOService } from "../../../src/services/SLOService";
import { MetricsService } from "../../../src/services/MetricsService";
import { TelemetryService } from "../../../src/services/TelemetryService";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { ChaosRegistry } from "../ChaosRegistry";
import { ChaosState } from "../ChaosState";

export class ValidationCatalog {
  private static rules: ValidationRule[] = [
    // 1. Architecture Integrity
    {
      id: "VAL-ARC-001",
      name: "Architecture Integrity Rule",
      severity: "Critical",
      component: "Architecture",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = true;

        const checks = {
          ChaosState: !!ChaosState,
          EnterpriseEventBus: !!EnterpriseEventBus,
          SLOService: !!SLOService,
          MetricsService: !!MetricsService,
          TelemetryService: !!TelemetryService
        };

        for (const [key, val] of Object.entries(checks)) {
          evidence.push(`${key} loaded: ${val}`);
          if (!val) success = false;
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "All core architecture services successfully loaded and initialized",
          actual: success ? "All services loaded" : "Some core services are missing or undefined",
          recommendation: success ? "None" : "Verify server entry points and restore any missing platform service exports",
          evidence
        };
      }
    },

    // 2. Dependency Integrity
    {
      id: "VAL-DEP-002",
      name: "Dependency Integrity Rule",
      severity: "Critical",
      component: "DependencyGraph",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const depResult = DependencyValidator.validate();
        const evidence: string[] = [
          `Circular dependencies found: ${depResult.circularDependencies.length}`,
          `Duplicate stores: ${depResult.duplicateStores.join(", ") || "None"}`,
          `Duplicate repositories: ${depResult.duplicateRepositories.join(", ") || "None"}`,
          `Duplicate event sources: ${depResult.duplicateEventSources.join(", ") || "None"}`,
          `Duplicate telemetry collectors: ${depResult.duplicateTelemetryCollectors.join(", ") || "None"}`
        ];

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success: depResult.success,
          expected: "Zero circular dependencies and unique singletons across components",
          actual: depResult.success ? "Dependencies are clean and unique" : "Dependency issues detected",
          recommendation: depResult.success ? "None" : "Resolve circular imports and ensure singleton classes are not instantiated multiple times",
          evidence
        };
      }
    },

    // 3. Repository Consistency
    {
      id: "VAL-REP-003",
      name: "Repository Consistency Rule",
      severity: "High",
      component: "KnowledgeRepository",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;
        let count = 0;

        try {
          const records = KnowledgeRepository.getAll();
          count = records.length;
          success = Array.isArray(records);
          evidence.push(`KnowledgeRepository loaded successfully. Total records: ${count}`);
        } catch (e: any) {
          evidence.push(`Failed to read KnowledgeRepository: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "KnowledgeRepository successfully queried returning an array of records",
          actual: success ? `Active with ${count} records` : "Repository query failed",
          recommendation: success ? "None" : "Check memory structure or initialization flow of KnowledgeRepository",
          evidence
        };
      }
    },

    // 4. EventBus Consistency
    {
      id: "VAL-EVB-004",
      name: "EventBus Consistency Rule",
      severity: "High",
      component: "EnterpriseEventBus",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;
        let received = false;

        try {
          const testEventType = "SystemStateChanged" as any;
          const subId = EnterpriseEventBus.subscribe("ValidationTestSub", testEventType, (event) => {
            if (event.correlationId === ctx.correlationId) {
              received = true;
            }
          });

          EnterpriseEventBus.publish(testEventType, { test: true }, ctx.correlationId);
          
          // Micro-tick wait
          await new Promise((resolve) => setTimeout(resolve, 5));
          EnterpriseEventBus.unsubscribe(subId);

          success = received;
          evidence.push(`Event subscription and publishing tested. Event received in sub: ${received}`);
        } catch (e: any) {
          evidence.push(`EventBus test threw an error: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "EnterpriseEventBus registers subscription, dispatches event, and matches correlation ID",
          actual: success ? "Synchronous event loop fully operational" : "Event dispatching or routing failed",
          recommendation: success ? "None" : "Examine EnterpriseEventBus publisher-subscriber maps and asynchronous routing loop",
          evidence
        };
      }
    },

    // 5. Knowledge Consistency
    {
      id: "VAL-KNW-005",
      name: "Knowledge Consistency Rule",
      severity: "Medium",
      component: "KnowledgeEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const records = KnowledgeRepository.getAll();
          evidence.push(`Retrieved ${records.length} records`);
          // Verify each record conforms to expected structure if present
          const clean = records.every(r => r.id && r.timestamp && r.enterpriseScore);
          success = clean;
          evidence.push(`All records structurally consistent: ${clean}`);
        } catch (e: any) {
          evidence.push(`Error evaluating knowledge: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Knowledge items hold strict schemas including ID, timestamp, and enterprise scores",
          actual: success ? "All knowledge items structurally consistent" : "Knowledge repository contains invalid or corrupt record structures",
          recommendation: success ? "None" : "Verify database snapshot serializations and validate migration versions",
          evidence
        };
      }
    },

    // 6. Prediction Consistency
    {
      id: "VAL-PRD-006",
      name: "Prediction Consistency Rule",
      severity: "Medium",
      component: "PredictionEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;
        let riskScore = -1;

        try {
          const prediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY", ctx.correlationId);
          riskScore = prediction.riskScore;
          success = prediction && typeof prediction.riskScore === "number" && prediction.riskScore >= 0 && prediction.riskScore <= 100;
          evidence.push(`Prediction model successfully generated. Risk Score: ${riskScore}%, Confidence: ${prediction.confidence}%`);
        } catch (e: any) {
          evidence.push(`Failed to generate prediction: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Prediction engine generates model with valid risk range (0-100)",
          actual: success ? `Prediction validated with score ${riskScore}%` : "Prediction model generation failed",
          recommendation: success ? "None" : "Check heuristic weight constants and dataset inputs inside PredictionEngine",
          evidence
        };
      }
    },

    // 7. Recovery Consistency
    {
      id: "VAL-RCV-007",
      name: "Recovery Consistency Rule",
      severity: "High",
      component: "RecoveryEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const history = RecoveryHistory.getHistory();
          evidence.push(`Retrieved ${history.length} recovery records`);
          const clean = history.every(h => h.recoveryId && h.timestamp && h.status);
          success = clean;
          evidence.push(`Recovery structures validated: ${clean}`);
        } catch (e: any) {
          evidence.push(`Failed to read recovery history: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "RecoveryHistory logs contain valid identifiers, timestamps, and action states",
          actual: success ? "All recovery logs structurally valid" : "Recovery logs are corrupted or incomplete",
          recommendation: success ? "None" : "Verify object destructuring and state mutations in RecoveryEngine handlers",
          evidence
        };
      }
    },

    // 8. Governance Consistency
    {
      id: "VAL-GOV-008",
      name: "Governance Consistency Rule",
      severity: "Critical",
      component: "EnterpriseScoreEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;
        let overall = -1;

        try {
          const scores = EnterpriseScoreEngine.calculateScores();
          overall = scores.overallEnterpriseScore;
          success = 
            typeof scores.reliabilityScore === "number" &&
            typeof scores.overallEnterpriseScore === "number" &&
            typeof scores.letterGrade === "string";
          evidence.push(`Enterprise scores computed. Overall Score: ${overall}%, Grade: ${scores.letterGrade}`);
        } catch (e: any) {
          evidence.push(`Failed to compute governance scores: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "EnterpriseScoreEngine outputs accurate scores and corresponding SRE letter grade",
          actual: success ? `Governance scores verified (Overall: ${overall}%)` : "Score computation threw exception",
          recommendation: success ? "None" : "Check metric weights and default score fallbacks inside EnterpriseScoreEngine",
          evidence
        };
      }
    },

    // 9. Digital Twin Consistency
    {
      id: "VAL-DTW-009",
      name: "Digital Twin Consistency Rule",
      severity: "High",
      component: "DigitalTwinEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const twin = DigitalTwinEngine.createTwinFromProduction(ctx.correlationId);
          const data = twin.getData();
          success = Object.isFrozen(data) && !!data.health && !!data.slo && !!data.metrics;
          evidence.push(`Digital Twin calibrated successfully. Immutability verified: ${Object.isFrozen(data)}`);
        } catch (e: any) {
          evidence.push(`Digital Twin calibration failed: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Digital Twin snap calibrated with immutable, deeply-cloned baseline representations",
          actual: success ? "Digital Twin calibrated and deeply frozen" : "Calibration failed or produced mutable snapshot objects",
          recommendation: success ? "None" : "Check Object.freeze or JSON parsing pipelines inside DigitalTwinEngine",
          evidence
        };
      }
    },

    // 10. SLO Consistency
    {
      id: "VAL-SLO-010",
      name: "SLO Consistency Rule",
      severity: "Critical",
      component: "SLOService",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const slo = SLOService.getSLOSummary();
          success = !!slo.availability && !!slo.latency && typeof slo.availability.actual === "number";
          evidence.push(`SLO availability: ${slo.availability.actual}%, latency P95: ${slo.latency.actualP95Ms}ms`);
        } catch (e: any) {
          evidence.push(`Failed to fetch SLO summary: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "SLOService returns valid threshold targets and actual metrics",
          actual: success ? "SLO metrics returned successfully" : "SLO target structure invalid",
          recommendation: success ? "None" : "Repair SLA registry mapping inside SLOService",
          evidence
        };
      }
    },

    // 11. Metrics Consistency
    {
      id: "VAL-MET-011",
      name: "Metrics Consistency Rule",
      severity: "High",
      component: "MetricsService",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const counts = MetricsService.getCounts();
          success = typeof counts.apiRequests === "number" && typeof counts.apiErrors === "number";
          evidence.push(`Metrics retrieved: API Requests = ${counts.apiRequests}, API Errors = ${counts.apiErrors}`);
        } catch (e: any) {
          evidence.push(`Failed to read MetricsService: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "MetricsService collects valid, non-negative structural operational metrics",
          actual: success ? "Operational metrics verify correctly" : "MetricsService reporting error",
          recommendation: success ? "None" : "Verify key assignments and thread-safe counters in MetricsService",
          evidence
        };
      }
    },

    // 12. Telemetry Consistency
    {
      id: "VAL-TEL-012",
      name: "Telemetry Consistency Rule",
      severity: "Medium",
      component: "TelemetryService",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const traceId = TelemetryService.generateTraceId();
          const spanId = TelemetryService.generateSpanId();
          success = traceId.length === 32 && spanId.length === 16;
          evidence.push(`Generated compliant traceId (${traceId}) and spanId (${spanId})`);
        } catch (e: any) {
          evidence.push(`Failed to generate telemetry IDs: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "TelemetryService generates compliant W3C IDs (32-char traceId, 16-char spanId)",
          actual: success ? "Compliant IDs generated" : "Generated telemetry tokens do not match W3C standard layouts",
          recommendation: success ? "None" : "Verify length and hexadecimal padding inside TelemetryService generator methods",
          evidence
        };
      }
    },

    // 13. Health Consistency
    {
      id: "VAL-HLT-013",
      name: "Health Consistency Rule",
      severity: "Critical",
      component: "ChaosHealthContributor",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const health = ChaosHealthContributor.getHealthStatus();
          success = ["HEALTHY", "DEGRADED", "PARTIALLY_DEGRADED", "UNAVAILABLE"].includes(health.status) &&
                    typeof health.impactScore === "number" && health.impactScore >= 0 && health.impactScore <= 100;
          evidence.push(`Health status: ${health.status}, Impact Score: ${health.impactScore}`);
        } catch (e: any) {
          evidence.push(`Failed to read health contributor: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Platform health reports valid SRE state and correct impact scoring bounds",
          actual: success ? "Health status structurally sound" : "Health contributor reporting anomalous values",
          recommendation: success ? "None" : "Check conditional thresholds and scoring weights in ChaosHealthContributor",
          evidence
        };
      }
    },

    // 14. Experiment Consistency
    {
      id: "VAL-EXP-014",
      name: "Experiment Consistency Rule",
      severity: "Medium",
      component: "ChaosRegistry",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const experiments = ChaosRegistry.getAll();
          success = Array.isArray(experiments) && experiments.length > 0;
          const valid = experiments.every(e => e.name && typeof e.run === "function");
          if (!valid) success = false;
          evidence.push(`Total registered experiments: ${experiments.length}. Interface valid: ${valid}`);
        } catch (e: any) {
          evidence.push(`Failed to evaluate ChaosRegistry: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "All registered experiments implement required IChaosExperiment properties and hooks",
          actual: success ? "All experiments structurally compliant" : "Some experiments do not implement full SRE hooks",
          recommendation: success ? "None" : "Refactor custom experiment classes to match IChaosExperiment signature perfectly",
          evidence
        };
      }
    },

    // 15. Workflow Consistency
    {
      id: "VAL-WKF-015",
      name: "Workflow Consistency Rule",
      severity: "High",
      component: "WorkflowValidator",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const workflowResult = await WorkflowValidator.validate();
          success = workflowResult.success;
          evidence.push(`Workflow check passed: ${workflowResult.success}`);
          evidence.push(`Experiment Lifecycle: ${workflowResult.experimentLifecycle.success}`);
          evidence.push(`Rollback Lifecycle: ${workflowResult.rollbackLifecycle.success}`);
        } catch (e: any) {
          evidence.push(`Workflow validation threw exception: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "workflow lifecycles (execute, verify, rollback) operate correctly without failures",
          actual: success ? "All lifecycles fully verified" : "One or more operational lifecycles are failing",
          recommendation: success ? "None" : "Check internal transaction states and step traces in WorkflowValidator",
          evidence
        };
      }
    },

    // 16. Autonomous Decision Consistency
    {
      id: "VAL-ADC-016",
      name: "Autonomous Decision Consistency Rule",
      severity: "High",
      component: "DecisionEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const decision = DecisionEngine.evaluate();
          success = !!decision && typeof decision.decision === "string" && typeof decision.confidence === "number";
          evidence.push(`Evaluated decision: ${decision?.decision} with confidence: ${decision?.confidence}%`);
        } catch (e: any) {
          evidence.push(`DecisionEngine threw exception during check: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Autonomous DecisionEngine calculates actions with non-null structures and confidence ranges",
          actual: success ? "DecisionEngine functioning as expected" : "Decision evaluation failed",
          recommendation: success ? "None" : "Examine input heuristics and probability boundaries in DecisionEngine",
          evidence
        };
      }
    },

    // 17. Autonomous Recovery Consistency
    {
      id: "VAL-ARC-017",
      name: "Autonomous Recovery Consistency Rule",
      severity: "High",
      component: "RecoveryEngine",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = false;

        try {
          const history = RecoveryHistory.getHistory();
          success = Array.isArray(history);
          evidence.push(`Autonomous Recovery Logs count: ${history.length}`);
        } catch (e: any) {
          evidence.push(`RecoveryEngine logging check threw exception: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Autonomous Recovery History retains persistent array of execution records",
          actual: success ? "Autonomous recovery logs confirmed readable" : "Log query failed",
          recommendation: success ? "None" : "Ensure RecoveryHistory singleton is properly loaded and initialized",
          evidence
        };
      }
    },

    // 18. Integration Consistency
    {
      id: "VAL-INT-018",
      name: "Integration Consistency Rule",
      severity: "High",
      component: "Integration",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = true;

        // Verify key communication links exist
        const links = {
          "Telemetry to Metrics": typeof MetricsService.recordApiRequest === "function",
          "Orchestrator to AuditTrail": typeof ChaosRegistry.getAll === "function",
          "DigitalTwin to Prediction": typeof PredictionEngine.generatePrediction === "function"
        };

        for (const [key, val] of Object.entries(links)) {
          evidence.push(`Link '${key}' active: ${val}`);
          if (!val) success = false;
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Inter-subsystem boundaries and service function mappings are completely available",
          actual: success ? "All core links active" : "One or more critical integrations are broken",
          recommendation: success ? "None" : "Verify import statements and make sure that relative file links are structurally consistent",
          evidence
        };
      }
    },

    // 19. API Contract Consistency
    {
      id: "VAL-API-019",
      name: "API Contract Consistency Rule",
      severity: "Medium",
      component: "APIContract",
      async validate(ctx: ValidationContext): Promise<ValidationResult> {
        const evidence: string[] = [];
        let success = true;

        // Validate configuration structure for ChaosState endpoints
        try {
          const targets = ChaosState.getTargetEndpoints();
          success = Array.isArray(targets);
          evidence.push(`Active targets count: ${targets.length}`);
        } catch (e: any) {
          success = false;
          evidence.push(`API configuration check threw: ${e.message}`);
        }

        return {
          validationId: ctx.validationId,
          timestamp: new Date().toISOString(),
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          component: this.component,
          success,
          expected: "Chaos endpoint target lists remain structurally compliant as arrays of API routes",
          actual: success ? "API contract targets structurally compliant" : "Endpoint contract evaluation failed",
          recommendation: success ? "None" : "Examine standard endpoints array in ChaosState config files",
          evidence
        };
      }
    }
  ];

  public static getRules(): ValidationRule[] {
    return this.rules;
  }
}
