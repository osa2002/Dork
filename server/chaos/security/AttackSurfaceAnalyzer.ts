export type InterfaceType =
  | "PublicAPI"
  | "AdminAPI"
  | "InternalAPI"
  | "PlatformService"
  | "ChaosInterface"
  | "GovernanceInterface"
  | "ReleaseInterface"
  | "ObservabilityInterface";

export type ExposureLevel =
  | "PUBLIC"
  | "AUTHENTICATED_VENDOR"
  | "ADMIN_ONLY"
  | "INTERNAL_ONLY";

export interface AttackSurfaceEndpoint {
  readonly id: string;
  readonly pathOrName: string;
  readonly interfaceType: InterfaceType;
  readonly exposureLevel: ExposureLevel;
  readonly authRequired: boolean;
  readonly protocol: "HTTP/REST" | "WebSocket" | "InProcessMethod";
  readonly rateLimited: boolean;
  readonly sanitizedInput: boolean;
  readonly riskScore: number; // 1 (Low) to 10 (Critical)
  readonly description: string;
}

export interface AttackSurfaceReport {
  readonly timestamp: string;
  readonly totalEndpoints: number;
  readonly publicEndpointsCount: number;
  readonly authenticatedEndpointsCount: number;
  readonly internalEndpointsCount: number;
  readonly unauthenticatedPublicCount: number;
  readonly attackSurfaceScore: number; // 100 is best (safely isolated)
  readonly endpoints: readonly AttackSurfaceEndpoint[];
  readonly recommendations: readonly string[];
}

export class AttackSurfaceAnalyzer {
  private static readonly inventory: readonly AttackSurfaceEndpoint[] = Object.freeze([
    // Public APIs
    {
      id: "AS-PUB-01",
      pathOrName: "/api/v1/auth/login",
      interfaceType: "PublicAPI",
      exposureLevel: "PUBLIC",
      authRequired: false,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 3,
      description: "Public client login verification endpoint accepting Firebase ID tokens.",
    },
    {
      id: "AS-PUB-02",
      pathOrName: "/api/v1/queue/public-ticket/:id",
      interfaceType: "PublicAPI",
      exposureLevel: "PUBLIC",
      authRequired: false,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 2,
      description: "Public queue ticket status lookup via QR code link.",
    },

    // Admin / Vendor APIs
    {
      id: "AS-ADM-01",
      pathOrName: "/api/v1/vendor/tickets",
      interfaceType: "AdminAPI",
      exposureLevel: "AUTHENTICATED_VENDOR",
      authRequired: true,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 4,
      description: "Vendor ticket administration, call next ticket, mark served/cancelled.",
    },
    {
      id: "AS-ADM-02",
      pathOrName: "/api/v1/shop/config",
      interfaceType: "AdminAPI",
      exposureLevel: "AUTHENTICATED_VENDOR",
      authRequired: true,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 4,
      description: "Shop configuration management, operating hours, branding.",
    },

    // Internal APIs
    {
      id: "AS-INT-01",
      pathOrName: "/api/internal/service-sync",
      interfaceType: "InternalAPI",
      exposureLevel: "INTERNAL_ONLY",
      authRequired: true,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 2,
      description: "Internal service-to-service state synchronization route.",
    },

    // Platform Services
    {
      id: "AS-SVC-01",
      pathOrName: "PlatformKernel.evaluate()",
      interfaceType: "PlatformService",
      exposureLevel: "INTERNAL_ONLY",
      authRequired: false,
      protocol: "InProcessMethod",
      rateLimited: false,
      sanitizedInput: true,
      riskScore: 1,
      description: "Platform Kernel health evaluation and SRE topology calculation.",
    },
    {
      id: "AS-SVC-02",
      pathOrName: "EnterpriseEventBus.publish()",
      interfaceType: "PlatformService",
      exposureLevel: "INTERNAL_ONLY",
      authRequired: false,
      protocol: "InProcessMethod",
      rateLimited: false,
      sanitizedInput: true,
      riskScore: 1,
      description: "Central non-blocking asynchronous pub/sub event bus.",
    },

    // Chaos Interfaces
    {
      id: "AS-CHS-01",
      pathOrName: "/api/v1/chaos/experiments",
      interfaceType: "ChaosInterface",
      exposureLevel: "ADMIN_ONLY",
      authRequired: true,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 5,
      description: "SRE Chaos Engineering experiment trigger and orchestrator controller.",
    },

    // Governance Interfaces
    {
      id: "AS-GOV-01",
      pathOrName: "GovernanceEngine.calculateScores()",
      interfaceType: "GovernanceInterface",
      exposureLevel: "INTERNAL_ONLY",
      authRequired: false,
      protocol: "InProcessMethod",
      rateLimited: false,
      sanitizedInput: true,
      riskScore: 1,
      description: "Enterprise SLA compliance score calculation and policy evaluation.",
    },

    // Release Interfaces
    {
      id: "AS-REL-01",
      pathOrName: "ReleaseGateCheck.execute()",
      interfaceType: "ReleaseInterface",
      exposureLevel: "INTERNAL_ONLY",
      authRequired: false,
      protocol: "InProcessMethod",
      rateLimited: false,
      sanitizedInput: true,
      riskScore: 2,
      description: "Automated CI/CD release gate certification and SBOM generator.",
    },

    // Observability Interfaces
    {
      id: "AS-OBS-01",
      pathOrName: "/health, /live, /ready",
      interfaceType: "ObservabilityInterface",
      exposureLevel: "PUBLIC",
      authRequired: false,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 1,
      description: "Cloud Run and Kubernetes liveness/readiness probe endpoints.",
    },
    {
      id: "AS-OBS-02",
      pathOrName: "/metrics",
      interfaceType: "ObservabilityInterface",
      exposureLevel: "INTERNAL_ONLY",
      authRequired: false,
      protocol: "HTTP/REST",
      rateLimited: true,
      sanitizedInput: true,
      riskScore: 2,
      description: "Prometheus metrics telemetry export endpoint.",
    },
  ]);

  public static analyze(): AttackSurfaceReport {
    const endpoints = this.inventory;
    const totalEndpoints = endpoints.length;

    let publicEndpointsCount = 0;
    let authenticatedEndpointsCount = 0;
    let internalEndpointsCount = 0;
    let unauthenticatedPublicCount = 0;

    endpoints.forEach((ep) => {
      if (ep.exposureLevel === "PUBLIC") {
        publicEndpointsCount++;
        if (!ep.authRequired) unauthenticatedPublicCount++;
      } else if (ep.exposureLevel === "AUTHENTICATED_VENDOR" || ep.exposureLevel === "ADMIN_ONLY") {
        authenticatedEndpointsCount++;
      } else if (ep.exposureLevel === "INTERNAL_ONLY") {
        internalEndpointsCount++;
      }
    });

    // Score calculation: High ratio of authenticated/internal & sanitized endpoints yields 95-100%
    const rateLimitedRatio = endpoints.filter((e) => e.rateLimited || e.protocol === "InProcessMethod").length / totalEndpoints;
    const sanitizedRatio = endpoints.filter((e) => e.sanitizedInput).length / totalEndpoints;
    const attackSurfaceScore = Math.round(((rateLimitedRatio + sanitizedRatio) / 2) * 100);

    const recommendations = [
      "Keep /metrics protected behind internal reverse proxy firewall or VPC service controls.",
      "Ensure public endpoints (/health, /api/v1/queue/public-ticket) remain strictly read-only and rate-limited.",
      "Verify all vendor/admin REST endpoints continue to enforce Firebase JWT token validation middleware.",
    ];

    return {
      timestamp: new Date().toISOString(),
      totalEndpoints,
      publicEndpointsCount,
      authenticatedEndpointsCount,
      internalEndpointsCount,
      unauthenticatedPublicCount,
      attackSurfaceScore,
      endpoints,
      recommendations: Object.freeze(recommendations),
    };
  }
}
