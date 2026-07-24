import { SecurityContext, SecurityContextConfig } from "./SecurityContext";
import { ThreatCatalog } from "./ThreatCatalog";
import { ThreatModelReport } from "./ThreatModel";
import { AttackSurfaceAnalyzer, AttackSurfaceReport } from "./AttackSurfaceAnalyzer";
import { SecurityPolicy } from "./SecurityPolicy";
import { SecurityValidator, SecurityValidatorReport } from "./SecurityValidator";
import { RuntimeSecurityEvaluator, RuntimeSecurityReport } from "./RuntimeSecurityEvaluator";
import { ContainerSecurity, ContainerSecurityReport } from "./ContainerSecurity";
import { IdentitySecurity, IdentitySecurityReport } from "./IdentitySecurity";
import { SupplyChainSecurity, SupplyChainReport } from "./SupplyChainSecurity";
import { ArtifactSigner, SigningReport } from "./ArtifactSigner";
import { SecurityReporter, SecurityEvaluationBundle } from "./SecurityReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class SecurityEngine {
  /**
   * Executes a complete, multi-dimensional, read-only security assessment of the platform.
   */
  public static evaluate(config?: SecurityContextConfig): SecurityEvaluationBundle {
    const context = SecurityContext.create(config);

    // 1. Threat Model Evaluation
    const threatModel: ThreatModelReport = ThreatCatalog.evaluateModel(context.correlationId);

    // 2. Attack Surface Analysis
    const attackSurface: AttackSurfaceReport = AttackSurfaceAnalyzer.analyze();

    // 3. Security Policy Evaluation
    const policyEvaluation = SecurityPolicy.evaluatePolicySuite(context);

    // 4. Static Code & Secret Scanning Validation
    const validator: SecurityValidatorReport = SecurityValidator.validate(context);

    // 5. Runtime Security & Tenant Isolation
    const runtime: RuntimeSecurityReport = RuntimeSecurityEvaluator.evaluate(context);

    // 6. Container Security
    const container: ContainerSecurityReport = ContainerSecurity.evaluate();

    // 7. Identity Security
    const identity: IdentitySecurityReport = IdentitySecurity.evaluate();

    // 8. Supply Chain Security
    const supplyChain: SupplyChainReport = SupplyChainSecurity.evaluate();

    // 9. Artifact Signer
    const signing: SigningReport = ArtifactSigner.generateSigningMetadata();

    // Aggregate Scores
    const scores = [
      threatModel.overallThreatScore,
      attackSurface.attackSurfaceScore,
      policyEvaluation.complianceScore,
      validator.staticSecurityScore,
      runtime.overallRuntimeScore,
      container.containerSecurityScore,
      identity.identitySecurityScore,
      supplyChain.supplyChainScore,
    ];

    const overallSecurityScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const overallComplianceScore = Math.round((policyEvaluation.complianceScore + validator.staticSecurityScore) / 2);

    const bundle: SecurityEvaluationBundle = Object.freeze({
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
      environment: context.environment,
      overallSecurityScore,
      overallComplianceScore,
      threatModel,
      attackSurface,
      validator,
      runtime,
      container,
      identity,
      supplyChain,
      signing,
    });

    // Publish security audit event to Enterprise Event Bus
    try {
      EnterpriseEventBus.publish(
        "ComplianceCheckCompleted",
        {
          engine: "SecurityEngine",
          overallSecurityScore,
          overallComplianceScore,
          threatsMitigatedRatio: `${threatModel.mitigatedCount}/${threatModel.totalThreats}`,
          secretScanningPassed: validator.secretScanningPassed,
          cloudRunStateless: container.filesystemStateless,
        },
        context.correlationId
      );
    } catch (err) {
      // Event bus publish non-blocking
    }

    return bundle;
  }
}
