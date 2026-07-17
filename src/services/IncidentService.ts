import { RetentionPolicyService } from "./RetentionPolicyService";

export interface TimelineEvent {
  timestamp: string;
  description: string;
  actor: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  affectedServices: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  timeline: TimelineEvent[];
  postmortem?: string;
  recoveryDurationMs?: number; // duration from creation to resolution
}

export class IncidentService {
  private static incidents: Incident[] = [];

  public static createIncident(params: {
    title: string;
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    affectedServices: string[];
  }): Incident {
    const incident: Incident = {
      id: `inc-${Math.random().toString(36).substring(2, 15)}`,
      title: params.title,
      description: params.description,
      severity: params.severity,
      status: "INVESTIGATING",
      affectedServices: params.affectedServices,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        {
          timestamp: new Date().toISOString(),
          description: `Incident created: ${params.title}`,
          actor: "System Monitor",
        },
      ],
    };

    this.incidents.push(incident);
    this.prune();
    return incident;
  }

  public static addTimelineEvent(id: string, description: string, actor: string): Incident | null {
    const incident = this.incidents.find((i) => i.id === id);
    if (!incident) return null;

    incident.timeline.push({
      timestamp: new Date().toISOString(),
      description,
      actor,
    });
    incident.updatedAt = new Date().toISOString();
    return incident;
  }

  public static resolveIncident(id: string, resolutionDetails: string, actor: string): Incident | null {
    const incident = this.incidents.find((i) => i.id === id);
    if (!incident) return null;

    incident.status = "RESOLVED";
    incident.resolvedAt = new Date().toISOString();
    incident.updatedAt = new Date().toISOString();
    incident.recoveryDurationMs = new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime();

    incident.timeline.push({
      timestamp: new Date().toISOString(),
      description: `Incident resolved: ${resolutionDetails}`,
      actor,
    });

    incident.postmortem = this.generatePostmortem(incident, resolutionDetails);
    return incident;
  }

  public static getIncidents(): Incident[] {
    this.prune();
    return [...this.incidents].reverse();
  }

  private static generatePostmortem(incident: Incident, resolutionDetails: string): string {
    const durationMins = incident.recoveryDurationMs ? Math.round(incident.recoveryDurationMs / 60000) : 0;
    return `# Enterprise Postmortem Report - ${incident.id}
## Incident Title: ${incident.title}
- **Severity**: ${incident.severity}
- **Status**: RESOLVED
- **Affected Services**: ${incident.affectedServices.join(", ")}
- **Created At**: ${incident.createdAt}
- **Resolved At**: ${incident.resolvedAt}
- **Mean Time to Resolution (MTTR)**: ${durationMins} minutes

## Summary
${incident.description}

## Timeline
${incident.timeline.map((t) => `- [${t.timestamp}] (${t.actor}): ${t.description}`).join("\n")}

## Resolution Details
${resolutionDetails}

## Corrective Actions & Prevention Plan
1. Improve alerting thresholds for ${incident.affectedServices.join(" and ")}.
2. Conduct resilience drill and failover testing to verify redundancy.
3. Update architectural diagrams and on-call runbook schemas.`;
  }

  private static prune() {
    this.incidents = this.incidents.filter((inc) => !RetentionPolicyService.isExpired(inc.createdAt, "incidentsDays"));
  }
}
