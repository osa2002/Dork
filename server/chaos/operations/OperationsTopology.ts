import { ControlPlaneRegistry } from "../control-plane/ControlPlaneRegistry";
import { OperationalControlPlane } from "../control-plane/OperationalControlPlane";

export interface TopologyNode {
  id: string;
  name: string;
  version: string;
  status: "ACTIVE" | "DEGRADED" | "STANDBY" | "UNAVAILABLE";
  owner: string;
  capabilities: string[];
}

export interface TopologyEdge {
  from: string;
  to: string;
}

export interface OperationalTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  resolvedOrder: string[];
  circularDependencies: string[][];
  missingDependencies: { engineId: string; dependentId: string }[];
  incompatibleDependencies: { engineId: string; dependentId: string; required: string; actual: string }[];
}

export class OperationsTopology {
  /**
   * Generates a live, fully-mapped dependency topology from the Control Plane.
   */
  public static generateTopology(): OperationalTopology {
    const engines = ControlPlaneRegistry.getAll();
    const cpDeps = OperationalControlPlane.auditDependencies();

    const nodes: TopologyNode[] = engines.map((eng) => ({
      id: eng.id,
      name: eng.name,
      version: eng.version,
      status: eng.status,
      owner: eng.owner,
      capabilities: eng.capabilities,
    }));

    const edges: TopologyEdge[] = [];

    // Parse dependencies to generate edges
    for (const eng of engines) {
      if (eng.dependencies) {
        for (const depId of eng.dependencies) {
          edges.push({
            from: eng.id,
            to: depId,
          });
        }
      }
    }

    return {
      nodes,
      edges,
      resolvedOrder: cpDeps.resolvedOrder,
      circularDependencies: cpDeps.cycles,
      missingDependencies: cpDeps.missing,
      incompatibleDependencies: cpDeps.incompatible,
    };
  }
}
