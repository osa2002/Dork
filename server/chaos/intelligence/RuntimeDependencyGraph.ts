import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface DependencyNode {
  id: string;
  name: string;
  type: "service" | "database" | "external_api";
  status: "HEALTHY" | "DEGRADED" | "PARTIAL_OUTAGE" | "UNAVAILABLE";
  lastActive: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  calls: number;
  failures: number;
  avgLatencyMs: number;
  status: "normal" | "congested" | "failing";
}

export class RuntimeDependencyGraph {
  private static nodes: Map<string, DependencyNode> = new Map();
  private static edges: Map<string, DependencyEdge> = new Map();

  static {
    // Seed standard enterprise service nodes
    this.registerNode("ExpressServer", "Express Web Gateway", "service");
    this.registerNode("Firestore", "Google Cloud Firestore", "database");
    this.registerNode("StripeAPI", "Stripe Payment Gateway", "external_api");
    this.registerNode("GeminiAI", "Google Gemini LLM Service", "external_api");
    this.registerNode("TwilioSMS", "Twilio Messaging Gateway", "external_api");
    this.registerNode("NodemailerEmail", "SMTP Email Dispatcher", "external_api");

    // Seed standard communication paths
    this.registerEdge("ExpressServer", "Firestore");
    this.registerEdge("ExpressServer", "StripeAPI");
    this.registerEdge("ExpressServer", "GeminiAI");
    this.registerEdge("ExpressServer", "TwilioSMS");
    this.registerEdge("ExpressServer", "NodemailerEmail");
  }

  public static registerNode(id: string, name: string, type: "service" | "database" | "external_api") {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        name,
        type,
        status: "HEALTHY",
        lastActive: new Date().toISOString(),
      });
    }
  }

  private static registerEdge(source: string, target: string) {
    const key = `${source}->${target}`;
    if (!this.edges.has(key)) {
      this.edges.set(key, {
        source,
        target,
        calls: 0,
        failures: 0,
        avgLatencyMs: 0,
        status: "normal",
      });
    }
  }

  /**
   * Records a dynamic call on a dependency connection path.
   */
  public static recordCall(source: string, target: string, durationMs: number, success: boolean) {
    this.registerNode(source, source, "service");
    this.registerNode(target, target, target === "Firestore" ? "database" : "external_api");

    const key = `${source}->${target}`;
    let edge = this.edges.get(key);
    if (!edge) {
      edge = {
        source,
        target,
        calls: 0,
        failures: 0,
        avgLatencyMs: 0,
        status: "normal",
      };
      this.edges.set(key, edge);
    }

    const prevCalls = edge.calls;
    edge.calls += 1;
    if (!success) {
      edge.failures += 1;
    }

    // Dynamic running average calculation
    edge.avgLatencyMs = Math.round((edge.avgLatencyMs * prevCalls + durationMs) / edge.calls);

    // Update statuses dynamically based on heuristics
    const node = this.nodes.get(target);
    if (node) {
      node.lastActive = new Date().toISOString();
      const errorRate = edge.failures / edge.calls;
      const oldStatus = node.status;

      if (errorRate > 0.5) {
        node.status = "UNAVAILABLE";
        edge.status = "failing";
      } else if (errorRate > 0.15) {
        node.status = "PARTIAL_OUTAGE";
        edge.status = "failing";
      } else if (edge.avgLatencyMs > 2500) {
        node.status = "DEGRADED";
        edge.status = "congested";
      } else {
        node.status = "HEALTHY";
        edge.status = "normal";
      }

      if (oldStatus !== node.status) {
        EnterpriseEventBus.publish("DependencyChanged", {
          component: node.id,
          state: node.status,
          latencyMs: edge.avgLatencyMs,
        });
      }
    }
  }

  /**
   * Resets graph edge counters and clears dynamic structures
   */
  public static resetMetrics() {
    for (const [_, edge] of this.edges) {
      edge.calls = 0;
      edge.failures = 0;
      edge.avgLatencyMs = 0;
      edge.status = "normal";
    }
    for (const [_, node] of this.nodes) {
      node.status = "HEALTHY";
      node.lastActive = new Date().toISOString();
    }
  }

  /**
   * Returns serializable snapshot of the dynamic dependency graph
   */
  public static getGraph() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }
}
