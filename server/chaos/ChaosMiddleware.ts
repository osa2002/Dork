import { Request, Response, NextFunction } from "express";
import { ChaosConfig } from "./ChaosConfig";
import { ChaosState } from "./ChaosState";
import { ChaosRegistry } from "./ChaosRegistry";
import { TelemetryService } from "../../src/services/TelemetryService";
import { logContextStorage } from "../../src/lib/serverLogger";

export const chaosMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Strict Gate Protection
  if (!ChaosConfig.isGateApproved()) {
    return next();
  }

  // 2. Authorization Protection
  if (!ChaosConfig.isAuthorized(req.headers)) {
    return next();
  }

  // 3. Increment total evaluated chaos events
  ChaosState.incrementMetric("chaos_events_total");

  const start = Date.now();
  const correlationId = logContextStorage.getStore()?.correlationId || "chaos-corr-id";

  // Parse custom headers with overrides (TASK 4)
  const headerMode = req.headers[ChaosConfig.HEADERS.MODE]?.toString().toLowerCase();
  const headerLatency = req.headers[ChaosConfig.HEADERS.LATENCY];
  const headerFailure = req.headers[ChaosConfig.HEADERS.FAILURE]?.toString().toLowerCase();
  const headerProbability = req.headers[ChaosConfig.HEADERS.PROBABILITY];
  const headerDelay = req.headers[ChaosConfig.HEADERS.DELAY];
  const headerTarget = req.headers[ChaosConfig.HEADERS.TARGET]?.toString().toLowerCase();

  // Handle mode activation override
  if (headerMode === "active" || headerMode === "enabled" || headerMode === "true") {
    ChaosState.setEnabled(true);
  } else if (headerMode === "inactive" || headerMode === "disabled" || headerMode === "false") {
    ChaosState.setEnabled(false);
  }

  // Latency parsing
  let latencyMs = ChaosState.getLatency();
  if (headerLatency) {
    const parsed = parseInt(headerLatency.toString(), 10);
    if (!isNaN(parsed)) latencyMs = parsed;
  } else if (headerDelay) {
    const parsed = parseInt(headerDelay.toString(), 10);
    if (!isNaN(parsed)) latencyMs = parsed;
  }

  // Probability parsing (support percentages like "25%" or "0.25")
  let probability = ChaosState.getProbability();
  if (headerProbability) {
    const probStr = headerProbability.toString();
    if (probStr.endsWith("%")) {
      const parsed = parseFloat(probStr.slice(0, -1));
      if (!isNaN(parsed)) probability = parsed / 100;
    } else {
      const parsed = parseFloat(probStr);
      if (!isNaN(parsed)) probability = parsed;
    }
  }

  // Target matching logic (TASK 6)
  const path = req.path.toLowerCase();
  const configuredTargets = ChaosState.getTargetEndpoints();
  let matchesTarget = configuredTargets.length === 0; // True if no targets configured (global)

  if (configuredTargets.length > 0) {
    matchesTarget = configuredTargets.some((target) => path.includes(target.toLowerCase()));
  }

  if (headerTarget) {
    matchesTarget = path.includes(headerTarget);
  }

  // If path doesn't match targets, bypass failure injection safely
  if (!matchesTarget) {
    ChaosState.incrementMetric("chaos_events_success");
    return next();
  }

  // 4. Probabilistic evaluation using seeded randomness (TASK 5)
  const hit = ChaosState.evaluateProbability(probability);
  if (!hit) {
    ChaosState.incrementMetric("chaos_events_success");
    return next();
  }

  // Determine failure scenario (Default or Header)
  let scenarioName = "latencyscenario"; // default
  let resolvedFailureType = "";

  if (headerFailure) {
    resolvedFailureType = headerFailure;
    if (headerFailure.includes("latency") || headerFailure.includes("delay")) {
      scenarioName = "latencyscenario";
    } else if (headerFailure.includes("stripe") || headerFailure.includes("twilio") || headerFailure.includes("gemini") || headerFailure.includes("dependency")) {
      scenarioName = "dependencyfailurescenario";
    } else if (headerFailure.includes("timeout") || headerFailure.includes("contention") || headerFailure.includes("database") || headerFailure.includes("firestore") || headerFailure.includes("repository") || headerFailure.includes("transaction")) {
      if (headerFailure.includes("contention") || headerFailure.includes("transaction")) {
        scenarioName = "transactionfailurescenario";
      } else {
        scenarioName = "databasefailurescenario";
      }
    } else if (headerFailure.includes("cleanup")) {
      scenarioName = "cleanupfailurescenario";
    } else if (headerFailure.includes("scheduler")) {
      scenarioName = "schedulerfailurescenario";
    } else if (headerFailure.includes("rate_limit") || headerFailure.includes("429")) {
      scenarioName = "ratelimitscenario";
    } else if (headerFailure.includes("auth") || headerFailure.includes("401") || headerFailure.includes("unauthorized")) {
      scenarioName = "authenticationfailurescenario";
    } else {
      // Map other special strings directly
      scenarioName = "databasefailurescenario";
    }
  } else {
    // If no header failure, use active scenarios from state
    const active = ChaosState.getActiveScenarios();
    if (active.length > 0) {
      scenarioName = active[0].toLowerCase();
    }
  }

  const scenario = ChaosRegistry.get(scenarioName);

  // Telemetry Span initialization
  const telemetrySpan = TelemetryService.startSpan("chaos:injection");
  telemetrySpan.setAttribute("scenario", scenarioName);
  telemetrySpan.setAttribute("target", path);
  telemetrySpan.setAttribute("probability", probability);
  telemetrySpan.setAttribute("correlationId", correlationId);

  try {
    if (!scenario) {
      throw new Error(`Chaos scenario ${scenarioName} not found in registry`);
    }

    // Run the failure scenario!
    await scenario.run({
      req,
      res,
      next,
      target: path,
      latencyMs,
      failureType: resolvedFailureType,
    });

    const duration = Date.now() - start;
    telemetrySpan.setAttribute("duration", duration);
    telemetrySpan.setAttribute("result", "SUCCESS_PASSTHROUGH");
    telemetrySpan.end();

    ChaosState.incrementMetric("chaos_events_success");
    next();
  } catch (err: any) {
    const duration = Date.now() - start;
    telemetrySpan.setAttribute("duration", duration);
    telemetrySpan.setAttribute("result", "FAILURE_INJECTED");
    telemetrySpan.setAttribute("error", true);
    telemetrySpan.setAttribute("error.message", err.message);
    telemetrySpan.end();

    ChaosState.incrementMetric("chaos_events_failed");

    // Pass the injected error to the global handler
    next(err);
  }
};
