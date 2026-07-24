import { GovernancePolicy, SreGovernancePolicyConfig } from "./GovernancePolicy";
import { CompliancePolicy, CompliancePolicyConfig, ComplianceStandard } from "./CompliancePolicy";

export class PolicyCatalog {
  private static readonly governancePolicies = new Map<string, SreGovernancePolicyConfig>();
  private static readonly compliancePolicies = new Map<string, CompliancePolicyConfig>();

  static {
    // Populate with defaults
    const defGov = GovernancePolicy.getDefaultPolicy();
    const strictGov = GovernancePolicy.getUltraStrictPolicy();
    this.governancePolicies.set(defGov.id, defGov);
    this.governancePolicies.set(strictGov.id, strictGov);

    const soc2 = CompliancePolicy.getSOC2Policy();
    const pci = CompliancePolicy.getPCIDSSPolicy();
    const iso = CompliancePolicy.getISO27001Policy();
    this.compliancePolicies.set(soc2.id, soc2);
    this.compliancePolicies.set(pci.id, pci);
    this.compliancePolicies.set(iso.id, iso);
  }

  /**
   * Retrieves a governance policy by ID, defaulting to the SRE standard policy.
   */
  public static getGovernancePolicy(id: string): SreGovernancePolicyConfig {
    return this.governancePolicies.get(id) || GovernancePolicy.getDefaultPolicy();
  }

  /**
   * Retrieves a compliance policy by ID, defaulting to SOC2 compliance.
   */
  public static getCompliancePolicy(id: string): CompliancePolicyConfig {
    return this.compliancePolicies.get(id) || CompliancePolicy.getSOC2Policy();
  }

  /**
   * Retrieves a compliance policy by standard type.
   */
  public static getCompliancePolicyByStandard(standard: ComplianceStandard): CompliancePolicyConfig {
    for (const policy of this.compliancePolicies.values()) {
      if (policy.standard === standard) {
        return policy;
      }
    }
    return CompliancePolicy.getSOC2Policy();
  }

  /**
   * Gets list of all registered SRE Governance Policies.
   */
  public static getAllGovernancePolicies(): readonly SreGovernancePolicyConfig[] {
    return Array.from(this.governancePolicies.values());
  }

  /**
   * Gets list of all registered Regulatory Compliance Policies.
   */
  public static getAllCompliancePolicies(): readonly CompliancePolicyConfig[] {
    return Array.from(this.compliancePolicies.values());
  }
}
