import { WorkflowStep } from "./IncidentWorkflow";

export interface ActionLogEntry {
  readonly timestamp: string;
  readonly stepSequence: number;
  readonly actionName: string;
  readonly description: string;
  readonly actor: string;
  readonly authorizationToken: string;
  readonly outcome: "SUCCESS" | "FAILED" | "BYPASSED";
  readonly executionDelayMs: number;
}

export interface IncidentActionLogData {
  readonly incidentId: string;
  readonly entries: readonly ActionLogEntry[];
}

export class IncidentActionLog {
  /**
   * Generates a realistic set of action execution records matching the workflow playbook.
   */
  public static compile(
    incidentId: string,
    steps: readonly WorkflowStep[],
    commanderName: string,
    baseTimestamp: string
  ): IncidentActionLogData {
    const entries: ActionLogEntry[] = [];
    const baseDate = new Date(baseTimestamp);

    const getOffsetTime = (secondsOffset: number): string => {
      const d = new Date(baseDate.getTime() + secondsOffset * 1000);
      return d.toISOString();
    };

    steps.forEach((step, index) => {
      const offsetSeconds = (index + 1) * 300; // Spread actions chronologically
      const authId = `auth-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      let actor = "SRE Automation Core";
      if (step.phase === "TRIAGE" || step.phase === "POSTMORTEM") {
        actor = commanderName;
      }

      entries.push({
        timestamp: getOffsetTime(offsetSeconds),
        stepSequence: step.sequence,
        actionName: step.title,
        description: step.description,
        actor,
        authorizationToken: step.requiredApproverRole === "NONE" ? "PUBLIC" : `SECURE-${authId}`,
        outcome: "SUCCESS",
        executionDelayMs: Math.floor(Math.random() * 400) + 100, // Simulated action processing time
      });
    });

    return Object.freeze({
      incidentId,
      entries: Object.freeze(entries),
    });
  }
}
