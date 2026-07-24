import { Request, Response } from "express";
import { ChaosState } from "./ChaosState";
import { ChaosRegistry } from "./ChaosRegistry";
import { ChaosConfig } from "./ChaosConfig";
import { ChaosHealthContributor } from "./intelligence/ChaosHealthContributor";
import { ChaosImpactAnalyzer } from "./intelligence/ChaosImpactAnalyzer";
import { ChaosSLOIntegration } from "./intelligence/ChaosSLOIntegration";
import { ChaosCoverageAnalyzer } from "./intelligence/ChaosCoverageAnalyzer";
import { ChaosIntelligenceEngine } from "./intelligence/ChaosIntelligenceEngine";
import { RuntimeDependencyGraph } from "./intelligence/RuntimeDependencyGraph";
import { OperationalDashboardModel } from "./governance/OperationalDashboard";
import { EnterpriseEventBus } from "./governance/EnterpriseEventBus";

export class ChaosController {
  /**
   * GET /api/chaos/state
   * Retrieves the current chaos engineering dashboard state, metrics, and scenario lists.
   */
  public static getState(req: Request, res: Response) {
    if (!ChaosConfig.isGateApproved() || !ChaosConfig.isAuthorized(req.headers)) {
      return res.status(403).json({ error: "Access Denied. Chaos Mode disabled or unauthorized." });
    }

    return res.status(200).json({
      enabled: ChaosState.getIsEnabled(),
      probability: ChaosState.getProbability(),
      latencyMs: ChaosState.getLatency(),
      targetEndpoints: ChaosState.getTargetEndpoints(),
      activeScenarios: ChaosState.getActiveScenarios(),
      availableScenarios: ChaosRegistry.getAll().map((s) => ({
        name: s.name,
        description: s.description,
      })),
      metrics: {
        chaos_events_total: ChaosState.getMetric("chaos_events_total"),
        chaos_events_success: ChaosState.getMetric("chaos_events_success"),
        chaos_events_failed: ChaosState.getMetric("chaos_events_failed"),
        chaos_latency_added: ChaosState.getMetric("chaos_latency_added"),
        chaos_probability_hits: ChaosState.getMetric("chaos_probability_hits"),
      },
    });
  }

  /**
   * GET /api/chaos/intelligence
   * Exposes SRE operational intelligence reports, dependency graphs, and risk-progression recommendations.
   */
  public static getIntelligence(req: Request, res: Response) {
    if (!ChaosConfig.isGateApproved() || !ChaosConfig.isAuthorized(req.headers)) {
      return res.status(403).json({ error: "Access Denied. Chaos Mode disabled or unauthorized." });
    }

    return res.status(200).json({
      health: ChaosHealthContributor.getHealthStatus(),
      blastRadius: ChaosImpactAnalyzer.calculateBlastRadius(),
      slo: ChaosSLOIntegration.getSLOMetrics(),
      coverage: ChaosCoverageAnalyzer.getCoverageReport(),
      dependencyGraph: RuntimeDependencyGraph.getGraph(),
      recommendations: ChaosIntelligenceEngine.getRecommendations(),
    });
  }

  /**
   * GET /api/chaos/governance
   * Exposes the complete unified operational governance dashboard data including baseline snapshots, scores, trends, audit trail, and regressions.
   */
  public static getGovernance(req: Request, res: Response) {
    if (!ChaosConfig.isGateApproved() || !ChaosConfig.isAuthorized(req.headers)) {
      return res.status(403).json({ error: "Access Denied. Chaos Mode disabled or unauthorized." });
    }

    try {
      const payload = OperationalDashboardModel.getDashboardPayload();
      return res.status(200).json(payload);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to compile operational governance metrics: ${err.message}` });
    }
  }

  /**
   * GET /api/chaos/eventbus
   * Exposes read-only operational events, diagnostics, and active subscribers.
   */
  public static getEventBus(req: Request, res: Response) {
    if (!ChaosConfig.isGateApproved() || !ChaosConfig.isAuthorized(req.headers)) {
      return res.status(403).json({ error: "Access Denied. Chaos Mode disabled or unauthorized." });
    }

    try {
      return res.status(200).json({
        success: true,
        events: EnterpriseEventBus.getHistory(),
        diagnostics: EnterpriseEventBus.getDiagnostics(),
        subscribers: EnterpriseEventBus.getActiveSubscribers(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to fetch event bus telemetry: ${err.message}` });
    }
  }

  /**
   * POST /api/chaos/configure
   * Updates chaos state, active targets, probability, and activates/deactivates specific scenarios.
   */
  public static configure(req: Request, res: Response) {
    if (!ChaosConfig.isGateApproved() || !ChaosConfig.isAuthorized(req.headers)) {
      return res.status(403).json({ error: "Access Denied. Chaos Mode disabled or unauthorized." });
    }

    const { enabled, probability, latencyMs, targetEndpoints, activateScenarios, deactivateScenarios, seed } = req.body;

    if (enabled !== undefined) {
      ChaosState.setEnabled(!!enabled);
    }

    if (probability !== undefined) {
      const parsedProb = parseFloat(probability);
      if (!isNaN(parsedProb)) {
        ChaosState.setProbability(parsedProb);
      }
    }

    if (latencyMs !== undefined) {
      const parsedLat = parseInt(latencyMs, 10);
      if (!isNaN(parsedLat)) {
        ChaosState.setLatency(parsedLat);
      }
    }

    if (seed !== undefined) {
      const parsedSeed = parseInt(seed, 10);
      if (!isNaN(parsedSeed)) {
        ChaosState.setSeed(parsedSeed);
      }
    }

    if (Array.isArray(targetEndpoints)) {
      ChaosState.clearTargetEndpoints();
      targetEndpoints.forEach((t) => {
        if (typeof t === "string") ChaosState.addTargetEndpoint(t);
      });
    }

    if (Array.isArray(activateScenarios)) {
      activateScenarios.forEach((s) => {
        if (typeof s === "string") {
          const scenario = ChaosRegistry.get(s);
          if (scenario) {
            ChaosState.activateScenario(scenario.name);
          }
        }
      });
    }

    if (Array.isArray(deactivateScenarios)) {
      deactivateScenarios.forEach((s) => {
        if (typeof s === "string") {
          const scenario = ChaosRegistry.get(s);
          if (scenario) {
            ChaosState.deactivateScenario(scenario.name);
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chaos Engineering settings updated successfully.",
    });
  }

  /**
   * POST /api/chaos/reset
   * Resets chaos engineering configuration and statistics.
   */
  public static reset(req: Request, res: Response) {
    if (!ChaosConfig.isGateApproved() || !ChaosConfig.isAuthorized(req.headers)) {
      return res.status(403).json({ error: "Access Denied. Chaos Mode disabled or unauthorized." });
    }

    ChaosState.setEnabled(false);
    ChaosState.setProbability(0.25);
    ChaosState.setLatency(0);
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();
    ChaosState.resetSeed();
    ChaosState.resetMetrics();
    ChaosState.clearAllTimers();

    // Reset SRE Intelligence metrics
    RuntimeDependencyGraph.resetMetrics();
    ChaosSLOIntegration.clearHistory();
    ChaosCoverageAnalyzer.reset();

    return res.status(200).json({
      success: true,
      message: "Chaos state, metrics, and scenario configurations reset to pristine.",
    });
  }
}
