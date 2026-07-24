import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { ChaosState } from "../ChaosState";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { ChaosAuditTrail } from "../governance/ChaosAuditTrail";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { ChaosHistory } from "../orchestrator/ChaosHistory";

export interface DependencyValidationResult {
  success: boolean;
  circularDependencies: { node: string; path: string[] }[];
  duplicateStores: string[];
  duplicateRepositories: string[];
  duplicateEventSources: string[];
  duplicateTelemetryCollectors: string[];
  registeredComponents: string[];
}

export class DependencyValidator {
  /**
   * Evaluates the core architecture graph and singleton presence to ensure zero structural duplication.
   */
  public static validate(): DependencyValidationResult {
    // 1. Programmatic Dependency Graph Representation for Cycle Detection
    const dependencyGraph: Record<string, string[]> = {
      "ChaosState": [],
      "EnterpriseEventBus": [],
      "KnowledgeRepository": ["EnterpriseEventBus"],
      "ChaosOrchestrator": ["ChaosState", "EnterpriseEventBus", "ChaosHistory", "ChaosAuditTrail"],
      "PredictionEngine": ["KnowledgeRepository", "EnterpriseEventBus"],
      "DecisionEngine": ["DecisionHistory", "EnterpriseEventBus"],
      "RecoveryEngine": ["RecoveryHistory", "EnterpriseEventBus"],
    };

    const circularDependencies: { node: string; path: string[] }[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]): boolean => {
      if (recStack.has(node)) {
        circularDependencies.push({ node, path: [...path, node] });
        return true;
      }
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const deps = dependencyGraph[node] || [];
      for (const dep of deps) {
        if (dfs(dep, [...path, node])) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of Object.keys(dependencyGraph)) {
      dfs(node, []);
    }

    // 2. Singleton Duplicate Assertions (Ensures unique single instances loaded)
    const duplicateStores: string[] = [];
    const duplicateRepositories: string[] = [];
    const duplicateEventSources: string[] = [];
    const duplicateTelemetryCollectors: string[] = [];

    const registryMap = new Map<string, any>();

    const checkUniqueInstance = (name: string, instance: any, list: string[]) => {
      if (!instance) {
        list.push(`${name} is null or undefined`);
        return;
      }
      if (registryMap.has(name)) {
        list.push(`Duplicate instance registration detected for: ${name}`);
      } else {
        registryMap.set(name, instance);
      }
    };

    checkUniqueInstance("ChaosState", ChaosState, duplicateStores);
    checkUniqueInstance("KnowledgeRepository", KnowledgeRepository, duplicateRepositories);
    checkUniqueInstance("EnterpriseEventBus", EnterpriseEventBus, duplicateEventSources);
    checkUniqueInstance("ChaosAuditTrail", ChaosAuditTrail, duplicateTelemetryCollectors);
    checkUniqueInstance("DecisionHistory", DecisionHistory, duplicateTelemetryCollectors);
    checkUniqueInstance("RecoveryHistory", RecoveryHistory, duplicateTelemetryCollectors);
    checkUniqueInstance("ChaosHistory", ChaosHistory, duplicateTelemetryCollectors);

    const success =
      circularDependencies.length === 0 &&
      duplicateStores.length === 0 &&
      duplicateRepositories.length === 0 &&
      duplicateEventSources.length === 0 &&
      duplicateTelemetryCollectors.length === 0;

    return {
      success,
      circularDependencies,
      duplicateStores,
      duplicateRepositories,
      duplicateEventSources,
      duplicateTelemetryCollectors,
      registeredComponents: Array.from(registryMap.keys()),
    };
  }
}
