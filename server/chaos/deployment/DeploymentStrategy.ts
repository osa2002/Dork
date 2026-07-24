import { StrategyType, CloudRunRevisionConfig } from "./DeploymentDefinition";
import { DeploymentContext } from "./DeploymentContext";

export interface StrategyStep {
  readonly stepNumber: number;
  readonly name: string;
  readonly trafficWeight: number; // 0 to 100
  readonly validationWaitMs: number;
  readonly description: string;
}

export interface StrategyPlan {
  readonly strategyType: StrategyType;
  readonly name: string;
  readonly description: string;
  readonly trafficSplittingSupported: boolean;
  readonly zeroDowntime: boolean;
  readonly steps: readonly StrategyStep[];
}

export class DeploymentStrategy {
  public static getStrategyPlan(strategy: StrategyType, cloudRun: CloudRunRevisionConfig): StrategyPlan {
    switch (strategy) {
      case "Rolling":
        return {
          strategyType: "Rolling",
          name: "Rolling Deployment",
          description: "Incrementally update instances from previous revision to target revision.",
          trafficSplittingSupported: true,
          zeroDowntime: true,
          steps: [
            { stepNumber: 1, name: "Deploy New Revision Staging", trafficWeight: 0, validationWaitMs: 1000, description: "Provision new revision without routing traffic." },
            { stepNumber: 2, name: "Partial Rolling Transition", trafficWeight: 50, validationWaitMs: 2000, description: "Shift 50% traffic to new revision." },
            { stepNumber: 3, name: "Complete Traffic Switch", trafficWeight: 100, validationWaitMs: 1000, description: "Shift 100% traffic to new revision and drain old instances." },
          ],
        };

      case "BlueGreen":
        return {
          strategyType: "BlueGreen",
          name: "Blue/Green Zero-Downtime Deployment",
          description: "Deploy Green revision alongside Blue, run health probes, then instantly switch 100% traffic.",
          trafficSplittingSupported: true,
          zeroDowntime: true,
          steps: [
            { stepNumber: 1, name: "Deploy Green Environment", trafficWeight: 0, validationWaitMs: 2000, description: "Build Green revision in isolation." },
            { stepNumber: 2, name: "Green Revision Health & Integration Validation", trafficWeight: 0, validationWaitMs: 3000, description: "Run automated synthetic probes against Green endpoints." },
            { stepNumber: 3, name: "Instant Traffic Cutover (Blue -> Green)", trafficWeight: 100, validationWaitMs: 1000, description: "Atomic traffic migration to Green revision." },
            { stepNumber: 4, name: "Blue Revision Decommissioning", trafficWeight: 100, validationWaitMs: 0, description: "Scale Blue revision to 0 min instances." },
          ],
        };

      case "Canary":
        return {
          strategyType: "Canary",
          name: "Canary Progressive Traffic Splitting Deployment",
          description: "Expose new revision to a 10% canary traffic slice, monitor telemetry error rates, then complete rollout.",
          trafficSplittingSupported: true,
          zeroDowntime: true,
          steps: [
            { stepNumber: 1, name: "Canary Release (10%)", trafficWeight: 10, validationWaitMs: 3000, description: "Route 10% live traffic to canary revision." },
            { stepNumber: 2, name: "Canary Telemetry & Error Rate Audit", trafficWeight: 10, validationWaitMs: 2000, description: "Monitor error rates, latency p99, and memory metrics." },
            { stepNumber: 3, name: "Canary Expansion (50%)", trafficWeight: 50, validationWaitMs: 2000, description: "Expand traffic split to 50%." },
            { stepNumber: 4, name: "Full Promotion (100%)", trafficWeight: 100, validationWaitMs: 1000, description: "Complete rollout and set target as active primary." },
          ],
        };

      case "ProgressiveRollout":
        return {
          strategyType: "ProgressiveRollout",
          name: "Progressive Multi-Stage Rollout",
          description: "Multi-stage automated rollout across regional canary pods and traffic clusters.",
          trafficSplittingSupported: true,
          zeroDowntime: true,
          steps: [
            { stepNumber: 1, name: "Internal Stage 1 (25%)", trafficWeight: 25, validationWaitMs: 1000, description: "Route 25% traffic." },
            { stepNumber: 2, name: "Stage 2 (75%)", trafficWeight: 75, validationWaitMs: 1000, description: "Route 75% traffic." },
            { stepNumber: 3, name: "Final Stage (100%)", trafficWeight: 100, validationWaitMs: 1000, description: "Route 100% traffic." },
          ],
        };

      case "EmergencyRollback":
        return {
          strategyType: "EmergencyRollback",
          name: "Emergency Instant Rollback",
          description: "Atomic instant reversion of Cloud Run traffic tags to previous certified healthy revision.",
          trafficSplittingSupported: true,
          zeroDowntime: true,
          steps: [
            { stepNumber: 1, name: "Freeze Inbound Deployments", trafficWeight: 0, validationWaitMs: 0, description: "Lock deployment pipeline." },
            { stepNumber: 2, name: "Atomic Traffic Cutover to Previous Revision", trafficWeight: 100, validationWaitMs: 500, description: "Shift 100% Cloud Run traffic to last known good revision." },
            { stepNumber: 3, name: "Health Verification", trafficWeight: 100, validationWaitMs: 1000, description: "Verify system health score >= 90% post-reversion." },
          ],
        };

      default:
        return this.getStrategyPlan("BlueGreen", cloudRun);
    }
  }

  public static recommendStrategy(context: DeploymentContext): StrategyType {
    if (context.emergencyOverride) {
      return "EmergencyRollback";
    }

    if (context.environment === "production") {
      if (context.changeRiskScore > 40 || context.releaseComplexity === "CRITICAL" || context.releaseComplexity === "HIGH") {
        return "Canary";
      }
      return "BlueGreen";
    }

    if (context.environment === "staging") {
      return "Rolling";
    }

    return "ProgressiveRollout";
  }
}
