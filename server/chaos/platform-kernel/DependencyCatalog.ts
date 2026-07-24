import { ModuleRegistry } from "./ModuleRegistry";

export interface DependencyCatalogReport {
  readonly isValid: boolean;
  readonly missingDependencies: readonly { readonly id: string; readonly dependencyId: string }[];
  readonly circularDependencies: readonly (readonly string[])[];
  readonly orphanEngines: readonly string[];
  readonly graph: Record<string, readonly string[]>;
}

export class DependencyCatalog {
  /**
   * Evaluates the complete registered platform dependency tree.
   */
  public static audit(): DependencyCatalogReport {
    const modules = ModuleRegistry.getAll();
    const modulesMap = new Map(modules.map((m) => [m.id, m]));

    const missingDependencies: { id: string; dependencyId: string }[] = [];
    const circularDependencies: string[][] = [];
    const graph: Record<string, string[]> = {};

    // 1. Build graph and check for missing dependencies
    modules.forEach((m) => {
      graph[m.id] = [...m.dependencies];
      m.dependencies.forEach((depId) => {
        if (!modulesMap.has(depId)) {
          missingDependencies.push({ id: m.id, dependencyId: depId });
        }
      });
    });

    // 2. Check for circular dependencies
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cyclePath: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      cyclePath.push(node);

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          // Cycle detected
          const startIndex = cyclePath.indexOf(neighbor);
          const cycle = [...cyclePath.slice(startIndex), neighbor];
          circularDependencies.push(cycle);
          return true;
        }
      }

      recStack.delete(node);
      cyclePath.pop();
      return false;
    };

    modules.forEach((m) => {
      if (!visited.has(m.id)) {
        dfs(m.id);
      }
    });

    // 3. Find orphan engines (no outgoing dependencies and no incoming dependencies from any other node)
    const incomingDepsCount = new Map<string, number>();
    modules.forEach((m) => {
      incomingDepsCount.set(m.id, 0);
    });

    modules.forEach((m) => {
      m.dependencies.forEach((depId) => {
        if (incomingDepsCount.has(depId)) {
          incomingDepsCount.set(depId, incomingDepsCount.get(depId)! + 1);
        }
      });
    });

    const orphanEngines = modules
      .filter((m) => m.dependencies.length === 0 && (incomingDepsCount.get(m.id) || 0) === 0)
      .map((m) => m.id);

    const isValid =
      missingDependencies.length === 0 && circularDependencies.length === 0;

    // Convert graph properties to read-only format
    const frozenGraph: Record<string, readonly string[]> = {};
    Object.keys(graph).forEach((key) => {
      frozenGraph[key] = Object.freeze(graph[key]);
    });

    return Object.freeze({
      isValid,
      missingDependencies: Object.freeze(missingDependencies),
      circularDependencies: Object.freeze(circularDependencies.map((c) => Object.freeze(c))),
      orphanEngines: Object.freeze(orphanEngines),
      graph: Object.freeze(frozenGraph),
    });
  }
}
