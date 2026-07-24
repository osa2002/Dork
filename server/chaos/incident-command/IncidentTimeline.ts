import { IncidentDefinitionPayload } from "./IncidentDefinition";
import { IncidentSeverityLevel } from "./IncidentSeverity";

export interface IncidentTimelineEvent {
  readonly timestamp: string;
  readonly type: "DETECTION" | "PAGE" | "WAR_ROOM" | "ACTION" | "COMMUNICATION" | "VERIFICATION" | "RESOLUTION";
  readonly summary: string;
  readonly description: string;
  readonly actor: string;
}

export interface IncidentTimelineData {
  readonly incidentId: string;
  readonly events: readonly IncidentTimelineEvent[];
}

export class IncidentTimeline {
  /**
   * Generates a realistic chronological sequence of events relative to the incident's detection timestamp.
   */
  public static generate(
    definition: IncidentDefinitionPayload,
    severity: IncidentSeverityLevel,
    commanderName: string
  ): IncidentTimelineData {
    const events: IncidentTimelineEvent[] = [];
    const baseDate = new Date(definition.detectedAt);

    const getOffsetTime = (minutesOffset: number): string => {
      const d = new Date(baseDate.getTime() + minutesOffset * 60000);
      return d.toISOString();
    };

    // Event 1: Automated alarm or Manual Report
    events.push({
      timestamp: getOffsetTime(0),
      type: "DETECTION",
      summary: `Incident detected on ${definition.affectedSubsystems.join(", ")}`,
      description: `Alarm triggered: ${definition.title}. Metrics: ${definition.description}`,
      actor: definition.reporter.name,
    });

    // Event 2: On-Call Paged
    events.push({
      timestamp: getOffsetTime(2),
      type: "PAGE",
      summary: `On-Call Crew paged out (Severity level: ${severity})`,
      description: `Paged ${commanderName} (Primary Incident Commander) and supporting response squad.`,
      actor: "PagerDuty System Integration",
    });

    // Event 3: War Room Established
    events.push({
      timestamp: getOffsetTime(5),
      type: "WAR_ROOM",
      summary: `SRE Command Center War Room Online`,
      description: `Response team gathered in dedicated Meet room and Slack channel to coordinate remediation.`,
      actor: commanderName,
    });

    // Event 4: Mitigation Action Initiated
    const mitigationSummary = severity === "SEV1" || severity === "SEV2" 
      ? "Executed core subsystem isolation & circuit-breaker rate limiter activation."
      : "Initiated service node soft-restart sequence.";
    events.push({
      timestamp: getOffsetTime(12),
      type: "ACTION",
      summary: `Mitigation procedure initiated`,
      description: mitigationSummary,
      actor: "SRE Platform Operations Module",
    });

    // Event 5: Internal / External Comms Dispatched
    events.push({
      timestamp: getOffsetTime(15),
      type: "COMMUNICATION",
      summary: `Corporate communication update issued`,
      description: `Slack alert pushed to engineering. Customers notified via Enterprise Status Page.`,
      actor: "Communications Lead",
    });

    // Event 6: Validation Suite Complete
    events.push({
      timestamp: getOffsetTime(24),
      type: "VERIFICATION",
      summary: `Continuous validation suite passed successfully`,
      description: `SLA tests, synthetic transaction queries, and health-checks are 100% successful.`,
      actor: "Continuous Validation Agent",
    });

    // Event 7: Resolution Declared
    events.push({
      timestamp: getOffsetTime(30),
      type: "RESOLUTION",
      summary: `Incident successfully resolved`,
      description: `Subsystem metrics returned to healthy steady-state levels. Moving to RCA compiling phase.`,
      actor: commanderName,
    });

    return Object.freeze({
      incidentId: definition.id,
      events: Object.freeze(events),
    });
  }
}
