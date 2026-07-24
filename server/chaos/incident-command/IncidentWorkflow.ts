import { IncidentSeverityLevel } from "./IncidentSeverity";

export interface WorkflowStep {
  readonly sequence: number;
  readonly phase: "TRIAGE" | "ISOLATION" | "MITIGATION" | "VALIDATION" | "POSTMORTEM";
  readonly title: string;
  readonly description: string;
  readonly recommendedAction: string;
  readonly automatedRunbookId?: string;
  readonly requiredApproverRole?: "VP_TECH_OPS" | "SRE_LEAD" | "DEVELOPER" | "NONE";
}

export interface IncidentWorkflowPlaybook {
  readonly incidentId: string;
  readonly severity: IncidentSeverityLevel;
  readonly playbookName: string;
  readonly steps: readonly WorkflowStep[];
  readonly totalSteps: number;
}

export class IncidentWorkflow {
  /**
   * Generates a step-by-step mitigation playbook tailored statelessly.
   */
  public static plan(incidentId: string, severity: IncidentSeverityLevel, affectedSubsystems: readonly string[]): IncidentWorkflowPlaybook {
    const steps: WorkflowStep[] = [];
    let playbookName = "Standard Operational Incident Runbook";

    // Step 1: Paging SRE team
    steps.push({
      sequence: 1,
      phase: "TRIAGE",
      title: "Activate Incident Command Center",
      description: `Staff incident commander roles, open Slack channels, and establish active Zoom/Meet bridge.`,
      recommendedAction: `Paging designated on-call response team via PagerDuty.`,
      requiredApproverRole: "NONE"
    });

    // Step 2: System Isolation / Circuit Breaker / Feature Flags
    if (severity === "SEV1" || severity === "SEV2") {
      playbookName = "Enterprise Crisis Disaster Recovery Plan";
      
      const containsGateway = affectedSubsystems.some(s => s.toLowerCase().includes("gateway") || s.toLowerCase().includes("ingress"));
      if (containsGateway) {
        steps.push({
          sequence: 2,
          phase: "ISOLATION",
          title: "API Gateway Traffic Shedding",
          description: "Limit non-critical traffic at the gateway to prevent complete system cascade.",
          recommendedAction: "Apply rate limiting or circuit breaker rules via Digital Twin and Operational Control Plane.",
          automatedRunbookId: "rb-shed-traffic-v1",
          requiredApproverRole: "VP_TECH_OPS"
        });
      } else {
        steps.push({
          sequence: 2,
          phase: "ISOLATION",
          title: "Graceful Subsystem Degrade / Flag Disablement",
          description: `Isolate degraded subsystems: ${affectedSubsystems.join(", ")} from main system workflows.`,
          recommendedAction: "Bypass or disable associated feature flags in Operational Control Plane.",
          automatedRunbookId: "rb-flag-bypass-v1",
          requiredApproverRole: "SRE_LEAD"
        });
      }

      // Step 3: Mitigation Strategy
      steps.push({
        sequence: 3,
        phase: "MITIGATION",
        title: "Autonomous Recovery & Automated Triage Rollback",
        description: "Trigger rollback of recent change deployments or scale up underlying stateless pods.",
        recommendedAction: "Initiate autonomous recovery protocol for rollback of latest unstable container footprint.",
        automatedRunbookId: "rb-rollback-v3",
        requiredApproverRole: "SRE_LEAD"
      });
    } else {
      // Minor incidents
      steps.push({
        sequence: 2,
        phase: "ISOLATION",
        title: "Telemetry Diagnostics & Target Isolation",
        description: `Analyze telemetry markers on subsystems: ${affectedSubsystems.join(", ")}.`,
        recommendedAction: "Ensure fallback caches are serving degraded traffic routes.",
        requiredApproverRole: "NONE"
      });

      steps.push({
        sequence: 3,
        phase: "MITIGATION",
        title: "Subsystem Cold Restart / Node Refresh",
        description: "Restart underlying Kubernetes pods or system processes for degraded targets.",
        recommendedAction: "Restart pods sequentially using continuous validation checks.",
        automatedRunbookId: "rb-pod-restart-v1",
        requiredApproverRole: "NONE"
      });
    }

    // Step 4: Continuous Validation / Post-mitigation verification
    steps.push({
      sequence: 4,
      phase: "VALIDATION",
      title: "Run Continuous Validation Verification suite",
      description: "Trigger comprehensive API sanity testing, canary analysis, and SLA verification.",
      recommendedAction: "Trigger Phase 10.16 Validation Workflow to verify zero error regressions.",
      automatedRunbookId: "rb-run-validation-suite",
      requiredApproverRole: "NONE"
    });

    // Step 5: Postmortem Closure
    steps.push({
      sequence: 5,
      phase: "POSTMORTEM",
      title: "Resolve Incident & Compile SRE Postmortem",
      description: "De-escalate incident, restore status pages, compile Root Cause Analysis (RCA), and complete actions log.",
      recommendedAction: "Archive incident record, log timeline to Knowledge Repository, publish resolution event.",
      requiredApproverRole: "NONE"
    });

    return Object.freeze({
      incidentId,
      severity,
      playbookName,
      steps: Object.freeze(steps),
      totalSteps: steps.length,
    });
  }
}
