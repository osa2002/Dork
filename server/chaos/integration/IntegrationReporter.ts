import { IntegrationValidator, IntegrationValidationResult } from "./IntegrationValidator";
import { DependencyValidator, DependencyValidationResult } from "./DependencyValidator";
import { EventFlowValidator, EventFlowValidationResult } from "./EventFlowValidator";
import { WorkflowValidator, WorkflowValidationResult } from "./WorkflowValidator";

export interface IntegrationReport {
  timestamp: string;
  enterpriseReadyScore: number; // 0 to 100
  architectureValidated: boolean;
  dependencyValidation: DependencyValidationResult;
  eventFlowValidation: EventFlowValidationResult;
  workflowValidation: WorkflowValidationResult;
  integrationValidation: IntegrationValidationResult;
  recommendations: string[];
}

export class IntegrationReporter {
  /**
   * Executes all specialized SRE validators and aggregates results into a unified report.
   * Outputs JSON model and beautifully structured SRE Markdown representation.
   */
  public static async generateReport(): Promise<{ report: IntegrationReport; markdown: string }> {
    const timestamp = new Date().toISOString();

    // 1. Run all in-memory validation engines
    const dependencyValidation = DependencyValidator.validate();
    const eventFlowValidation = await EventFlowValidator.validate();
    const workflowValidation = await WorkflowValidator.validate();
    const integrationValidation = await IntegrationValidator.validateEndToEnd();

    // 2. Calculate Weighted Enterprise Readiness Score
    let score = 0;
    if (dependencyValidation.success) score += 25;
    if (eventFlowValidation.success) score += 25;
    if (workflowValidation.success) score += 25;
    if (integrationValidation.success) score += 25;

    // 3. Compile dynamic actionable suggestions
    const recommendations: string[] = [];
    if (!dependencyValidation.success) {
      recommendations.push("Resolve structural dependency duplications or circular pathways logged in the dependency trail.");
    }
    if (!eventFlowValidation.success) {
      recommendations.push("Investigate event latency or race conditions preventing Event Bus confirmation dispatch.");
    }
    if (!workflowValidation.success) {
      recommendations.push("Ensure recovery playbooks or experiment triggers are correctly registered and permitted by environment variables.");
    }
    if (!integrationValidation.success) {
      recommendations.push("Trace complete SRE loops to identify execution blocks or permission bottlenecks on target nodes.");
    }

    // Default proactive high-grade recommendations if score is 100
    if (score === 100) {
      recommendations.push("Enable real-time regression alerts for all production-mimicking staging clusters.");
      recommendations.push("Establish downstream circuit breakers on Stripe and Gemini client gateways to secure API SLAs.");
      recommendations.push("Perform regular game-day exercises to verify live failovers under simulated high load.");
    }

    const report: IntegrationReport = {
      timestamp,
      enterpriseReadyScore: score,
      architectureValidated: dependencyValidation.success && eventFlowValidation.success,
      dependencyValidation,
      eventFlowValidation,
      workflowValidation,
      integrationValidation,
      recommendations,
    };

    // 4. Formulate SRE Markdown string
    const md = `
# 🛠️ ENTERPRISE CHAOS PLATFORM INTEGRATION REPORT

**Calibrated At:** ${timestamp}  
**Enterprise Readiness Score:** **${score}/100**  
**Overall Validation Status:** ${score === 100 ? "🟩 READY FOR ENTERPRISE" : "🟥 DEGRADED / NOT READY"}

---

## 📈 Executive Summary
This report validates the end-to-end integration and resilience patterns of the Enterprise Chaos Platform. Every system component has been evaluated in-memory under SRE compliance gates to prove structural soundness, race-free event flows, predictable workflows, and deterministic validation outputs.

---

## 🏗️ Architecture & Dependency Validation
- **Status:** ${dependencyValidation.success ? "🟩 SUCCESS" : "🟥 FAILED"}
- **No Circular Dependencies:** ${dependencyValidation.circularDependencies.length === 0 ? "✅ Verified" : "❌ Discovered Cycle"}
- **Unique State Stores & Registries:** ${dependencyValidation.duplicateStores.length === 0 ? "✅ Verified" : "❌ Duplication Found"}
- **Unique Repositories:** ${dependencyValidation.duplicateRepositories.length === 0 ? "✅ Verified" : "❌ Duplication Found"}
- **Registered Singletons:** \`${dependencyValidation.registeredComponents.join(", ")}\`

${dependencyValidation.circularDependencies.map((c) => `- *Circular Path:* \`${c.path.join(" -> ")}\``).join("\n")}

---

## 📡 Event Flow Validation
- **Status:** ${eventFlowValidation.success ? "🟩 SUCCESS" : "🟥 FAILED"}
- **All Core Events Dispatched:** ${eventFlowValidation.receivedEvents.length >= eventFlowValidation.publishedEvents.length ? "✅ Verified" : "❌ Missing Events"}
- **Zero Event Duplications:** ${eventFlowValidation.duplicateEvents.length === 0 ? "✅ Verified" : "❌ Duplicates Found"}
- **Field Integrity Preservation:**
  - *Correlation ID Retained:* ${eventFlowValidation.preservedFields.correlationId ? "✅ Yes" : "❌ No"}
  - *Execution ID Retained:* ${eventFlowValidation.preservedFields.executionId ? "✅ Yes" : "❌ No"}
  - *Timestamps Retained:* ${eventFlowValidation.preservedFields.timestamp ? "✅ Yes" : "❌ No"}

---

## 🔄 Workflow Lifecycle Validation
- **Status:** ${workflowValidation.success ? "🟩 SUCCESS" : "🟥 FAILED"}
- **Experiment Lifecycle (prepare ➔ execute ➔ verify ➔ cleanup):** ${workflowValidation.experimentLifecycle.success ? "✅ Validated" : "❌ Failed"}
- **Automatic Rollback Lifecycle:** ${workflowValidation.rollbackLifecycle.success ? "✅ Validated" : "❌ Failed"}
- **Decision Engine (Rule Evaluation):** ${workflowValidation.decisionLifecycle.success ? "✅ Validated" : "❌ Failed"} (Decision Outcome: \`${workflowValidation.decisionLifecycle.decision}\`)
- **Recovery Playbook Engine Execution:** ${workflowValidation.recoveryLifecycle.success ? "✅ Validated" : "❌ Failed"} (Status: \`${workflowValidation.recoveryLifecycle.status}\`)
- **Knowledge Foundation & Indexing:** ${workflowValidation.knowledgeLifecycle.success ? "✅ Validated" : "❌ Failed"} (Records: \`${workflowValidation.knowledgeLifecycle.recordsCount}\`)
- **Predictive Resilience Engine (Weighted Rule Forecast):** ${workflowValidation.predictionLifecycle.success ? "✅ Validated" : "❌ Failed"} (Forecast Confidence: \`${workflowValidation.predictionLifecycle.confidence}\`)

---

## 🔗 End-to-End Integration Validation
- **Status:** ${integrationValidation.success ? "🟩 SUCCESS" : "🟥 FAILED"}
- **Complete SRE Loop Execution (Chaos ➔ Prediction ➔ Decision ➔ Recovery ➔ Dashboard):** ${integrationValidation.success ? "✅ Verified" : "❌ Incomplete Loop"}
- **Dispatched Event Log:**
${integrationValidation.eventLog.map((log) => `  - ${log}`).join("\n")}

---

## 💡 Proactive Recommendations
${recommendations.map((rec, i) => `${i + 1}. **${rec}**`).join("\n")}

---
*Enterprise Chaos Platform Integration Validator v1.2.0*
`.trim();

    return { report, markdown: md };
  }
}
