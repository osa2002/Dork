export interface RetentionPolicy {
  auditLogsDays: number;
  metricsDays: number;
  businessEventsDays: number;
  incidentsDays: number;
  telemetryDays: number;
  archivedTicketsDays: number;
}

export class RetentionPolicyService {
  private static policy: RetentionPolicy = {
    auditLogsDays: 30,
    metricsDays: 14,
    businessEventsDays: 30,
    incidentsDays: 365,
    telemetryDays: 7,
    archivedTicketsDays: 180,
  };

  public static getPolicy(): RetentionPolicy {
    return { ...this.policy };
  }

  public static updatePolicy(newPolicy: Partial<RetentionPolicy>): RetentionPolicy {
    this.policy = { ...this.policy, ...newPolicy };
    return this.getPolicy();
  }

  /**
   * Helper to check if a timestamp is past its retention period.
   */
  public static isExpired(timestamp: string | Date, policyKey: keyof RetentionPolicy): boolean {
    const days = this.policy[policyKey];
    const msLimit = days * 24 * 60 * 60 * 1000;
    const time = new Date(timestamp).getTime();
    const now = Date.now();
    return now - time > msLimit;
  }
}
