import { DeploymentOrchestrationResult } from "./DeploymentOrchestrator";

export class DeploymentReporter {
  public static generateMarkdownReport(result: DeploymentOrchestrationResult): string {
    const { plan, validation, audit, promotionPipeline, status, rollbackExecuted, rollbackReason } = result;

    return `
# 🚀 DORK ENTERPRISE DEPLOYMENT AUTOMATION PLATFORM - DEPLOYMENT CERTIFICATION REPORT

## 1. Executive Summary
- **Deployment ID**: \`${result.deploymentId}\`
- **Correlation ID**: \`${result.correlationId}\`
- **Release Version**: \`${plan.releaseVersion}\`
- **Target Environment**: \`${plan.environment.toUpperCase()}\`
- **Final Status**: **${status}**
- **Deployment Strategy**: \`${plan.strategyPlan.name}\`
- **Health Gate Score**: \`${validation.healthGatesScore}%\` (Required: \`>=90%\`)
- **Cloud Run Compliance**: \`${validation.cloudRunScore}%\` (Required: \`100%\`)
- **Rollback Executed**: \`${rollbackExecuted ? "YES (AUTOMATIC ROLLBACK TRIGGERED)" : "NO (ZERO ROLLBACKS NEEDED)"}\`

${rollbackReason ? `> 🚨 **Rollback Trigger Reason**: ${rollbackReason}` : ""}

---

## 2. Deployment Topology & Cloud Run Configuration
- **Service Name**: \`${plan.definition.cloudRun.serviceName}\`
- **Container Image**: \`${plan.definition.cloudRun.containerImage}\`
- **Target Ingress Port**: \`${plan.definition.cloudRun.targetPort}\`
- **Instance Autoscaling**: \`${plan.definition.cloudRun.minInstances}\` min / \`${plan.definition.cloudRun.maxInstances}\` max
- **Instance Concurrency**: \`${plan.definition.cloudRun.concurrency}\` requests
- **Memory / CPU Limits**: \`${plan.definition.cloudRun.memoryLimit}\` / \`${plan.definition.cloudRun.cpuLimit}\` CPU
- **Stateless Cloud Run Compliance**: **${plan.definition.cloudRun.stateless ? "VERIFIED (100% Ephemeral Disk Safe)" : "NON-COMPLIANT"}**

---

## 3. Deployment Strategy Matrix (${plan.strategyPlan.name})
| Step # | Stage Name | Target Traffic % | Validation Delay | Description |
| :--- | :--- | :--- | :--- | :--- |
${plan.strategyPlan.steps
  .map(
    (s) =>
      `| ${s.stepNumber} | **${s.name}** | \`${s.trafficWeight}%\` | \`${s.validationWaitMs}ms\` | ${s.description} |`
  )
  .join("\n")}

---

## 4. Promotion Pipeline Matrix
| Environment | Gate Stage Name | Validation Status | Execution Time |
| :--- | :--- | :--- | :--- |
${promotionPipeline
  .map(
    (p) =>
      `| **${p.environment.toUpperCase()}** | ${p.name} | **${p.status}** | \`${p.executedAt || "N/A"}\` |`
  )
  .join("\n")}

---

## 5. Health & Compliance Validation Gates
| Gate ID | Module Target | Gate Name | Score | Status | Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
${validation.healthGates
  .map(
    (g) =>
      `| \`${g.gateId}\` | **${g.module}** | ${g.name} | \`${g.score}%\` | **${g.passed ? "PASS" : "FAIL"}** | ${g.details} |`
  )
  .join("\n")}

---

## 6. Cloud Run Container Readiness Audit
| Requirement | Status | Details |
| :--- | :--- | :--- |
${validation.cloudRunChecks
  .map((c) => `| **${c.requirement}** | **${c.passed ? "PASSED" : "FAILED"}** | ${c.details} |`)
  .join("\n")}

---

## 7. Emergency Rollback Matrix & Triggers
| Trigger ID | Trigger Name | SLA Metric Threshold | Auto Triggered |
| :--- | :--- | :--- | :--- |
${plan.rollbackTriggers
  .map(
    (t) =>
      `| \`${t.triggerId}\` | **${t.name}** | \`${t.metricThreshold}\` | **${t.automatic ? "YES" : "NO"}** |`
  )
  .join("\n")}

---

## 8. Deployment Audit Timeline
${audit.timeline
  .map((e) => `- \`[${e.timestamp}]\` **[${e.phase}]** (${e.status}) ${e.message}`)
  .join("\n")}

---

## 9. Deployment Readiness Certification
- **Deployment Certification**: **${result.status === "PROMOTED" ? "CERTIFIED FOR PRODUCTION (STRICT COMPLIANT)" : "DELETED/ROLLED BACK SAFE"}**
    `.trim();
  }

  public static generateJsonReport(result: DeploymentOrchestrationResult): any {
    return {
      version: "1.0.0",
      deploymentId: result.deploymentId,
      correlationId: result.correlationId,
      releaseVersion: result.plan.releaseVersion,
      environment: result.plan.environment,
      status: result.status,
      certified: result.status === "PROMOTED",
      scores: {
        healthGatesScore: result.validation.healthGatesScore,
        cloudRunScore: result.validation.cloudRunScore,
      },
      strategy: result.plan.strategyPlan.name,
      cloudRun: result.plan.definition.cloudRun,
      rollbackExecuted: result.rollbackExecuted,
      rollbackReason: result.rollbackReason,
      promotionPipeline: result.promotionPipeline,
      healthGates: result.validation.healthGates,
      timeline: result.audit.timeline,
    };
  }
}
