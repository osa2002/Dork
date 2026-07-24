import { ReleaseDefinitionPayload } from "./ReleaseDefinition";
import { ReleaseValidationPayload } from "./ReleaseValidator";
import { ReleaseApprovalPayload } from "./ReleaseApproval";
import { StrategyRecommendationPayload } from "./ReleaseStrategy";
import { ReleasePlanPayload, RollbackPlanPayload } from "./ReleasePlanner";
import { ReleasePipelinePayload } from "./ReleasePipeline";
import { ReleaseAuditRecord } from "./ReleaseAudit";

export interface ReleaseReportOutput {
  readonly reportId: string;
  readonly timestamp: string;
  readonly releaseId: string;
  readonly version: string;
  readonly markdown: string;
  readonly json: {
    readonly releaseId: string;
    readonly version: string;
    readonly title: string;
    readonly readinessScore: number;
    readonly isEligible: boolean;
    readonly approvalStatus: string;
    readonly strategyUsed: string;
    readonly totalSteps: number;
    readonly totalDurationSeconds: number;
    readonly rollbackDurationSeconds: number;
    readonly pipelineSuccess: boolean;
    readonly auditId: string;
    readonly findingsCount: number;
    readonly rulesCheckedCount: number;
  };
}

export class ReleaseReporter {
  /**
   * Generates highly polished Executive Markdown and structured JSON reports.
   */
  public static generate(
    definition: ReleaseDefinitionPayload,
    validation: ValidationResultSnapshot, // or type compatible
    approval: ReleaseApprovalPayload,
    strategyRec: StrategyRecommendationPayload,
    plan: ReleasePlanPayload,
    rollback: RollbackPlanPayload,
    pipeline: ReleasePipelinePayload,
    auditRecord: ReleaseAuditRecord
  ): ReleaseReportOutput {
    const reportId = `rep-rel-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Compile Markdown content
    const findingsMd = validation.findings.map(
      (f) => `- **[${f.severity}]** _${f.category}_: ${f.message} (Code: \`${f.code}\`)`
    ).join("\n") || "_No issues or warnings identified. System is fully healthy and qualified._";

    const rulesMd = approval.evaluatedRules.map(
      (r) => `- **${r.ruleName}**: ${r.passed ? "✅ PASSED" : "❌ FAILED"} - ${r.reason}`
    ).join("\n");

    const stepsMd = plan.steps.map(
      (s) => `${s.sequence}. **${s.name}** (${s.subsystem}, ${s.durationSeconds}s): _${s.action}_`
    ).join("\n");

    const rollbackStepsMd = rollback.steps.map(
      (s) => `${s.sequence}. **${s.name}** (${s.subsystem}, ${s.durationSeconds}s): _${s.action}_`
    ).join("\n");

    const rollbackTriggersMd = rollback.triggers.map((t) => `- ${t}`).join("\n");

    const pipelinePhasesMd = pipeline.phases.map(
      (p) => `| ${p.phase} | **${p.status}** | ${p.executionTimeSeconds}s | ${p.criteriaChecked.join(", ")} | _${p.validationMessage}_ |`
    ).join("\n");

    const markdown = `# 🛡️ ENTERPRISE RELEASE MANAGEMENT PLATFORM
### EXECUTIVE STATUS & AUDIT REPORT

---

## 📋 General Release Information
- **Release ID**: \`${definition.id}\`
- **Audit ID**: \`${auditRecord.auditId}\`
- **Release Title**: \`${definition.title}\`
- **Semantic Version**: \`v${definition.version}\`
- **Execution Strategy Selected**: \`${plan.strategyUsed}\`
- **Subsystem Target Scope**: \`${definition.targetSubsystems.join(", ")}\`
- **Date & Timestamp**: \`${timestamp}\`
- **Requested By**: \`${definition.requester.name}\` (\`${definition.requester.role}\` / \`${definition.requester.team}\`)

---

## ⚡ SRE Release Readiness Score: **${validation.readinessScore}/100**
- **SRE Core Eligibility Status**: ${validation.isEligible ? "🟢 **QUALIFIED**" : "🔴 **BLOCKED / DISQUALIFIED**"}
- **Final Approval Status**: \`${approval.status}\`
- **Approval Decision Reason**: _${approval.decisionReason}_
${approval.requiredOverrideRole ? `- **Required override authority role**: \`${approval.requiredOverrideRole}\`` : ""}

---

## 🔍 Validation Findings Summary
The Release Validation Engine ran multiple compliance assertions against the live SRE twin topology, failure probability trends, and continuous verification baselines:

${findingsMd}

---

## 🏛️ Policy Gate Compliance Evaluated
The Release Approval Engine evaluated standard policy definitions against current Governance context profiles:

${rulesMd}

---

## 🗺️ Optimal Rollout Strategy Detail
- **Recommended Strategy**: \`${strategyRec.recommendedStrategy}\`
- **Recommender Confidence**: \`${strategyRec.confidenceScore}%\`
- **Decision Rationale**: _${strategyRec.justification}_

---

## 🚀 Step-by-Step Deployment Execution Timeline Plan
- **Total Duration**: \`${plan.totalDurationSeconds} seconds\`
- **Pipeline Deployment Strategy**: \`${plan.strategyUsed}\`

${stepsMd}

---

## 🔄 Emergency Recovery & Rollback Plan
- **Estimated Rollback Time**: \`${rollback.totalDurationSeconds} seconds\`
- **Remediation Trigger Thresholds**:
${rollbackTriggersMd}

**Steps to Undo Deployment**:
${rollbackStepsMd}

---

## 🛰️ Pipeline Simulated Lifecycle Summary
- **Simulated Pipeline ID**: \`${pipeline.pipelineId}\`
- **Total Simulated Run-time**: \`${pipeline.totalExecutionTimeSeconds} seconds\`
- **Pipeline Overall Outcome**: ${pipeline.isSuccess ? "🟢 **SUCCESS**" : "🔴 **ABORTED / FAILED**"}

| Phase | Status | Execution Time | Criteria Asserted | Details |
|---|---|---|---|---|
${pipelinePhasesMd}

---
_Report certified and generated statelessly by the Enterprise Release Management Platform._
`;

    const jsonReport = {
      releaseId: definition.id,
      version: definition.version,
      title: definition.title,
      readinessScore: validation.readinessScore,
      isEligible: validation.isEligible,
      approvalStatus: approval.status,
      strategyUsed: plan.strategyUsed,
      totalSteps: plan.steps.length,
      totalDurationSeconds: plan.totalDurationSeconds,
      rollbackDurationSeconds: rollback.totalDurationSeconds,
      pipelineSuccess: pipeline.isSuccess,
      auditId: auditRecord.auditId,
      findingsCount: validation.findings.length,
      rulesCheckedCount: approval.evaluatedRules.length,
    };

    return Object.freeze({
      reportId,
      timestamp,
      releaseId: definition.id,
      version: definition.version,
      markdown,
      json: Object.freeze(jsonReport),
    });
  }
}

// Utility type mapping
type ValidationResultSnapshot = ReleaseValidationPayload;
