import { ChaosOrchestrator } from "../orchestrator/ChaosOrchestrator";
import { ChaosHistory } from "../orchestrator/ChaosHistory";
import { ChaosCoverageAnalyzer } from "./ChaosCoverageAnalyzer";
import { RuntimeDependencyGraph } from "./RuntimeDependencyGraph";

export interface Recommendation {
  experimentName: string;
  subsystem: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number; // 0 - 100
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  mitigationStrategy: string;
}

export class ChaosIntelligenceEngine {
  private static readonly EXPERIMENT_METADATA: Record<
    string,
    { risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; subsystem: string; mitigation: string }
  > = {
    // Level 1: Low Risk
    LatencyScenario: {
      risk: "LOW",
      subsystem: "Database Subsystem",
      mitigation: "Ensure client-side fetch timeouts and UX skeletons are configured to handle network delays gracefully.",
    },
    SchedulerDelayExperiment: {
      risk: "LOW",
      subsystem: "Cron & Archiving Scheduler",
      mitigation: "Add robust error catching and automatic execution retry on scheduler latency offsets.",
    },
    SchedulerFailureScenario: {
      risk: "LOW",
      subsystem: "Cron & Archiving Scheduler",
      mitigation: "Implement persistent scheduler state validation to avoid missed daily cron iterations.",
    },

    // Level 2: Medium Risk
    GeminiTimeoutExperiment: {
      risk: "MEDIUM",
      subsystem: "AI Wait-Time Engine",
      mitigation: "Implement robust client-side and server-side fallback wait time calculations when Google GenAI is throttled or offline.",
    },
    StripeTimeoutExperiment: {
      risk: "MEDIUM",
      subsystem: "Billing & Subscriptions",
      mitigation: "Utilize localized offline checkout simulators and robust sandbox fallback mechanisms when payment SDKs time out.",
    },
    TwilioTimeoutExperiment: {
      risk: "MEDIUM",
      subsystem: "Notification Subsystem",
      mitigation: "Implement retry queues and fall back to email dispatches if Twilio gateways fail to respond.",
    },
    SSEDisconnectExperiment: {
      risk: "MEDIUM",
      subsystem: "Notification Subsystem",
      mitigation: "Configure automated back-off reconnection strategies for Server-Sent Events clients.",
    },
    RateLimitStormExperiment: {
      risk: "MEDIUM",
      subsystem: "Cloud Infrastructure",
      mitigation: "Ensure rate-limiters are set with high-resolution sliding windows to protect container memory from denial-of-wallet storms.",
    },
    RateLimitScenario: {
      risk: "MEDIUM",
      subsystem: "Cloud Infrastructure",
      mitigation: "Style friendly 429 customer interfaces and add Retry-After HTTP headers.",
    },

    // Level 3: High Risk
    FirestoreContentionExperiment: {
      risk: "HIGH",
      subsystem: "Database Subsystem",
      mitigation: "Optimize transaction operations by keeping Firestore document sizes minimal and pre-aggregating counters.",
    },
    FirestoreHighLatencyExperiment: {
      risk: "HIGH",
      subsystem: "Database Subsystem",
      mitigation: "Configure local cache reads or transient in-memory buffers to mitigate database fetch delays.",
    },
    ExpressEventLoopDelayExperiment: {
      risk: "HIGH",
      subsystem: "Cloud Infrastructure",
      mitigation: "Avoid expensive synchronous calculations (e.g. large JSON parsing, nested iterations) in request pipelines.",
    },
    MemoryPressureExperiment: {
      risk: "HIGH",
      subsystem: "Cloud Infrastructure",
      mitigation: "Establish server-side heap constraints and garbage collect stale data references periodically.",
    },
    CPUPressureExperiment: {
      risk: "HIGH",
      subsystem: "Cloud Infrastructure",
      mitigation: "Delegate multi-threaded workloads or long-running computations off the main Express event loop.",
    },
    AuthFailureExperiment: {
      risk: "HIGH",
      subsystem: "Identity & Authentication",
      mitigation: "Implement fast Bearer token caching to prevent repetitive Firebase verification round-trips.",
    },

    // Level 4: Critical Risk
    CloudRunInstanceKillExperiment: {
      risk: "CRITICAL",
      subsystem: "Cloud Infrastructure",
      mitigation: "Design stateless REST gateways with separate storage engines so nodes can recycle without active session state loss.",
    },
    FirestoreNetworkPartitionExperiment: {
      risk: "CRITICAL",
      subsystem: "Database Subsystem",
      mitigation: "Implement circuit-breakers to instantly bypass Firestore lookups and serve locally cached parameters when partition occurs.",
    },
    FullDependencyBlackoutExperiment: {
      risk: "CRITICAL",
      subsystem: "Cloud Infrastructure",
      mitigation: "Validate that health check end-points continue to report degraded, fallback status instead of completely crashing the container.",
    },
  };

  /**
   * Generates intelligent, prioritized recommendations for the next chaos experiment.
   */
  public static getRecommendations(): Recommendation[] {
    const list = ChaosOrchestrator.getRegisteredExperiments();
    const history = ChaosHistory.getHistory();
    const coverage = ChaosCoverageAnalyzer.getCoverageReport();
    const depGraph = RuntimeDependencyGraph.getGraph();

    // Heuristic 1: Determine current risk tier based on testing coverage
    const lowCoverage = coverage.subsystems.find((s) => s.subsystemName === "Cron & Archiving Scheduler")?.coveragePercentage || 0;
    const dbCoverage = coverage.subsystems.find((s) => s.subsystemName === "Database Subsystem")?.coveragePercentage || 0;
    const isReadyForHighRisk = lowCoverage > 50 && dbCoverage > 30;

    const recommendations: Recommendation[] = [];

    for (const exp of list) {
      const name = exp.name;
      const meta = this.EXPERIMENT_METADATA[name] || {
        risk: "MEDIUM",
        subsystem: "Cloud Infrastructure",
        mitigation: "Design resilient recovery patterns to handle execution state disruption.",
      };

      let score = 50; // Baseline
      let reasons: string[] = [];

      // Heuristic 2: Risk Progression Model
      if (meta.risk === "LOW") {
        if (!isReadyForHighRisk) {
          score += 25;
          reasons.push("Recommended for baseline resilience validation before attempting critical disruption.");
        } else {
          score -= 15;
          reasons.push("Low-risk baselines are already verified; focus on higher risk tiers.");
        }
      } else if (meta.risk === "MEDIUM") {
        score += 10;
        reasons.push("Verifies vital third-party API boundary limits.");
      } else if (meta.risk === "HIGH") {
        if (isReadyForHighRisk) {
          score += 20;
          reasons.push("High priority: Ready to test system-level contention and process limits.");
        } else {
          score -= 10;
          reasons.push("Postponed: Complete low-risk baseline validation first.");
        }
      } else if (meta.risk === "CRITICAL") {
        if (isReadyForHighRisk) {
          score += 25;
          reasons.push("Critical path validation: Assess global fail-over resilience under total blackout.");
        } else {
          score -= 25;
          reasons.push("Locked: Defer high-blast-radius experiments until basic subsystems are hardened.");
        }
      }

      // Heuristic 3: Execution History & Freshness
      const hasExecuted = coverage.subsystems.some((sub) => sub.executedExperiments.includes(name));
      if (hasExecuted) {
        score -= 35;
        reasons.push("Already executed in this container lifecycle.");
      } else {
        score += 20;
        reasons.push("Untested surface: High recommendation to establish initial baseline.");
      }

      // Heuristic 4: Dependency Hot-spots (using RuntimeDependencyGraph telemetry)
      if (meta.subsystem === "Billing & Subscriptions") {
        const stripeEdge = depGraph.edges.find((e) => e.target === "StripeAPI");
        if (stripeEdge && stripeEdge.calls > 5) {
          score += 15;
          reasons.push("High billing dependency activity detected via runtime telemetry.");
        }
      } else if (meta.subsystem === "AI Wait-Time Engine") {
        const geminiEdge = depGraph.edges.find((e) => e.target === "GeminiAI");
        if (geminiEdge && geminiEdge.calls > 5) {
          score += 15;
          reasons.push("High AI dependency activity detected via runtime telemetry.");
        }
      } else if (meta.subsystem === "Database Subsystem") {
        const dbEdge = depGraph.edges.find((e) => e.target === "Firestore");
        if (dbEdge && dbEdge.avgLatencyMs > 500) {
          score += 20;
          reasons.push("Database latency spike detected; recommended to test contention under pressure.");
        }
      }

      // Heuristic 5: Historical Failures (Outcome-based adjustment)
      const lastRun = history.find((h) => h.overallStatus === "failed");
      if (lastRun) {
        score += 15;
        reasons.push("Previous overall orchestration run failed; critical to verify recovery remediation.");
      }

      // Clamp score to 0 - 100
      score = Math.max(10, Math.min(99, score));

      // Derive Priority string
      let priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
      if (score >= 85) priority = "CRITICAL";
      else if (score >= 70) priority = "HIGH";
      else if (score >= 45) priority = "MEDIUM";

      recommendations.push({
        experimentName: name,
        subsystem: meta.subsystem,
        riskLevel: meta.risk,
        score,
        priority,
        reason: reasons.join(" "),
        mitigationStrategy: meta.mitigation,
      });
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }
}
