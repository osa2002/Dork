import { IncidentDefinitionPayload } from "./IncidentDefinition";
import { IncidentSeverityLevel } from "./IncidentSeverity";
import { CommanderStaffing } from "./IncidentCommander";

export interface CommunicationLog {
  readonly timestamp: string;
  readonly channel: "SLACK" | "PAGER_DUTY" | "STATUS_PAGE" | "EMAIL";
  readonly recipient: string;
  readonly subject: string;
  readonly message: string;
  readonly status: "DELIVERED" | "QUEUED" | "FAILED";
}

export interface IncidentCommunicationData {
  readonly incidentId: string;
  readonly logs: readonly CommunicationLog[];
}

export class IncidentCommunication {
  /**
   * Generates a realistic set of communication records that correspond to SRE protocols.
   */
  public static compileLogs(
    definition: IncidentDefinitionPayload,
    severity: IncidentSeverityLevel,
    staffing: CommanderStaffing
  ): IncidentCommunicationData {
    const logs: CommunicationLog[] = [];
    const baseDate = new Date(definition.detectedAt);

    const getOffsetTime = (secondsOffset: number): string => {
      const d = new Date(baseDate.getTime() + secondsOffset * 1000);
      return d.toISOString();
    };

    // 1. PagerDuty Dispatch
    logs.push({
      timestamp: getOffsetTime(15),
      channel: "PAGER_DUTY",
      recipient: `${staffing.primaryCommander.name} (${staffing.primaryCommander.pagerId})`,
      subject: `[CRITICAL ALERT] ${severity} Incident: ${definition.title}`,
      message: `Immediate response requested. Affected: ${definition.affectedSubsystems.join(", ")}. War room: ${staffing.warRoomUrl}`,
      status: "DELIVERED",
    });

    // 2. Slack Channel creation & Ping
    logs.push({
      timestamp: getOffsetTime(45),
      channel: "SLACK",
      recipient: staffing.slackChannel,
      subject: `Incident Channel Created`,
      message: `SRE Response Room active for incident ${definition.id}. Commander: ${staffing.primaryCommander.name}. Metrics Snapshot: ${JSON.stringify(definition.metricsSnapshot ?? {})}`,
      status: "DELIVERED",
    });

    // 3. Status Page Broadcast
    const publicMessage = severity === "SEV1" || severity === "SEV2"
      ? `We are currently investigating an active service degradation affecting ${definition.affectedSubsystems.join(", ")}. Engineers are working to restore normal operations.`
      : `Minor performance degradation detected in ${definition.affectedSubsystems.join(", ")}. Systems are operational but response times may be elevated.`;
    
    logs.push({
      timestamp: getOffsetTime(120),
      channel: "STATUS_PAGE",
      recipient: "Enterprise Status Portal",
      subject: `Performance Degradation - ${definition.affectedSubsystems.join(", ")}`,
      message: publicMessage,
      status: "DELIVERED",
    });

    // 4. Executive Email Update
    if (severity === "SEV1" || severity === "SEV2") {
      logs.push({
        timestamp: getOffsetTime(300),
        channel: "EMAIL",
        recipient: "executive-briefing-list@enterprise.com",
        subject: `[SRE WAR ROOM REPORT] Severity Level ${severity} Incident Declared`,
        message: `An incident has been classified as ${severity} affecting core subsystems: ${definition.affectedSubsystems.join(", ")}.\nCommander ${staffing.primaryCommander.name} has assumed control.\nMitigation playbook initialized.`,
        status: "DELIVERED",
      });
    }

    return Object.freeze({
      incidentId: definition.id,
      logs: Object.freeze(logs),
    });
  }
}
