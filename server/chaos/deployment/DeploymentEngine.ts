import { DeploymentContext, DeploymentContextConfig } from "./DeploymentContext";
import { DeploymentDefinition } from "./DeploymentDefinition";
import { DeploymentOrchestrator, DeploymentOrchestrationResult } from "./DeploymentOrchestrator";
import { DeploymentHistory, DeploymentHistoryRecord } from "./DeploymentHistory";
import { DeploymentReporter } from "./DeploymentReporter";
import { DeploymentStrategy } from "./DeploymentStrategy";

export interface DeploymentEngineSummary {
  readonly result: DeploymentOrchestrationResult;
  readonly reportMarkdown: string;
  readonly reportJson: any;
}

export class DeploymentEngine {
  /**
   * Main entry point to orchestrate a deployment evaluation and promotion.
   */
  public static execute(
    contextConfig?: DeploymentContextConfig,
    definition?: DeploymentDefinition
  ): DeploymentEngineSummary {
    const result = DeploymentOrchestrator.execute(contextConfig, definition);
    const reportMarkdown = DeploymentReporter.generateMarkdownReport(result);
    const reportJson = DeploymentReporter.generateJsonReport(result);

    return Object.freeze({
      result,
      reportMarkdown,
      reportJson,
    });
  }

  /**
   * Recommends the safest deployment strategy based on context risk and health metrics.
   */
  public static recommendStrategy(contextConfig?: DeploymentContextConfig) {
    const ctx = DeploymentContext.create(contextConfig);
    return DeploymentStrategy.recommendStrategy(ctx);
  }

  /**
   * Returns immutable history records of all deployment operations.
   */
  public static getHistory(): readonly DeploymentHistoryRecord[] {
    return DeploymentHistory.getHistory();
  }
}
