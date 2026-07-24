import { DependencyNode, DependencyEdge, RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";

export class TwinDependencyGraph {
  private nodes: DependencyNode[];
  private edges: DependencyEdge[];

  constructor(nodes: DependencyNode[], edges: DependencyEdge[]) {
    this.nodes = JSON.parse(JSON.stringify(nodes));
    this.edges = JSON.parse(JSON.stringify(edges));
  }

  /**
   * Reuses RuntimeDependencyGraph by seeding from its current structure.
   */
  public static fromProduction(): TwinDependencyGraph {
    const { nodes, edges } = RuntimeDependencyGraph.getGraph();
    return new TwinDependencyGraph(nodes, edges);
  }

  public getNodes(): DependencyNode[] {
    return this.nodes;
  }

  public getEdges(): DependencyEdge[] {
    return this.edges;
  }

  /**
   * Virtually injects a node failure, transitioning its status.
   */
  public injectVirtualFailure(nodeId: string, status: "DEGRADED" | "PARTIAL_OUTAGE" | "UNAVAILABLE"): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
      // Propagate failure to incoming/outgoing edges virtually
      for (const edge of this.edges) {
        if (edge.target === nodeId) {
          edge.status = status === "UNAVAILABLE" ? "failing" : status === "DEGRADED" ? "congested" : "failing";
          edge.failures += 10; // virtual failure increment
        }
      }
    }
  }

  /**
   * Traces all upstream/downstream dependency chains.
   */
  public findDependencyChains(startNodeId: string): string[][] {
    const paths: string[][] = [];

    const dfs = (currentNodeId: string, currentPath: string[]) => {
      currentPath.push(currentNodeId);
      let hasOutgoing = false;

      for (const edge of this.edges) {
        if (edge.source === currentNodeId && !currentPath.includes(edge.target)) {
          hasOutgoing = true;
          dfs(edge.target, [...currentPath]);
        }
      }

      if (!hasOutgoing) {
        paths.push(currentPath);
      }
    };

    dfs(startNodeId, []);
    return paths;
  }

  /**
   * Identifies the critical path of the runtime platform (usually root service to databases/external endpoints).
   */
  public getCriticalPaths(): string[][] {
    // Standard critical paths are the main entry point to databases/sensitive external APIs
    const criticalNodes = ["Firestore", "StripeAPI", "GeminiAI"];
    const paths: string[][] = [];
    
    for (const target of criticalNodes) {
      if (this.nodes.some(n => n.id === target)) {
        paths.push(["ExpressServer", target]);
      }
    }
    return paths;
  }

  /**
   * Calculates the blast radius of a failure on the given node (downstream affected components).
   */
  public calculateBlastRadius(nodeId: string): {
    affectedNodes: string[];
    impactScore: number; // 0 to 100
    severity: "Minimal" | "Low" | "Medium" | "High" | "Critical";
  } {
    const affected = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      // Find all nodes that depend on `current` (meaning `current` is the target of their edges)
      // E.g., ExpressServer -> Firestore. If Firestore fails, ExpressServer is affected.
      // So dependencies flow from target to source in terms of failure propagation!
      for (const edge of this.edges) {
        if (edge.target === current && !affected.has(edge.source)) {
          affected.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    const affectedNodes = Array.from(affected);
    const affectedCount = affectedNodes.length;
    const totalNodes = this.nodes.length || 1;
    const impactScore = Math.min(100, Math.round((affectedCount / totalNodes) * 100) + (nodeId === "Firestore" ? 50 : nodeId === "StripeAPI" ? 40 : 20));
    
    let severity: "Minimal" | "Low" | "Medium" | "High" | "Critical" = "Minimal";
    if (impactScore > 80) severity = "Critical";
    else if (impactScore > 50) severity = "High";
    else if (impactScore > 25) severity = "Medium";
    else if (impactScore > 5) severity = "Low";

    return {
      affectedNodes,
      impactScore,
      severity,
    };
  }
}
