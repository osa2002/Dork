import { describe, it, expect, beforeEach } from "vitest";
import { SecurityContext } from "./SecurityContext";
import { ThreatCatalog } from "./ThreatCatalog";
import { AttackSurfaceAnalyzer } from "./AttackSurfaceAnalyzer";
import { SecurityPolicy } from "./SecurityPolicy";
import { SecurityValidator } from "./SecurityValidator";
import { RuntimeSecurityEvaluator } from "./RuntimeSecurityEvaluator";
import { ContainerSecurity } from "./ContainerSecurity";
import { IdentitySecurity } from "./IdentitySecurity";
import { SupplyChainSecurity } from "./SupplyChainSecurity";
import { ArtifactSigner } from "./ArtifactSigner";
import { SecurityReporter } from "./SecurityReporter";
import { SecurityEngine } from "./SecurityEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("🛡️ Enterprise Security Hardening Platform", () => {

  beforeEach(() => {
    EnterpriseEventBus.clear();
  });

  describe("SecurityContext", () => {
    it("should instantiate immutable context with sensible defaults", () => {
      const ctx = SecurityContext.create();
      expect(ctx.environment).toBeDefined();
      expect(ctx.correlationId).toMatch(/^sec-/);
      expect(ctx.enforcementMode).toBe("enforce");
      expect(ctx.securityLevel).toBe("STRICT");
      expect(ctx.user.role).toBe("SUPER_ADMIN");
      expect(Object.isFrozen(ctx)).toBe(true);
      expect(Object.isFrozen(ctx.user)).toBe(true);
    });

    it("should create anonymous security context", () => {
      const anon = SecurityContext.createAnonymous();
      expect(anon.user.uid).toBe("anonymous");
      expect(anon.user.role).toBe("ANONYMOUS");
      expect(anon.user.shopId).toBeUndefined();
    });
  });

  describe("ThreatCatalog & ThreatModel", () => {
    it("should load threat catalog covering all 10 mandatory categories", () => {
      const report = ThreatCatalog.evaluateModel("test-corr-123");
      expect(report.totalThreats).toBeGreaterThanOrEqual(10);
      expect(report.overallThreatScore).toBe(100);
      expect(report.mitigatedCount).toBe(report.totalThreats);
      expect(report.matrix.length).toBe(10);

      const categories = report.matrix.map((m) => m.category);
      expect(categories).toContain("Authentication");
      expect(categories).toContain("Authorization");
      expect(categories).toContain("API");
      expect(categories).toContain("Firestore");
      expect(categories).toContain("EventBus");
      expect(categories).toContain("PlatformKernel");
      expect(categories).toContain("CICD");
      expect(categories).toContain("CloudRun");
      expect(categories).toContain("Secrets");
      expect(categories).toContain("SupplyChain");
    });
  });

  describe("AttackSurfaceAnalyzer", () => {
    it("should analyze public, admin, internal, and observability interfaces", () => {
      const report = AttackSurfaceAnalyzer.analyze();
      expect(report.totalEndpoints).toBeGreaterThan(5);
      expect(report.publicEndpointsCount).toBeGreaterThan(0);
      expect(report.authenticatedEndpointsCount).toBeGreaterThan(0);
      expect(report.internalEndpointsCount).toBeGreaterThan(0);
      expect(report.attackSurfaceScore).toBeGreaterThanOrEqual(90);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("SecurityPolicy", () => {
    it("should evaluate policy suite for all 5 enterprise principles", () => {
      const ctx = SecurityContext.create();
      const report = SecurityPolicy.evaluatePolicySuite(ctx);
      expect(report.totalRules).toBe(5);
      expect(report.passedCount).toBe(5);
      expect(report.complianceScore).toBe(100);

      const principles = report.results.map((r) => r.principle);
      expect(principles).toContain("LeastPrivilege");
      expect(principles).toContain("ZeroTrust");
      expect(principles).toContain("DefenseInDepth");
      expect(principles).toContain("SecureDefaults");
      expect(principles).toContain("ImmutableInfrastructure");
    });
  });

  describe("SecurityValidator", () => {
    it("should perform static checks and pass secret scanning", () => {
      const ctx = SecurityContext.create();
      const report = SecurityValidator.validate(ctx);
      expect(report.secretScanningPassed).toBe(true);
      expect(report.passedChecks).toBeGreaterThanOrEqual(4);
      expect(report.staticSecurityScore).toBeGreaterThanOrEqual(80);
    });
  });

  describe("RuntimeSecurityEvaluator", () => {
    it("should evaluate runtime dimensions and tenant isolation", () => {
      const ctx = SecurityContext.create();
      const report = RuntimeSecurityEvaluator.evaluate(ctx);
      expect(report.jwtIntegrityPassed).toBe(true);
      expect(report.roleValidationPassed).toBe(true);
      expect(report.permissionBoundariesPassed).toBe(true);
      expect(report.environmentIsolationPassed).toBe(true);
      expect(report.overallRuntimeScore).toBeGreaterThanOrEqual(90);
      expect(report.dimensions.length).toBe(6);
    });
  });

  describe("ContainerSecurity", () => {
    it("should verify Cloud Run statelessness and non-root execution", () => {
      const report = ContainerSecurity.evaluate();
      expect(report.isCloudRunCompliant).toBe(true);
      expect(report.rootUserRestricted).toBe(true);
      expect(report.filesystemStateless).toBe(true);
      expect(report.startupValidated).toBe(true);
      expect(report.containerSecurityScore).toBe(100);
    });
  });

  describe("IdentitySecurity", () => {
    it("should verify RBAC roles and token algorithms", () => {
      const report = IdentitySecurity.evaluate();
      expect(report.rbacConfigured).toBe(true);
      expect(report.roles.length).toBe(5);
      expect(report.authProvider).toContain("Firebase");
      expect(report.tokenAlgorithm).toContain("RS256");
      expect(report.identitySecurityScore).toBe(100);
    });
  });

  describe("SupplyChainSecurity", () => {
    it("should verify package-lock integrity and blacklisted license audit", () => {
      const report = SupplyChainSecurity.evaluate();
      expect(report.lockfileVerified).toBe(true);
      expect(report.zeroBlacklistedLicenses).toBe(true);
      expect(report.zeroCriticalVulnerabilities).toBe(true);
      expect(report.supplyChainScore).toBeGreaterThanOrEqual(75);
    });
  });

  describe("ArtifactSigner", () => {
    it("should compute SHA-256 hashes and prepare Sigstore OIDC metadata", () => {
      const signing = ArtifactSigner.generateSigningMetadata("1.0.0");
      expect(signing.checksumsValid).toBe(true);
      expect(signing.checksums.length).toBeGreaterThan(0);
      expect(signing.sigstore.enabled).toBe(true);
      expect(signing.sigstore.provider).toContain("Cosign");
    });
  });

  describe("SecurityReporter", () => {
    it("should generate comprehensive markdown and JSON reports", () => {
      const bundle = SecurityEngine.evaluate();
      const md = SecurityReporter.generateMarkdownReport(bundle);
      const json = SecurityReporter.generateJsonReport(bundle);

      expect(md).toContain("DORK ENTERPRISE SECURITY HARDENING PLATFORM");
      expect(md).toContain("Overall Security Score");
      expect(md).toContain("CERTIFIED FOR PRODUCTION");

      expect(json.version).toBe("1.0.0");
      expect(json.certified).toBe(true);
      expect(json.scores.overallSecurity).toBeGreaterThanOrEqual(90);
    });
  });

  describe("SecurityEngine", () => {
    it("should execute complete security assessment and publish events", async () => {
      let eventPublished = false;
      EnterpriseEventBus.subscribe("SecurityEngineTest", "ComplianceCheckCompleted", (evt) => {
        if (evt.payload.engine === "SecurityEngine") {
          eventPublished = true;
        }
      });

      const bundle = SecurityEngine.evaluate();
      expect(bundle.overallSecurityScore).toBeGreaterThanOrEqual(90);
      expect(bundle.overallComplianceScore).toBeGreaterThanOrEqual(90);
      expect(bundle.threatModel.totalThreats).toBeGreaterThanOrEqual(10);
      expect(bundle.container.isCloudRunCompliant).toBe(true);

      // Wait 10ms for event dispatch loop
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(eventPublished).toBe(true);
    });
  });

});
