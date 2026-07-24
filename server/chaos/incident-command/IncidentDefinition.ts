export interface IncidentReporterDetails {
  readonly id: string;
  readonly name: string;
  readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "SYSTEM_ALERTER";
  readonly team: string;
}

export interface IncidentDefinitionPayload {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly affectedSubsystems: readonly string[];
  readonly reporter: IncidentReporterDetails;
  readonly detectedAt: string;
  readonly metricsSnapshot?: {
    readonly errorRate?: number; // e.g. 0.05 (5%)
    readonly p99LatencyMs?: number; // e.g. 1200
    readonly concurrentConnections?: number;
  };
}

export class IncidentDefinition {
  /**
   * Helper to instantiate a fully immutable, frozen Incident Definition.
   */
  public static create(data: Omit<IncidentDefinitionPayload, "id" | "detectedAt">): IncidentDefinitionPayload {
    const id = `inc-${Math.random().toString(36).substring(2, 9)}`;
    const record: IncidentDefinitionPayload = {
      ...data,
      id,
      detectedAt: new Date().toISOString(),
    };

    return Object.freeze(record);
  }
}
