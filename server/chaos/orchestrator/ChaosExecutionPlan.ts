import { IChaosExperiment } from "../experiments/IChaosExperiment";

export interface ChaosExecutionStep {
  experiment: IChaosExperiment;
  dependencies: string[]; // List of other experiment names that must run beforehand
  retryCount: number;
}

export class ChaosExecutionPlan {
  public steps: ChaosExecutionStep[] = [];

  /**
   * Generates a step execution plan while sorting them based on simple dependency resolution.
   */
  public addExperiment(experiment: IChaosExperiment, dependencies: string[] = [], retryCount: number = 1) {
    this.steps.push({
      experiment,
      dependencies,
      retryCount,
    });
  }

  /**
   * Sorts steps topologically based on their stated dependencies.
   */
  public resolveExecutionOrder(): ChaosExecutionStep[] {
    const sorted: ChaosExecutionStep[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (step: ChaosExecutionStep) => {
      const name = step.experiment.name;
      if (visited.has(name)) return;
      if (temp.has(name)) {
        throw new Error(`Circular dependency detected in execution plan for experiment: ${name}`);
      }

      temp.add(name);

      // Visit dependencies first
      for (const depName of step.dependencies) {
        const depStep = this.steps.find((s) => s.experiment.name.toLowerCase() === depName.toLowerCase());
        if (depStep) {
          visit(depStep);
        }
      }

      temp.delete(name);
      visited.add(name);
      sorted.push(step);
    };

    for (const step of this.steps) {
      visit(step);
    }

    return sorted;
  }
}
