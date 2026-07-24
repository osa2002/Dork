import { IncidentDefinitionPayload } from "./IncidentDefinition";
import { IncidentSeverityLevel } from "./IncidentSeverity";

export interface PostmortemData {
  readonly rcaSummary: string;
  readonly rootCause: string;
  readonly contributingFactors: readonly string[];
  readonly preventiveActions: readonly string[];
  readonly mttrMinutes: number;
}

export class PostmortemEngine {
  /**
   * Generates Root Cause Analysis and preventive tasks.
   */
  public static analyze(definition: IncidentDefinitionPayload, severity: IncidentSeverityLevel): PostmortemData {
    const contributingFactors: string[] = [];
    const preventiveActions: string[] = [];
    let rootCause = "";
    let rcaSummary = "";
    let mttrMinutes = 30; // standard recovery loop duration

    const affected = definition.affectedSubsystems.join(", ");

    // Generate root cause and factors based on affected subsystems and severity
    if (severity === "SEV1") {
      mttrMinutes = 45;
      rcaSummary = `Severe degradation of ${affected} cascading due to high concurrent load or regression under test.`;
      rootCause = `Memory contention combined with insufficient rate-limiting at the ingress gateway caused request queues to fill up, blocking SRE diagnostic connections.`;
      
      contributingFactors.push("Rapidly spiked error rates overwhelmed thread pool sizes.");
      contributingFactors.push("Aggressive client retry loops caused self-induced denial of service (DoS).");
      contributingFactors.push("Continuous validation metrics were initially logged under silent mode.");

      preventiveActions.push("Deploy localized circuit breakers at the API gateway layer.");
      preventiveActions.push("Integrate Digital Twin topology mappings directly to automated load-shedding policies.");
      preventiveActions.push("Establish automated rollback triggers via Prediction Engine forecasts.");
    } else if (severity === "SEV2") {
      mttrMinutes = 25;
      rcaSummary = `Subsystem failure in ${affected} leading to increased API P99 latency.`;
      rootCause = `Recent continuous deployment payload introduced a database thread lock blocking standard async workers.`;

      contributingFactors.push("Database connection pool size limits reached.");
      contributingFactors.push("Telemetry alert thresholds were configured with stale latency values.");

      preventiveActions.push("Optimize async connection management with custom pool drivers.");
      preventiveActions.push("Enforce stricter lint & static compilation criteria in CI/CD pipeline validations.");
    } else {
      mttrMinutes = 15;
      rcaSummary = `Minor performance drop in isolated module of ${affected}.`;
      rootCause = `Transient network packet loss or garbage collection (GC) pause.`;

      contributingFactors.push("Stale local process cache size bloating.");
      preventiveActions.push("Configure regular automated memory sweeps and container restarts.");
    }

    return Object.freeze({
      rcaSummary,
      rootCause,
      contributingFactors: Object.freeze(contributingFactors),
      preventiveActions: Object.freeze(preventiveActions),
      mttrMinutes,
    });
  }
}
