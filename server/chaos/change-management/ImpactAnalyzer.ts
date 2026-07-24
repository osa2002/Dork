import { ChangeRequestPayload } from "./ChangeRequest";
import { ChangeContextPayload } from "./ChangeContext";

export interface SubsystemImpact {
  readonly id: string;
  readonly name: string;
  readonly type: "DIRECT" | "INDIRECT";
  readonly dependencyDepth: number;
}

export interface ImpactAnalysisPayload {
  readonly blastRadiusScore: number; // 0-100
  readonly primaryImpactedSubsystems: readonly string[];
  readonly cascadingImpactedSubsystems: readonly string[];
  readonly resourceContentionRisk: "LOW" | "MEDIUM" | "HIGH";
  readonly impactDetail: readonly SubsystemImpact[];
}

export class ImpactAnalyzer {
  /**
   * Analyzes the proposed change request against SRE dependency graphs to calculate blast radius and cascading effects.
   */
  public static analyze(request: ChangeRequestPayload, context: ChangeContextPayload): ImpactAnalysisPayload {
    const graph = context.twinSnapshot?.dependencyGraph || { nodes: [], edges: [] };
    const directTargets = new Set(request.targetSubsystems);
    const indirectTargets = new Map<string, number>(); // ID -> depth

    // Simple BFS for dependency tracing
    const queue: { id: string; depth: number }[] = [];
    for (const target of directTargets) {
      queue.push({ id: target, depth: 0 });
    }

    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (!directTargets.has(id)) {
        if (!indirectTargets.has(id) || indirectTargets.get(id)! > depth) {
          indirectTargets.set(id, depth);
        }
      }

      // Find connections: either calling or being called
      for (const edge of graph.edges) {
        if (edge.source === id && !visited.has(edge.target)) {
          queue.push({ id: edge.target, depth: depth + 1 });
        }
        if (edge.target === id && !visited.has(edge.source)) {
          queue.push({ id: edge.source, depth: depth + 1 });
        }
      }
    }

    const impactDetail: SubsystemImpact[] = [];
    for (const target of directTargets) {
      const node = graph.nodes.find((n) => n.id === target);
      impactDetail.push({
        id: target,
        name: node?.name || target,
        type: "DIRECT",
        dependencyDepth: 0,
      });
    }

    for (const [id, depth] of indirectTargets.entries()) {
      const node = graph.nodes.find((n) => n.id === id);
      impactDetail.push({
        id,
        name: node?.name || id,
        type: "INDIRECT",
        dependencyDepth: depth,
      });
    }

    const primaryImpactedSubsystems = Array.from(directTargets);
    const cascadingImpactedSubsystems = Array.from(indirectTargets.keys());

    // Blast radius score calculation
    const rawBlastRadius = (primaryImpactedSubsystems.length * 25) + (cascadingImpactedSubsystems.length * 12);
    const blastRadiusScore = Math.min(100, Math.max(10, rawBlastRadius));

    // Resource contention risk
    let resourceContentionRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (blastRadiusScore > 70 || primaryImpactedSubsystems.includes("Firestore") || primaryImpactedSubsystems.includes("ExpressServer")) {
      resourceContentionRisk = "HIGH";
    } else if (blastRadiusScore > 35) {
      resourceContentionRisk = "MEDIUM";
    }

    return Object.freeze({
      blastRadiusScore,
      primaryImpactedSubsystems,
      cascadingImpactedSubsystems,
      resourceContentionRisk,
      impactDetail,
    });
  }
}
