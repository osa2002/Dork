import { Router } from "express";
import {
  getHealth,
  getReady,
  getLive,
  getVersion,
  getMetrics,
  getFeatureFlags,
} from "../controllers/observabilityController";

const router = Router();

// Observability, Metrics & Enterprise Health Endpoints (Phase 6.1)
router.get("/health", getHealth);
router.get("/ready", getReady);
router.get("/live", getLive);
router.get("/version", getVersion);
router.get("/api/metrics", getMetrics);
router.get("/api/features", getFeatureFlags);

export default router;
