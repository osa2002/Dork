export interface SubsystemCoverage {
  subsystemName: string;
  description: string;
  totalExperiments: number;
  executedExperiments: string[];
  coveragePercentage: number;
  status: "UNTESTED" | "PARTIALLY_TESTED" | "FULLY_TESTED";
}

export interface CoverageReport {
  overallCoveragePercentage: number;
  subsystems: SubsystemCoverage[];
  untestedSubsystems: string[];
  testedSubsystemsCount: number;
}

export class ChaosCoverageAnalyzer {
  private static executedExperiments: Set<string> = new Set();

  private static readonly SUBSYSTEM_MAP: Record<string, { subsystem: string; desc: string; experiments: string[] }> = {
    DatabaseSubsystem: {
      subsystem: "Database Subsystem",
      desc: "Google Firestore transactional queries, latency bounds, and concurrency isolation.",
      experiments: [
        "FirestoreNetworkPartitionExperiment",
        "FirestoreContentionExperiment",
        "FirestoreHighLatencyExperiment",
        "DatabaseFailureScenario",
        "TransactionFailureScenario",
      ],
    },
    BillingSubsystem: {
      subsystem: "Billing & Subscriptions",
      desc: "Stripe Checkout session lifecycles, upgrades, and invoice generation flows.",
      experiments: ["StripeTimeoutExperiment", "DependencyFailureScenario"],
    },
    AIPredictionSubsystem: {
      subsystem: "AI Wait-Time Engine",
      desc: "Google Gemini 2.5/3.5 LLM wait-time predictions, capacity quotas, and density reporting.",
      experiments: ["GeminiTimeoutExperiment"],
    },
    NotificationSubsystem: {
      subsystem: "Notification Subsystem",
      desc: "Twilio direct SMS and WhatsApp gateways and multi-channel customer communications.",
      experiments: ["TwilioTimeoutExperiment", "SSEDisconnectExperiment"],
    },
    AuthSubsystem: {
      subsystem: "Identity & Authentication",
      desc: "Firebase user verification, Bearer tokens, and secure vendor session validation.",
      experiments: ["AuthFailureExperiment", "AuthenticationFailureScenario"],
    },
    CronCleanupSubsystem: {
      subsystem: "Cron & Archiving Scheduler",
      desc: "Daily purgers, ticket archivers, and transaction cleanup micro-tasks.",
      experiments: ["CleanupJobFailureExperiment", "SchedulerDelayExperiment", "CleanupFailureScenario", "SchedulerFailureScenario"],
    },
    InfrastructureSubsystem: {
      subsystem: "Cloud Infrastructure",
      desc: "Cloud Run containers, scale-to-zero lifecycles, and Express event-loop execution health.",
      experiments: [
        "CloudRunInstanceKillExperiment",
        "ExpressEventLoopDelayExperiment",
        "MemoryPressureExperiment",
        "CPUPressureExperiment",
        "CloudRunColdStartExperiment",
        "FullDependencyBlackoutExperiment",
        "RateLimitStormExperiment",
        "RateLimitScenario",
        "PartialServiceDegradationExperiment",
        "RetryExhaustionExperiment",
        "RandomFailureExperiment",
      ],
    },
  };

  /**
   * Registers that a specific experiment has been actively executed in this container lifecycle.
   */
  public static recordExecution(experimentName: string) {
    this.executedExperiments.add(experimentName);
  }

  /**
   * Compiles the resilience test coverage across Dork Subsystems.
   */
  public static getCoverageReport(): CoverageReport {
    const subsystems: SubsystemCoverage[] = [];
    let totalScoreSum = 0;
    let testedCount = 0;
    const untestedSubsystems: string[] = [];

    for (const [key, mapping] of Object.entries(this.SUBSYSTEM_MAP)) {
      const matchedExecuted = mapping.experiments.filter((exp) => this.executedExperiments.has(exp));
      const coveragePercentage = Math.round((matchedExecuted.length / mapping.experiments.length) * 100);

      let status: "UNTESTED" | "PARTIALLY_TESTED" | "FULLY_TESTED" = "UNTESTED";
      if (coveragePercentage === 100) status = "FULLY_TESTED";
      else if (coveragePercentage > 0) status = "PARTIALLY_TESTED";

      if (status !== "UNTESTED") {
        testedCount++;
      } else {
        untestedSubsystems.push(mapping.subsystem);
      }

      subsystems.push({
        subsystemName: mapping.subsystem,
        description: mapping.desc,
        totalExperiments: mapping.experiments.length,
        executedExperiments: matchedExecuted,
        coveragePercentage,
        status,
      });

      totalScoreSum += coveragePercentage;
    }

    const overallCoveragePercentage = Math.round(totalScoreSum / Object.keys(this.SUBSYSTEM_MAP).length);

    return {
      overallCoveragePercentage,
      subsystems,
      untestedSubsystems,
      testedSubsystemsCount: testedCount,
    };
  }

  public static reset() {
    this.executedExperiments.clear();
  }
}
