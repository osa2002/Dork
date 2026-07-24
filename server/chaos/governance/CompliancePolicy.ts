export type ComplianceStandard = "SOC2" | "ISO27001" | "PCI_DSS" | "HIPAA";

export interface CompliancePolicyConfig {
  readonly id: string;
  readonly standard: ComplianceStandard;
  readonly requiresAuditTrail: boolean; // Must have initiator & correlationId
  readonly requiresIndependentApprovalForRisk: "HIGH" | "CRITICAL" | "NONE";
  readonly restrictToEncryptedZonesOnly: boolean;
  readonly forbidProductionDataMutation: boolean; // Zero real production data manipulation
  readonly requiredMinimumRole: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
  readonly maxSimultaneousInjects: number; // Prevent multi-vector risk
}

export class CompliancePolicy {
  /**
   * SOC2 Compliance Policy for chaos and SRE automation.
   */
  public static getSOC2Policy(): CompliancePolicyConfig {
    return {
      id: "comp-soc2",
      standard: "SOC2",
      requiresAuditTrail: true,
      requiresIndependentApprovalForRisk: "HIGH", // Requires independent signoff for high/critical risks
      restrictToEncryptedZonesOnly: true,
      forbidProductionDataMutation: true,
      requiredMinimumRole: "SRE_OPERATOR",
      maxSimultaneousInjects: 2,
    };
  }

  /**
   * PCI-DSS Compliance Policy for payment-affecting systems.
   */
  public static getPCIDSSPolicy(): CompliancePolicyConfig {
    return {
      id: "comp-pci-dss",
      standard: "PCI_DSS",
      requiresAuditTrail: true,
      requiresIndependentApprovalForRisk: "HIGH",
      restrictToEncryptedZonesOnly: true,
      forbidProductionDataMutation: true,
      requiredMinimumRole: "SRE_LEAD", // Strict: Lead only
      maxSimultaneousInjects: 1, // Max 1 active injection to prevent systemic failures
    };
  }

  /**
   * ISO27001 Information Security Policy.
   */
  public static getISO27001Policy(): CompliancePolicyConfig {
    return {
      id: "comp-iso27001",
      standard: "ISO27001",
      requiresAuditTrail: true,
      requiresIndependentApprovalForRisk: "CRITICAL",
      restrictToEncryptedZonesOnly: false,
      forbidProductionDataMutation: true,
      requiredMinimumRole: "SRE_OPERATOR",
      maxSimultaneousInjects: 3,
    };
  }
}
