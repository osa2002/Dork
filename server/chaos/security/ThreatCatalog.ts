import { ThreatItem, ThreatModelReport, ThreatMatrixEntry, ThreatCategory } from "./ThreatModel";

export class ThreatCatalog {
  private static readonly catalog: readonly ThreatItem[] = Object.freeze([
    // 1. Authentication
    {
      id: "THREAT-AUTH-001",
      name: "Token Forgery / Malformed JWT",
      category: "Authentication",
      stride: "Spoofing",
      severity: "CRITICAL",
      description: "Attacker attempts to forge Firebase ID Tokens or pass unverified Bearer tokens to access shop data.",
      impactedComponents: ["authMiddleware", "Express App", "Firestore Rules"],
      mitigation: "Strict Firebase Admin token verification in authMiddleware; token expiration checks.",
      status: "MITIGATED",
      verificationCheck: "authenticateFirebaseUser throws UnauthorizedError on forged/invalid token signature.",
      cvssScore: 9.3,
    },
    {
      id: "THREAT-AUTH-002",
      name: "Demo Token Abuse in Non-Prod Environments",
      category: "Authentication",
      stride: "Spoofing",
      severity: "HIGH",
      description: "Demo token fallback (`demo_*`) accidentally allowed or enabled in Production tier.",
      impactedComponents: ["authMiddleware"],
      mitigation: "Environment isolation check `process.env.NODE_ENV !== 'production'` strictly gating demo tokens.",
      status: "MITIGATED",
      verificationCheck: "Auth middleware checks process.env.NODE_ENV before allowing demo_ prefix.",
      cvssScore: 8.1,
    },

    // 2. Authorization
    {
      id: "THREAT-AUTHZ-001",
      name: "Cross-Tenant Shop ID Impersonation (BOPA/IDOR)",
      category: "Authorization",
      stride: "ElevationOfPrivilege",
      severity: "CRITICAL",
      description: "Authenticated vendor attempts to access or modify queue tickets belonging to a different shopId.",
      impactedComponents: ["ShopRepository", "QueueStore", "Firestore Security Rules"],
      mitigation: "Derive shopId directly from verified JWT claims (`decodedToken.uid`) instead of client body parameters.",
      status: "MITIGATED",
      verificationCheck: "req.shopId is set solely from verified decoded token.",
      cvssScore: 9.1,
    },

    // 3. API
    {
      id: "THREAT-API-001",
      name: "Unbounded Payload Injection & DDoS",
      category: "API",
      stride: "DenialOfService",
      severity: "HIGH",
      description: "Attacker transmits massive JSON payloads or malformed ticket data to exhaust memory/CPU.",
      impactedComponents: ["validationMiddleware", "Express BodyParser"],
      mitigation: "Strict Zod schema validation middleware sanitizing all inputs; body-parser size caps.",
      status: "MITIGATED",
      verificationCheck: "Zod validation middleware rejects invalid schemas before route controllers execute.",
      cvssScore: 7.5,
    },

    // 4. Firestore
    {
      id: "THREAT-DB-001",
      name: "Unauthenticated Direct Firestore Write",
      category: "Firestore",
      stride: "Tampering",
      severity: "CRITICAL",
      description: "Malicious actor uses web SDK to write directly to Firestore bypassing backend logic.",
      impactedComponents: ["firestore.rules", "Firebase Client SDK"],
      mitigation: "Granular firestore.rules requiring `request.auth != null` and `request.auth.uid == shopId`.",
      status: "MITIGATED",
      verificationCheck: "firestore.rules deployed and verified via release gate checks.",
      cvssScore: 9.0,
    },

    // 5. Event Bus
    {
      id: "THREAT-BUS-001",
      name: "Subscriber Event Poisoning & Unhandled Exceptions",
      category: "EventBus",
      stride: "DenialOfService",
      severity: "MEDIUM",
      description: "A failing event subscriber throws an exception that crashes the central event bus stream.",
      impactedComponents: ["EnterpriseEventBus"],
      mitigation: "Async try/catch error insulation with bounded diagnostic logging per subscriber callback.",
      status: "MITIGATED",
      verificationCheck: "EnterpriseEventBus captures subscriber errors without failing event propagation.",
      cvssScore: 6.2,
    },

    // 6. Platform Kernel
    {
      id: "THREAT-KERN-001",
      name: "Unregistered Engine Dynamic Loading Violation",
      category: "PlatformKernel",
      stride: "Tampering",
      severity: "HIGH",
      description: "Unregistered or corrupted SRE module attempts execution without Compatibility Matrix clearance.",
      impactedComponents: ["ModuleRegistry", "CompatibilityMatrix", "PlatformKernel"],
      mitigation: "Strict manifest validation, freeze enforcement, and semver compatibility checking.",
      status: "MITIGATED",
      verificationCheck: "PlatformKernel evaluate() validates readiness and dependency catalog integrity.",
      cvssScore: 7.8,
    },

    // 7. CI/CD
    {
      id: "THREAT-CICD-001",
      name: "Uncertified Artifact Deployment to Production",
      category: "CICD",
      stride: "ElevationOfPrivilege",
      severity: "CRITICAL",
      description: "Bypassing quality/security gates to deploy unverified code directly to Cloud Run.",
      impactedComponents: [".github/workflows/quality-gate.yml", "release-gate-check.ts"],
      mitigation: "Release gate check script verifying SLA health score >= 90% and SBOM existence prior to tag release.",
      status: "MITIGATED",
      verificationCheck: "GitHub workflows invoke release-gate-check.ts blocking on gate failures.",
      cvssScore: 9.5,
    },

    // 8. Cloud Run
    {
      id: "THREAT-CR-001",
      name: "Stateless Container Persistence Assumption",
      category: "CloudRun",
      stride: "Tampering",
      severity: "HIGH",
      description: "Application logic relies on persistent local disk writes leading to state drift during container scaling.",
      impactedComponents: ["server.ts", "Cloud Run Container"],
      mitigation: "Enforce fully stateless Cloud Run runtime; process outputs stored in Firestore or memory queues.",
      status: "MITIGATED",
      verificationCheck: "Cloud Run compliance check in release gate confirms zero local DB dependence.",
      cvssScore: 7.2,
    },

    // 9. Secrets
    {
      id: "THREAT-SEC-001",
      name: "Exposed API Keys / Private Tokens in Source Code",
      category: "Secrets",
      stride: "InformationDisclosure",
      severity: "CRITICAL",
      description: "Hardcoded API keys, private keys, or credentials committed into repository.",
      impactedComponents: ["Secret Scanning Gate", ".env.example"],
      mitigation: "Automated regex secret scanning in security gate and release gate checks.",
      status: "MITIGATED",
      verificationCheck: "Security gate regex audit blocks build on Google/Stripe/Slack credential patterns.",
      cvssScore: 9.8,
    },

    // 10. Supply Chain
    {
      id: "THREAT-SC-001",
      name: "Vulnerable Node Package / Copyleft License Violation",
      category: "SupplyChain",
      stride: "Tampering",
      severity: "HIGH",
      description: "Inclusion of malicious/vulnerable npm dependencies or GPL/AGPL copyleft libraries.",
      impactedComponents: ["package.json", "npm audit", "CycloneDX SBOM"],
      mitigation: "Immutable CycloneDX SBOM generation, `npm audit`, and license blacklisting in release gate.",
      status: "MITIGATED",
      verificationCheck: "Release gate check compiles sbom.json and audits dependency licenses.",
      cvssScore: 8.5,
    },
  ]);

  public static getThreats(): readonly ThreatItem[] {
    return this.catalog;
  }

  public static evaluateModel(correlationId: string = `corr-sec-${Math.random().toString(36).substring(2, 9)}`): ThreatModelReport {
    const threats = this.catalog;
    const categories: ThreatCategory[] = [
      "Authentication",
      "Authorization",
      "API",
      "Firestore",
      "EventBus",
      "PlatformKernel",
      "CICD",
      "CloudRun",
      "Secrets",
      "SupplyChain",
    ];

    let totalThreats = threats.length;
    let mitigatedCount = 0;
    let partiallyMitigatedCount = 0;
    let unmitigatedCount = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    threats.forEach((t) => {
      if (t.status === "MITIGATED") mitigatedCount++;
      else if (t.status === "PARTIALLY_MITIGATED") partiallyMitigatedCount++;
      else if (t.status === "UNMITIGATED") unmitigatedCount++;

      if (t.severity === "CRITICAL") criticalCount++;
      else if (t.severity === "HIGH") highCount++;
      else if (t.severity === "MEDIUM") mediumCount++;
      else if (t.severity === "LOW") lowCount++;
    });

    const matrix: ThreatMatrixEntry[] = categories.map((cat) => {
      const catThreats = threats.filter((t) => t.category === cat);
      const catTotal = catThreats.length;
      const catMitigated = catThreats.filter((t) => t.status === "MITIGATED").length;
      const catUnmitigated = catThreats.filter((t) => t.status === "UNMITIGATED").length;
      const catCriticals = catThreats.filter((t) => t.severity === "CRITICAL").length;
      const catHighs = catThreats.filter((t) => t.severity === "HIGH").length;
      const catScore = catTotal > 0 ? Math.round((catMitigated / catTotal) * 100) : 100;

      return {
        category: cat,
        total: catTotal,
        mitigated: catMitigated,
        unmitigated: catUnmitigated,
        criticals: catCriticals,
        highs: catHighs,
        scorePercent: catScore,
      };
    });

    const overallThreatScore = totalThreats > 0 ? Math.round((mitigatedCount / totalThreats) * 100) : 100;

    return {
      timestamp: new Date().toISOString(),
      correlationId,
      totalThreats,
      mitigatedCount,
      partiallyMitigatedCount,
      unmitigatedCount,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      overallThreatScore,
      matrix: Object.freeze(matrix),
      threats: Object.freeze([...threats]),
    };
  }
}
