export interface ApprovalStage {
  readonly sequence: number;
  readonly name: string;
  readonly requiredRole: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "SECURITY_AUDITOR";
  readonly status: "APPROVED" | "PENDING" | "SKIPPED";
  readonly approvedBy?: string;
  readonly approvedAt?: string;
}

export interface ApprovalWorkflowPayload {
  readonly workflowId: string;
  readonly status: "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "AUTO_APPROVED";
  readonly currentStageIndex: number;
  readonly stages: readonly ApprovalStage[];
  readonly lastUpdated: string;
}

export class ApprovalWorkflow {
  /**
   * Generates a deterministic approval workflow based on the evaluated governance decision,
   * risk score, and target environment.
   */
  public static generateWorkflow(
    riskScore: number,
    environment: string,
    requiredApprovals: readonly string[]
  ): ApprovalWorkflowPayload {
    const stages: ApprovalStage[] = [];
    const workflowId = `apw-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Stage 1: Peer SRE Review
    stages.push({
      sequence: 1,
      name: "SRE Peer Review",
      requiredRole: "SRE_OPERATOR",
      status: environment === "production" || riskScore > 50 ? "PENDING" : "SKIPPED",
    });

    // Stage 2: SRE Lead Approval
    const needsLead = requiredApprovals.includes("SRE_LEAD") || environment === "production" || riskScore > 70;
    stages.push({
      sequence: 2,
      name: "SRE Lead Sign-off",
      requiredRole: "SRE_LEAD",
      status: needsLead ? "PENDING" : "SKIPPED",
    });

    // Stage 3: Security & Compliance Sign-off
    const needsSecurity = requiredApprovals.includes("SECURITY_AUDITOR") || riskScore > 85;
    stages.push({
      sequence: 3,
      name: "Security & Compliance Review",
      requiredRole: "SECURITY_AUDITOR",
      status: needsSecurity ? "PENDING" : "SKIPPED",
    });

    // Determine overall workflow status
    const activeStages = stages.filter((s) => s.status === "PENDING");
    const status = activeStages.length > 0 ? "PENDING_APPROVAL" : "AUTO_APPROVED";

    return {
      workflowId,
      status,
      currentStageIndex: stages.findIndex((s) => s.status === "PENDING"),
      stages,
      lastUpdated: timestamp,
    };
  }
}
