import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IncidentDefinition } from "./IncidentDefinition";
import { IncidentContext } from "./IncidentContext";
import { IncidentSeverity } from "./IncidentSeverity";
import { IncidentCommander } from "./IncidentCommander";
import { IncidentWorkflow } from "./IncidentWorkflow";
import { IncidentTimeline } from "./IncidentTimeline";
import { IncidentCommunication } from "./IncidentCommunication";
import { IncidentActionLog } from "./IncidentActionLog";
import { PostmortemEngine } from "./PostmortemEngine";
import { IncidentReporter } from "./IncidentReporter";
import { IncidentCommandEngine } from "./IncidentCommandEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise Incident Command System Test Suite", () => {
  beforeEach(() => {
    EnterpriseEventBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("IncidentDefinition", () => {
    it("should instantiate an immutable incident definition with structural safety", () => {
      const def = IncidentDefinition.create({
        title: "Redis Outage",
        description: "Latency exceeding 5000ms on session stores",
        affectedSubsystems: ["session-cache", "redis-cluster"],
        reporter: {
          id: "usr-sre-1",
          name: "Alice Smith",
          role: "SRE_LEAD",
          team: "SRE Foundations",
        },
        metricsSnapshot: {
          errorRate: 0.15,
          p99LatencyMs: 5200,
        },
      });

      expect(def.id).toBeDefined();
      expect(def.id).toMatch(/^inc-[a-z0-9]+/);
      expect(def.title).toBe("Redis Outage");
      expect(def.reporter.role).toBe("SRE_LEAD");
      expect(def.metricsSnapshot?.errorRate).toBe(0.15);
      expect(Object.isFrozen(def)).toBe(true);
    });
  });

  describe("IncidentContext", () => {
    it("should compile a read-only snapshot containing all required SRE integrations", () => {
      const context = IncidentContext.compile("production");

      expect(context.timestamp).toBeDefined();
      expect(context.environment).toBe("production");
      expect(context.liveState).toBeDefined();
      expect(context.governanceData).toBeDefined();
      expect(context.twinSnapshot).toBeDefined();
      expect(context.failureProbabilityPrediction).toBeDefined();
      expect(context.recentValidationRuns).toBeDefined();
      expect(context.recentRecoveries).toBeDefined();
      expect(context.knowledgeRecords).toBeDefined();
      expect(context.recentChanges).toBeDefined();
      expect(context.recentReleases).toBeDefined();
      expect(context.recentDecisions).toBeDefined();
      expect(context.controlPlaneHealth).toBeDefined();
    });
  });

  describe("IncidentSeverity", () => {
    it("should classify critical levels (SEV1) correctly on elevated metrics", () => {
      const context = IncidentContext.compile("production");
      const def = IncidentDefinition.create({
        title: "Gateway Degradation",
        description: "Error rate spikes on ingress routing",
        affectedSubsystems: ["ingress-gateway", "auth-service"],
        reporter: {
          id: "sys-monitoring",
          name: "Prometheus Alerter",
          role: "SYSTEM_ALERTER",
          team: "SRE Core",
        },
        metricsSnapshot: {
          errorRate: 0.12,
          p99LatencyMs: 1400,
        },
      });

      const triage = IncidentSeverity.classify(def, context);

      expect(triage.level).toBe("SEV1");
      expect(triage.confidence).toBeDefined();
      expect(triage.triggers.some((t) => t.includes("Critical error rate"))).toBe(true);
      expect(triage.triggers.some((t) => t.includes("Critical P99 latency"))).toBe(true);
      expect(triage.description).toContain("CRITICAL SEVERITY");
    });

    it("should classify major levels (SEV2) correctly on intermediate error rates", () => {
      const context = IncidentContext.compile("production");
      const def = IncidentDefinition.create({
        title: "Session Cache Warning",
        description: "Warm up cache threads full",
        affectedSubsystems: ["session-cache"],
        reporter: {
          id: "sys-monitoring",
          name: "Prometheus Alerter",
          role: "SYSTEM_ALERTER",
          team: "SRE Core",
        },
        metricsSnapshot: {
          errorRate: 0.05,
          p99LatencyMs: 600,
        },
      });

      const triage = IncidentSeverity.classify(def, context);

      expect(triage.level).toBe("SEV2");
      expect(triage.triggers.some((t) => t.includes("High error rate"))).toBe(true);
      expect(triage.description).toContain("MAJOR SEVERITY");
    });

    it("should classify trivial issues as SEV4", () => {
      const context = IncidentContext.compile("production");
      const def = IncidentDefinition.create({
        title: "Spurious Info Message",
        description: "Minor informational note on batch daemon",
        affectedSubsystems: ["batch-scheduler"],
        reporter: {
          id: "sys-monitoring",
          name: "Prometheus Alerter",
          role: "SYSTEM_ALERTER",
          team: "SRE Core",
        },
        metricsSnapshot: {
          errorRate: 0.0,
          p99LatencyMs: 20,
        },
      });

      const triage = IncidentSeverity.classify(def, context);

      expect(triage.level).toBe("SEV4");
      expect(triage.description).toContain("Trivial incident");
    });
  });

  describe("IncidentCommander", () => {
    it("should staff incident command teams dynamically according to severity", () => {
      const staffing1 = IncidentCommander.staff("SEV1", "inc-xyz123");
      const staffing2 = IncidentCommander.staff("SEV2", "inc-xyz123");
      const staffing4 = IncidentCommander.staff("SEV4", "inc-xyz123");

      expect(staffing1.primaryCommander.name).toBe("Marcus Vance");
      expect(staffing1.slackChannel).toBe("#incident-xyz123");
      expect(staffing1.warRoomUrl).toContain("war-room-xyz123");

      expect(staffing2.primaryCommander.name).toBe("Alex Rivera");
      expect(staffing4.primaryCommander.name).toBe("Elena Rostova");
    });
  });

  describe("IncidentWorkflow", () => {
    it("should construct a tailored crisis playbook for SEV1 incidents", () => {
      const playbook = IncidentWorkflow.plan("inc-abc", "SEV1", ["api-gateway"]);

      expect(playbook.playbookName).toContain("Enterprise Crisis");
      expect(playbook.totalSteps).toBe(5);
      expect(playbook.steps[1].phase).toBe("ISOLATION");
      expect(playbook.steps[1].requiredApproverRole).toBe("VP_TECH_OPS");
    });

    it("should construct a normal playbook for lighter incident loads", () => {
      const playbook = IncidentWorkflow.plan("inc-abc", "SEV3", ["payment-v1"]);

      expect(playbook.playbookName).toContain("Standard Operational");
      expect(playbook.steps[1].requiredApproverRole).toBe("NONE");
    });
  });

  describe("IncidentTimeline & IncidentCommunication & IncidentActionLog", () => {
    it("should generate timelines, notifications history, and action audit records correctly", () => {
      const def = IncidentDefinition.create({
        title: "Checkout Degradation",
        description: "Database queries locked up",
        affectedSubsystems: ["checkout-db"],
        reporter: {
          id: "sys-alert",
          name: "Alert Manager",
          role: "SYSTEM_ALERTER",
          team: "Ops Team",
        },
      });

      const timeline = IncidentTimeline.generate(def, "SEV2", "Yuki Tanaka");
      expect(timeline.events.length).toBe(7);
      expect(timeline.events[0].type).toBe("DETECTION");
      expect(timeline.events[6].type).toBe("RESOLUTION");

      const staffing = IncidentCommander.staff("SEV2", def.id);
      const comms = IncidentCommunication.compileLogs(def, "SEV2", staffing);
      expect(comms.logs.length).toBe(4);
      expect(comms.logs[0].channel).toBe("PAGER_DUTY");
      expect(comms.logs[2].channel).toBe("STATUS_PAGE");

      const playbook = IncidentWorkflow.plan(def.id, "SEV2", def.affectedSubsystems);
      const actions = IncidentActionLog.compile(def.id, playbook.steps, "Yuki Tanaka", def.detectedAt);
      expect(actions.entries.length).toBe(playbook.totalSteps);
      expect(actions.entries[0].stepSequence).toBe(1);
    });
  });

  describe("PostmortemEngine", () => {
    it("should diagnose SEV1 root causes and preventive actions with SRE precision", () => {
      const def = IncidentDefinition.create({
        title: "Auth Gateway Blackout",
        description: "All authentication verification requests fail with 504 Gateway Timeout",
        affectedSubsystems: ["auth-gateway"],
        reporter: {
          id: "sys-health",
          name: "Consul Health Check",
          role: "SYSTEM_ALERTER",
          team: "SRE Platform",
        },
      });

      const analysis = PostmortemEngine.analyze(def, "SEV1");

      expect(analysis.mttrMinutes).toBe(45);
      expect(analysis.contributingFactors.length).toBeGreaterThan(0);
      expect(analysis.preventiveActions.length).toBeGreaterThan(0);
      expect(analysis.rootCause).toContain("Memory contention");
    });
  });

  describe("IncidentCommandEngine", () => {
    it("should orchestrate full incident response and publish SRE events to the bus", async () => {
      const def = IncidentDefinition.create({
        title: "Total Gateway Lockup",
        description: "Load average spiked above critical threshold",
        affectedSubsystems: ["ingress-gateway"],
        reporter: {
          id: "user-sre",
          name: "Elena Rostova",
          role: "SRE_LEAD",
          team: "Global NOC",
        },
        metricsSnapshot: {
          errorRate: 0.18,
          p99LatencyMs: 3200,
        },
      });

      // Track published EventBus events
      const receivedEvents: string[] = [];
      EnterpriseEventBus.subscribe("test-sub-inc-created", "IncidentCreated", (evt) => {
        receivedEvents.push(evt.type);
      });
      EnterpriseEventBus.subscribe("test-sub-sys-state", "SystemStateChanged", (evt) => {
        receivedEvents.push(evt.type);
      });

      const orchestration = IncidentCommandEngine.coordinate(def, "production");

      expect(orchestration.triage.level).toBe("SEV1");
      expect(orchestration.staffing.primaryCommander.name).toBe("Marcus Vance");
      expect(orchestration.timeline.events.length).toBe(7);
      expect(orchestration.postmortem.mttrMinutes).toBe(45);

      // Verify beautiful structured Markdown & JSON summaries are compiled
      expect(orchestration.reportMarkdown).toContain("# ENTERPRISE INCIDENT COMMAND BRIEFING");
      expect(orchestration.reportMarkdown).toContain("Total Gateway Lockup");
      expect(orchestration.reportJson).toBeDefined();

      const parsedJson = JSON.parse(orchestration.reportJson);
      expect(parsedJson.definition.id).toBe(def.id);

      // Verify asynchronous dispatching loops on EventBus
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(receivedEvents).toContain("IncidentCreated");
      expect(receivedEvents).toContain("SystemStateChanged");
    });
  });
});
