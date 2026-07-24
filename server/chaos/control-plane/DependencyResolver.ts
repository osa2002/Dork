import { EngineDescriptor } from "./EngineDescriptor";

export interface DependencyReport {
  success: boolean;
  graph: Record<string, string[]>;
  resolvedOrder: string[];
  cycles: string[][];
  missing: { engineId: string; dependentId: string }[];
  incompatible: { engineId: string; dependentId: string; required: string; actual: string }[];
  duplicateOwnership: { owner: string; engines: string[] }[];
}

export class DependencyResolver {
  /**
   * Helper to check if a version satisfies a semver range (e.g. "^1.2.0", ">=1.0.0", "1.0.0", "*")
   */
  public static satisfies(version: string, range: string): boolean {
    if (!range || range === "*" || range === "") return true;

    // Clean version and range
    const cleanVer = version.trim();
    const cleanRange = range.trim();

    // Check exact match
    if (cleanVer === cleanRange) return true;

    // Parse version components
    const verParts = cleanVer.split(".").map(Number);
    if (verParts.some(isNaN) || verParts.length < 3) {
      return false; // Invalid version format
    }
    const [vMajor, vMinor, vPatch] = verParts;

    if (cleanRange.startsWith("^")) {
      const rangeVal = cleanRange.slice(1);
      const rangeParts = rangeVal.split(".").map(Number);
      if (rangeParts.some(isNaN) || rangeParts.length < 3) return false;
      const [rMajor, rMinor, rPatch] = rangeParts;

      if (vMajor !== rMajor) return false;
      if (vMinor < rMinor) return false;
      if (vMinor === rMinor && vPatch < rPatch) return false;
      return true;
    }

    if (cleanRange.startsWith(">=")) {
      const rangeVal = cleanRange.slice(2);
      const rangeParts = rangeVal.split(".").map(Number);
      if (rangeParts.some(isNaN) || rangeParts.length < 3) return false;
      const [rMajor, rMinor, rPatch] = rangeParts;

      if (vMajor > rMajor) return true;
      if (vMajor < rMajor) return false;
      if (vMinor > rMinor) return true;
      if (vMinor < rMinor) return false;
      return vPatch >= rPatch;
    }

    return false;
  }

  /**
   * Analyzes registered engines, builds the dependency graph, resolves execution ordering,
   * and reports structural, versioning, or cyclical integrity issues.
   */
  public static resolve(engines: EngineDescriptor[]): DependencyReport {
    const graph: Record<string, string[]> = {};
    const engineMap = new Map<string, EngineDescriptor>();
    const missing: { engineId: string; dependentId: string }[] = [];
    const incompatible: { engineId: string; dependentId: string; required: string; actual: string }[] = [];
    const cycles: string[][] = [];

    // Map engines by ID for fast lookup
    for (const eng of engines) {
      engineMap.set(eng.id, eng);
      graph[eng.id] = [...eng.dependencies];
    }

    // 1. Missing & Incompatible Checks
    for (const eng of engines) {
      for (const depId of eng.dependencies) {
        const depEng = engineMap.get(depId);
        if (!depEng) {
          missing.push({ engineId: depId, dependentId: eng.id });
        } else {
          // Version Compatibility Check
          const requiredRange = eng.compatibilityMatrix[depId];
          if (requiredRange && !this.satisfies(depEng.version, requiredRange)) {
            incompatible.push({
              engineId: depId,
              dependentId: eng.id,
              required: requiredRange,
              actual: depEng.version
            });
          }
        }
      }
    }

    // 2. Cycle Detection (DFS using state maps: 0=unvisited, 1=visiting, 2=visited)
    const state: Record<string, number> = {};
    const pathStack: string[] = [];

    const dfsDetectCycle = (id: string) => {
      state[id] = 1; // visiting
      pathStack.push(id);

      const deps = graph[id] || [];
      for (const dep of deps) {
        if (!engineMap.has(dep)) continue; // skip missing for cycle detection
        if (state[dep] === 1) {
          // Cycle detected! Extract cycle path from pathStack
          const cycleStartIdx = pathStack.indexOf(dep);
          if (cycleStartIdx !== -1) {
            cycles.push([...pathStack.slice(cycleStartIdx), dep]);
          }
        } else if (!state[dep]) {
          dfsDetectCycle(dep);
        }
      }

      pathStack.pop();
      state[id] = 2; // visited
    };

    for (const eng of engines) {
      if (!state[eng.id]) {
        dfsDetectCycle(eng.id);
      }
    }

    // 3. Topological Sort for Resolved Order (Kahn's or DFS Post-Order)
    const resolvedOrder: string[] = [];
    const visitedSet = new Set<string>();

    const dfsSort = (id: string) => {
      visitedSet.add(id);
      const deps = graph[id] || [];
      // Sort dependencies by priority to honor priority-aware ordering
      const sortedDeps = deps
        .filter((d) => engineMap.has(d))
        .sort((a, b) => {
          const pA = engineMap.get(a)?.priority ?? 0;
          const pB = engineMap.get(b)?.priority ?? 0;
          return pB - pA; // higher priority first
        });

      for (const dep of sortedDeps) {
        if (!visitedSet.has(dep)) {
          dfsSort(dep);
        }
      }
      resolvedOrder.push(id);
    };

    // Sort root nodes by priority before sorting
    const sortedEngines = [...engines].sort((a, b) => b.priority - a.priority);
    for (const eng of sortedEngines) {
      if (!visitedSet.has(eng.id)) {
        dfsSort(eng.id);
      }
    }

    // 4. Duplicate Ownership Check (e.g. multiple engines owned by same team,
    // or same instance registered multiple times)
    const ownerMap: Record<string, string[]> = {};
    const instanceMap = new Map<any, string[]>();

    for (const eng of engines) {
      if (eng.owner) {
        if (!ownerMap[eng.owner]) ownerMap[eng.owner] = [];
        ownerMap[eng.owner].push(eng.id);
      }
      if (eng.instance) {
        if (!instanceMap.has(eng.instance)) {
          instanceMap.set(eng.instance, []);
        }
        instanceMap.get(eng.instance)!.push(eng.id);
      }
    }

    const duplicateOwnership: { owner: string; engines: string[] }[] = [];

    // Report if same team owns overlapping key capabilities, or if there's duplicate instance usage
    for (const [owner, ownedEngines] of Object.entries(ownerMap)) {
      if (ownedEngines.length > 2) {
        // Flag excess ownership for governance auditing
        duplicateOwnership.push({ owner, engines: ownedEngines });
      }
    }

    for (const [instance, idList] of instanceMap.entries()) {
      if (idList.length > 1) {
        // Explicit duplicate engine registration of same class/singleton instance!
        duplicateOwnership.push({ owner: `Duplicate Instance [${idList.join(", ")}]`, engines: idList });
      }
    }

    const success = missing.length === 0 && incompatible.length === 0 && cycles.length === 0;

    return {
      success,
      graph,
      resolvedOrder, // topological execution order
      cycles,
      missing,
      incompatible,
      duplicateOwnership
    };
  }
}
