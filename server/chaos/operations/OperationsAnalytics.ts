import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { ValidationHistory } from "../validation/ValidationHistory";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";

export interface SreAnalyticsReport {
  timestamp: string;
  mttrMs: number; // Mean Time To Resolution
  mtbfMs: number; // Mean Time Between Failures
  recoverySuccessRate: number;
  validationSuccessRate: number;
  predictionAccuracy: number;
  knowledgeGrowthRate: number; // record count
  failureDistribution: Record<string, number>;
  engineActivity: Record<string, number>;
}

export class OperationsAnalytics {
  /**
   * Calculates comprehensive live SRE analytics for the platform.
   */
  public static calculateAnalytics(): SreAnalyticsReport {
    const now = new Date().toISOString();

    // 1. Calculate MTTR (Mean Time to Resolution) from Recovery History
    const recoveries = RecoveryHistory.getHistory();
    const successfulRecoveries = recoveries.filter(
      (r) => r.status === "SUCCESS" || r.status === "ROLLED_BACK"
    );
    let mttrMs = 45000; // default baseline MTTR of 45 seconds if no recoveries exist
    if (successfulRecoveries.length > 0) {
      const totalDuration = successfulRecoveries.reduce((sum, r) => sum + r.durationMs, 0);
      mttrMs = Number((totalDuration / successfulRecoveries.length).toFixed(0));
    }

    // 2. Calculate MTBF (Mean Time Between Failures) from Event History
    const history = EnterpriseEventBus.getHistory();
    const failureEvents = history
      .filter((e) => e.type === "ExperimentFailed" || e.type === "IncidentCreated")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let mtbfMs = 18.5 * 60 * 60 * 1000; // default baseline of 18.5 hours
    if (failureEvents.length > 1) {
      let totalTimeBetween = 0;
      for (let i = 1; i < failureEvents.length; i++) {
        const diff =
          new Date(failureEvents[i].timestamp).getTime() -
          new Date(failureEvents[i - 1].timestamp).getTime();
        totalTimeBetween += diff;
      }
      mtbfMs = Number((totalTimeBetween / (failureEvents.length - 1)).toFixed(0));
    }

    // 3. Recovery Success Rate
    const totalRecoveries = recoveries.length;
    const recoverySuccessRate =
      totalRecoveries > 0
        ? Number(((successfulRecoveries.length / totalRecoveries) * 100).toFixed(2))
        : 100;

    // 4. Validation Success Rate
    const valHistory = ValidationHistory.getHistory();
    let validationSuccessRate = 100;
    if (valHistory.length > 0) {
      const totalSuccessRate = valHistory.reduce((sum, run) => sum + run.successRate, 0);
      validationSuccessRate = Number((totalSuccessRate / valHistory.length).toFixed(2));
    }

    // 5. Prediction Accuracy
    // If prediction risk score was high and failures happened, or risk was low and zero failures happened
    let predictionAccuracy = 95.0; // default baseline SRE score
    if (history.length > 0) {
      const predictions = history.filter((e) => e.type === "PredictionCreated");
      if (predictions.length > 0) {
        let correctMatches = 0;
        for (const pred of predictions) {
          const riskScore = pred.payload?.riskScore || 0;
          const correlationId = pred.correlationId;
          const relatedFailure = failureEvents.some((f) => f.correlationId === correlationId);
          // Correct match defined as: high-risk matched with actual failure, or low-risk matched with success
          if ((riskScore >= 50 && relatedFailure) || (riskScore < 50 && !relatedFailure)) {
            correctMatches++;
          }
        }
        predictionAccuracy = Number(((correctMatches / predictions.length) * 100).toFixed(2));
      }
    }

    // 6. Knowledge Growth Rate
    const knowledgeGrowthRate = KnowledgeRepository.getAll().length;

    // 7. Failure Distribution
    const failureDistribution: Record<string, number> = {
      Orchestrator: 0,
      Database: 0,
      Network: 0,
      API: 0,
      Authentication: 0,
    };

    for (const event of history) {
      if (event.type === "ExperimentFailed" || event.type === "IncidentCreated") {
        const payloadStr = JSON.stringify(event.payload).toLowerCase();
        if (payloadStr.includes("firestore") || payloadStr.includes("database")) {
          failureDistribution.Database++;
        } else if (payloadStr.includes("network") || payloadStr.includes("partition")) {
          failureDistribution.Network++;
        } else if (payloadStr.includes("gemini") || payloadStr.includes("stripe") || payloadStr.includes("api")) {
          failureDistribution.API++;
        } else if (payloadStr.includes("auth") || payloadStr.includes("token")) {
          failureDistribution.Authentication++;
        } else {
          failureDistribution.Orchestrator++;
        }
      }
    }

    // 8. Engine Activity (volume of events published per event category/type)
    const engineActivity: Record<string, number> = {};
    for (const event of history) {
      engineActivity[event.type] = (engineActivity[event.type] || 0) + 1;
    }

    return {
      timestamp: now,
      mttrMs,
      mtbfMs,
      recoverySuccessRate,
      validationSuccessRate,
      predictionAccuracy,
      knowledgeGrowthRate,
      failureDistribution,
      engineActivity,
    };
  }
}
