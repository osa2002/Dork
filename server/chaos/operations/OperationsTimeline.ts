import { EnterpriseEventBus, OperationalEvent } from "../governance/EnterpriseEventBus";

export interface ExecutionChain {
  correlationId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  eventCount: number;
  status: "SUCCESS" | "DEGRADED" | "FAILED" | "IN_PROGRESS";
  events: OperationalEvent[];
}

export class OperationsTimeline {
  /**
   * Reconstructs execution chains from the Enterprise Event Bus history.
   * Scans and aggregates related events by correlationId.
   */
  public static reconstructExecutionChains(): ExecutionChain[] {
    const history = EnterpriseEventBus.getHistory();
    const chainsMap = new Map<string, OperationalEvent[]>();

    // Group events by correlationId
    for (const event of history) {
      if (!event.correlationId) continue;
      const chain = chainsMap.get(event.correlationId) || [];
      chain.push(event);
      chainsMap.set(event.correlationId, chain);
    }

    const executionChains: ExecutionChain[] = [];

    for (const [correlationId, events] of chainsMap.entries()) {
      // Sort chronologically ascending (earliest event first)
      const sortedEvents = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const startTime = sortedEvents[0].timestamp;
      const endTime = sortedEvents[sortedEvents.length - 1].timestamp;
      const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Determine chain status based on events
      let status: "SUCCESS" | "DEGRADED" | "FAILED" | "IN_PROGRESS" = "SUCCESS";

      const hasFailures = sortedEvents.some(
        (e) =>
          e.type === "ExperimentFailed" ||
          (e.payload && (e.payload.success === false || e.payload.status === "FAILED"))
      );

      const hasDegradations = sortedEvents.some(
        (e) =>
          e.payload &&
          (e.payload.status === "DEGRADED" || e.payload.currentStatus === "DEGRADED")
      );

      const isInProgress = sortedEvents.some(
        (e) => e.payload && e.payload.status === "IN_PROGRESS"
      );

      if (hasFailures) {
        status = "FAILED";
      } else if (hasDegradations) {
        status = "DEGRADED";
      } else if (isInProgress) {
        status = "IN_PROGRESS";
      }

      executionChains.push({
        correlationId,
        startTime,
        endTime,
        durationMs,
        eventCount: sortedEvents.length,
        status,
        events: sortedEvents,
      });
    }

    // Sort chains by startTime descending (newest chain first)
    return executionChains.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * Retrieves a single specific execution chain by correlationId.
   */
  public static getChainById(correlationId: string): ExecutionChain | undefined {
    const chains = this.reconstructExecutionChains();
    return chains.find((c) => c.correlationId === correlationId);
  }
}
