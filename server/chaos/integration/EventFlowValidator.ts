import { EnterpriseEventBus, EventType, OperationalEvent } from "../governance/EnterpriseEventBus";

export interface EventFlowValidationResult {
  success: boolean;
  publishedEvents: string[];
  receivedEvents: string[];
  duplicateEvents: string[];
  malformedEvents: string[];
  preservedFields: {
    correlationId: boolean;
    executionId: boolean;
    timestamp: boolean;
  };
}

export class EventFlowValidator {
  /**
   * Runs an event flow verification sequence on the Enterprise Event Bus.
   * Ensures correlation IDs, execution IDs, and timestamps are correctly preserved, with zero duplications.
   */
  public static async validate(): Promise<EventFlowValidationResult> {
    const correlationId = `corr-flow-test-${Math.random().toString(36).substring(2, 9)}`;
    const executionId = `exec-flow-test-${Math.random().toString(36).substring(2, 9)}`;

    const eventsToTest: { type: EventType; payload: any }[] = [
      { type: "ChaosStarted", payload: { executionId, scenarios: ["Test Integration Scenario"] } },
      { type: "ChaosCompleted", payload: { executionId, status: "success", durationMs: 120 } },
      { type: "KnowledgeCreated", payload: { executionId, recordId: "rec-flow-123" } },
      { type: "PredictionCreated", payload: { executionId, predictionId: "pred-flow-456", riskScore: 40 } },
      { type: "RecoveryCompleted", payload: { executionId, workflow: "Rollback", success: true } },
    ];

    const received: OperationalEvent[] = [];
    const subscriberIds: string[] = [];

    // Register a wildcard subscriber to capture all test events under our specific correlationId
    const subId = EnterpriseEventBus.subscribe("EventFlowValidatorWildcard", "*", (evt) => {
      if (evt.correlationId === correlationId) {
        received.push(evt);
      }
    });
    subscriberIds.push(subId);

    // Publish all events
    const publishedIds: string[] = [];
    for (const item of eventsToTest) {
      const id = EnterpriseEventBus.publish(item.type, item.payload, correlationId);
      publishedIds.push(id);
    }

    // Since event bus uses setTimeout(..., 0) for dispatching, we yield execution
    await new Promise((resolve) => setTimeout(resolve, 15));

    // Clean up our subscriptions
    for (const id of subscriberIds) {
      EnterpriseEventBus.unsubscribe(id);
    }

    // Analyze received events
    const receivedTypes = received.map((r) => r.type);
    const receivedIds = received.map((r) => r.id);
    
    // Find duplicate deliveries
    const duplicateEvents: string[] = [];
    const seenIds = new Set<string>();
    for (const id of receivedIds) {
      if (seenIds.has(id)) {
        duplicateEvents.push(id);
      }
      seenIds.add(id);
    }

    // Verify fields are preserved
    let allCorrIdPreserved = true;
    let allExecIdPreserved = true;
    let allTimestampsValid = true;
    const malformedEvents: string[] = [];

    for (const evt of received) {
      if (evt.correlationId !== correlationId) {
        allCorrIdPreserved = false;
        malformedEvents.push(`${evt.type}: correlationId mismatch`);
      }
      if (evt.payload?.executionId !== executionId) {
        allExecIdPreserved = false;
        malformedEvents.push(`${evt.type}: executionId missing/mismatch in payload`);
      }
      if (!evt.timestamp || isNaN(Date.parse(evt.timestamp))) {
        allTimestampsValid = false;
        malformedEvents.push(`${evt.type}: invalid timestamp`);
      }
    }

    // Determine success
    const expectedTypes = eventsToTest.map((e) => e.type);
    const allExpectedTypesReceived = expectedTypes.every((t) => receivedTypes.includes(t));
    const success =
      allExpectedTypesReceived &&
      duplicateEvents.length === 0 &&
      allCorrIdPreserved &&
      allExecIdPreserved &&
      allTimestampsValid &&
      malformedEvents.length === 0;

    return {
      success,
      publishedEvents: expectedTypes,
      receivedEvents: receivedTypes,
      duplicateEvents,
      malformedEvents,
      preservedFields: {
        correlationId: allCorrIdPreserved,
        executionId: allExecIdPreserved,
        timestamp: allTimestampsValid,
      },
    };
  }
}
