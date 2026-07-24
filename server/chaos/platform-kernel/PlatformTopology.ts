import { ModuleRegistry } from "./ModuleRegistry";

export interface PlatformTopologyData {
  readonly engineGraph: Record<string, readonly string[]>;
  readonly dependencyGraph: Record<string, readonly string[]>;
  readonly capabilityGraph: Record<string, readonly string[]>;
  readonly topologicalLayers: readonly string[];
}

export class PlatformTopology {
  /**
   * Evaluates and builds the static read-only runtime architecture topology.
   */
  public static generate(): PlatformTopologyData {
    const modules = ModuleRegistry.getAll();
    const engineGraph: Record<string, string[]> = {};
    const dependencyGraph: Record<string, string[]> = {};
    const capabilityGraph: Record<string, string[]> = {};

    // 1. Build graphs
    modules.forEach((m) => {
      engineGraph[m.id] = [...m.dependencies];
      dependencyGraph[m.id] = [...m.dependencies];

      m.capabilities.forEach((cap) => {
        if (!capabilityGraph[cap]) {
          capabilityGraph[cap] = [];
        }
        if (!capabilityGraph[cap].includes(m.id)) {
          capabilityGraph[cap].push(m.id);
        }
      });
    });

    // 2. Compute Topological Sort (Topological Layers)
    const visited = new Set<string>();
    const tempStack = new Set<string>();
    const order: string[] = [];

    const visit = (node: string) => {
      if (visited.has(node)) return;
      if (tempStack.has(node)) {
        // Cycle exists; break to avoid infinite loop (handled by dependency audit)
        return;
      }

      tempStack.add(node);
      const dependencies = engineGraph[node] || [];
      dependencies.forEach((dep) => visit(dep));
      tempStack.delete(node);

      visited.add(node);
      order.push(node);
    };

    modules.forEach((m) => {
      if (!visited.has(m.id)) {
        visit(m.id);
      }
    });

    // Convert structures to read-only frozen forms
    const frozenEngineGraph: Record<string, readonly string[]> = {};
    Object.keys(engineGraph).forEach((k) => {
      frozenEngineGraph[k] = Object.freeze(engineGraph[k]);
    });

    const frozenDependencyGraph: Record<string, readonly string[]> = {};
    Object.keys(dependencyGraph).forEach((k) => {
      frozenDependencyGraph[k] = Object.freeze(dependencyGraph[k]);
    });

    const frozenCapabilityGraph: Record<string, readonly string[]> = {};
    Object.keys(capabilityGraph).forEach((k) => {
      frozenCapabilityGraph[k] = Object.freeze(capabilityGraph[k]);
    });

    return Object.freeze({
      engineGraph: Object.freeze(frozenEngineGraph),
      dependencyGraph: Object.freeze(frozenDependencyGraph),
      capabilityGraph: Object.freeze(frozenCapabilityGraph),
      topologicalLayers: Object.freeze([...order]),
    });
  }
}
