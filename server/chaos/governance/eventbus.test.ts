import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnterpriseEventBus, OperationalEvent, EventType } from "./EnterpriseEventBus";

describe("Enterprise Event Bus & EOC Dispatcher", () => {
  beforeEach(() => {
    EnterpriseEventBus.clear();
    EnterpriseEventBus.setLimits(5, 3); // Small limits for easy overflow testing
  });

  it("should successfully subscribe and receive published operational events", async () => {
    const received: OperationalEvent[] = [];
    
    EnterpriseEventBus.subscribe("Test Subscriber 1", "HealthChanged", (event) => {
      received.push(event);
    });

    const payload = { previousStatus: "HEALTHY", currentStatus: "DEGRADED", impactScore: 40 };
    const eventId = EnterpriseEventBus.publish("HealthChanged", payload, "corr-123");

    expect(eventId).toBeDefined();

    // Allow async non-blocking dispatch loop to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0].type).toBe("HealthChanged");
    expect(received[0].correlationId).toBe("corr-123");
    expect(received[0].payload).toEqual(payload);
  });

  it("should support wildcard subscription receiving any published event type", async () => {
    const received: OperationalEvent[] = [];

    EnterpriseEventBus.subscribe("Global Monitor", "*", (event) => {
      received.push(event);
    });

    EnterpriseEventBus.publish("IncidentCreated", { incidentId: "inc-1" });
    EnterpriseEventBus.publish("AlertTriggered", { alertId: "alt-1" });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received.length).toBe(2);
    expect(received.map((e) => e.type)).toContain("IncidentCreated");
    expect(received.map((e) => e.type)).toContain("AlertTriggered");
  });

  it("should respect subscription execution order if multiple subscribers are registered", async () => {
    const runOrder: string[] = [];

    EnterpriseEventBus.subscribe("Subscriber Low Order", "ChaosStarted", () => {
      runOrder.push("low");
    }, 10);

    EnterpriseEventBus.subscribe("Subscriber High Order", "ChaosStarted", () => {
      runOrder.push("high");
    }, 200);

    EnterpriseEventBus.subscribe("Subscriber Default Order", "ChaosStarted", () => {
      runOrder.push("default");
    }); // default order is 100

    EnterpriseEventBus.publish("ChaosStarted", {});

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Expected order: 10 (low) -> 100 (default) -> 200 (high)
    expect(runOrder).toEqual(["low", "default", "high"]);
  });

  it("should handle subscriber errors gracefully without breaking the pipeline and log them in diagnostics", async () => {
    const successfulReceived: OperationalEvent[] = [];

    // Fails on purpose
    EnterpriseEventBus.subscribe("Faulty Subscriber", "MetricsUpdated", () => {
      throw new Error("Simulated subscriber crash");
    });

    // Healthy subscriber running afterward
    EnterpriseEventBus.subscribe("Resilient Subscriber", "MetricsUpdated", (event) => {
      successfulReceived.push(event);
    }, 200);

    EnterpriseEventBus.publish("MetricsUpdated", { cpu: 85 });

    await new Promise((resolve) => setTimeout(resolve, 10));

    // The healthy subscriber should still execute successfully
    expect(successfulReceived.length).toBe(1);

    // Diagnostics should have captured the failure
    const diagnostics = EnterpriseEventBus.getDiagnostics();
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].subscriberName).toBe("Faulty Subscriber");
    expect(diagnostics[0].errorMessage).toBe("Simulated subscriber crash");
    expect(diagnostics[0].eventType).toBe("MetricsUpdated");
  });

  it("should enforce bounded memory limits on event history and diagnostics logs", async () => {
    // We configured limit to 5 events in beforeEach
    for (let i = 1; i <= 10; i++) {
      EnterpriseEventBus.publish("SystemStateChanged", { index: i });
    }

    const history = EnterpriseEventBus.getHistory();
    expect(history.length).toBe(5);
    // Should contain the newest events (LIFO/unshift order)
    expect(history[0].payload.index).toBe(10);
    expect(history[4].payload.index).toBe(6);

    // Diagnostics limit was set to 3
    EnterpriseEventBus.subscribe("Faulty Sub", "*", () => {
      throw new Error("Crash");
    });

    for (let i = 0; i < 5; i++) {
      EnterpriseEventBus.publish("HealthChanged", {});
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(EnterpriseEventBus.getDiagnostics().length).toBe(3);
  });

  it("should allow unsubscribe to cancel active event subscriptions", async () => {
    const received: OperationalEvent[] = [];
    const subId = EnterpriseEventBus.subscribe("Temporary Subscriber", "AlertTriggered", (event) => {
      received.push(event);
    });

    EnterpriseEventBus.publish("AlertTriggered", { val: 1 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(received.length).toBe(1);

    const unsubscribed = EnterpriseEventBus.unsubscribe(subId);
    expect(unsubscribed).toBe(true);

    EnterpriseEventBus.publish("AlertTriggered", { val: 2 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Count remains 1 since subscriber was removed
    expect(received.length).toBe(1);
  });
});
