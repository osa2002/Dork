import { IncidentDefinitionPayload } from "./IncidentDefinition";
import { IncidentContext, IncidentContextPayload } from "./IncidentContext";
import { IncidentSeverity, IncidentSeverityTriage } from "./IncidentSeverity";
import { IncidentCommander, CommanderStaffing } from "./IncidentCommander";
import { IncidentWorkflow, IncidentWorkflowPlaybook } from "./IncidentWorkflow";
import { IncidentTimeline, IncidentTimelineData } from "./IncidentTimeline";
import { IncidentCommunication, IncidentCommunicationData } from "./IncidentCommunication";
import { IncidentActionLog, IncidentActionLogData } from "./IncidentActionLog";
import { PostmortemEngine, PostmortemData } from "./PostmortemEngine";
import { IncidentReporter, IncidentReportSummary } from "./IncidentReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class IncidentCommandEngine {
  /**
   * Orchestrates the entire stateless lifecycle of an SRE incident response operation.
   * Compiles diagnostic logs, plans runbooks, verifies metrics, and issues reports.
   */
  public static coordinate(
    definition: IncidentDefinitionPayload,
    environment: "production" | "staging" | "development" = "production"
  ): {
    readonly context: IncidentContextPayload;
    readonly triage: IncidentSeverityTriage;
    readonly staffing: CommanderStaffing;
    readonly playbook: IncidentWorkflowPlaybook;
    readonly timeline: IncidentTimelineData;
    readonly communications: IncidentCommunicationData;
    readonly actionLog: IncidentActionLogData;
    readonly postmortem: PostmortemData;
    readonly summary: IncidentReportSummary;
    readonly reportMarkdown: string;
    readonly reportJson: string;
  } {
    // 1. Gather all SRE and platform operational context
    const context = IncidentContext.compile(environment);

    // 2. Compute severity triage classification based on metrics and rules
    const triage = IncidentSeverity.classify(definition, context);

    // 3. Recruit primary, deputy, operations and communications leads
    const staffing = IncidentCommander.staff(triage.level, definition.id);

    const correlationId = `corr-inc-${definition.id}`;

    // 4. Publish "IncidentCreated" Event to the Bus
    EnterpriseEventBus.publish(
      "IncidentCreated",
      {
        incidentId: definition.id,
        title: definition.title,
        severity: triage.level,
        primaryCommander: staffing.primaryCommander.name,
        slackChannel: staffing.slackChannel,
        affectedSubsystems: definition.affectedSubsystems,
      },
      correlationId
    );

    // 5. Build dynamic multi-stage response playbook
    const playbook = IncidentWorkflow.plan(definition.id, triage.level, definition.affectedSubsystems);

    // 6. Generate chronological response sequence
    const timeline = IncidentTimeline.generate(definition, triage.level, staffing.primaryCommander.name);

    // 7. Map internal/external communications notifications streams
    const communications = IncidentCommunication.compileLogs(definition, triage.level, staffing);

    // 8. Formulate action logs ledger with authorization signatures
    const actionLog = IncidentActionLog.compile(
      definition.id,
      playbook.steps,
      staffing.primaryCommander.name,
      definition.detectedAt
    );

    // 9. Assemble Postmortem RCA findings and preventative actions
    const postmortem = PostmortemEngine.analyze(definition, triage.level);

    // 10. Publish "SystemStateChanged" indicating completed mitigation & verification
    EnterpriseEventBus.publish(
      "SystemStateChanged",
      {
        checkpoint: "IncidentCommandMitigationComplete",
        incidentId: definition.id,
        remediationOutcome: "SUCCESS",
        mttrMinutes: postmortem.mttrMinutes,
        triageLevel: triage.level,
      },
      correlationId
    );

    // 11. Compile executive and structural summaries
    const summary: IncidentReportSummary = {
      definition,
      triage,
      staffing,
      playbook,
      timeline,
      communications,
      actionLog,
      postmortem,
    };

    const reportMarkdown = IncidentReporter.generateMarkdown(summary);
    const reportJson = IncidentReporter.generateJson(summary);

    return Object.freeze({
      context,
      triage,
      staffing,
      playbook,
      timeline,
      communications,
      actionLog,
      postmortem,
      summary,
      reportMarkdown,
      reportJson,
    });
  }
}
