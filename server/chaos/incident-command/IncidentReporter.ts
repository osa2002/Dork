import { IncidentDefinitionPayload } from "./IncidentDefinition";
import { IncidentSeverityTriage } from "./IncidentSeverity";
import { CommanderStaffing } from "./IncidentCommander";
import { IncidentWorkflowPlaybook } from "./IncidentWorkflow";
import { IncidentTimelineData } from "./IncidentTimeline";
import { IncidentCommunicationData } from "./IncidentCommunication";
import { IncidentActionLogData } from "./IncidentActionLog";
import { PostmortemData } from "./PostmortemEngine";

export interface IncidentReportSummary {
  readonly definition: IncidentDefinitionPayload;
  readonly triage: IncidentSeverityTriage;
  readonly staffing: CommanderStaffing;
  readonly playbook: IncidentWorkflowPlaybook;
  readonly timeline: IncidentTimelineData;
  readonly communications: IncidentCommunicationData;
  readonly actionLog: IncidentActionLogData;
  readonly postmortem: PostmortemData;
}

export class IncidentReporter {
  /**
   * Compiles a highly polished, executive SRE Markdown report.
   */
  public static generateMarkdown(summary: IncidentReportSummary): string {
    const { definition, triage, staffing, playbook, timeline, communications, actionLog, postmortem } = summary;

    return `
# ENTERPRISE INCIDENT COMMAND BRIEFING

## 1. Executive Summary
- **Incident ID**: \`${definition.id}\`
- **Title**: ${definition.title}
- **Description**: ${definition.description}
- **Severity Level**: **${triage.level}** (Confidence: ${(triage.confidence * 100).toFixed(0)}%)
- **Status**: **RESOLVED**
- **MTTR**: **${postmortem.mttrMinutes} minutes**

---

## 2. Severity Classification & Triggers
- **Severity Description**: *${triage.description}*
- **Matched Platform Triggers**:
${triage.triggers.map((trigger) => `  - 🚨 ${trigger}`).join("\n")}

---

## 3. Command & Staffing Allocation
- **Primary Incident Commander**: **${staffing.primaryCommander.name}** (${staffing.primaryCommander.title})
- **Communications Lead**: **${staffing.communicationsLead.name}** (${staffing.communicationsLead.title})
- **Operations Lead**: **${staffing.operationsLead.name}** (${staffing.operationsLead.title})
${staffing.deputyCommander ? `- **Deputy Commander**: **${staffing.deputyCommander.name}** (${staffing.deputyCommander.title})\n` : ""}
- **SRE War Room**: [Join Meet Bridge](${staffing.warRoomUrl})
- **Slack Communications Hub**: \`${staffing.slackChannel}\`

---

## 4. Remediation Playbook: \`${playbook.playbookName}\`
The following workflow was planned and mapped statelessly:
${playbook.steps
  .map(
    (step) =>
      `### Phase ${step.sequence}: ${step.title}
- **Phase**: \`${step.phase}\`
- **Description**: ${step.description}
- **Action**: *${step.recommendedAction}*
- **Automated Runbook**: \`${step.automatedRunbookId ?? "N/A"}\`
- **Approval Level**: \`${step.requiredApproverRole}\``
  )
  .join("\n\n")}

---

## 5. Audit Ledger: Action Execution Logs
${actionLog.entries
  .map(
    (entry) =>
      `- \`[${entry.timestamp}]\` Step ${entry.stepSequence}: **${entry.actionName}** executed by *${entry.actor}* [Token: \`${entry.authorizationToken}\`] (${entry.outcome})`
  )
  .join("\n")}

---

## 6. Communications History Logs
${communications.logs
  .map(
    (log) =>
      `- \`[${log.timestamp}]\` **[${log.channel}]** to *${log.recipient}*: "${log.subject}" -> **${log.status}**`
  )
  .join("\n")}

---

## 7. Incident Chronology Timeline
${timeline.events
  .map(
    (event) =>
      `- \`[${event.timestamp}]\` **[${event.type}]** ${event.summary} (*Actor: ${event.actor}*)`
  )
  .join("\n")}

---

## 8. SRE Root Cause Analysis (RCA) Postmortem
- **Summary**: ${postmortem.rcaSummary}
- **Root Cause**: ${postmortem.rootCause}

### Contributing Factors
${postmortem.contributingFactors.map((factor) => `- ⚠️ ${factor}`).join("\n")}

### Preventative Corrective Actions
${postmortem.preventiveActions.map((action) => `- ✅ ${action}`).join("\n")}
    `.trim();
  }

  /**
   * Generates a structural JSON payload.
   */
  public static generateJson(summary: IncidentReportSummary): string {
    return JSON.stringify(summary, null, 2);
  }
}
