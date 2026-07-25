import { AbacEffect, AbacPolicyRule, AttributeCondition, PermissionAction, PermissionResource } from "../value-objects/IamValueObjects";

export interface EvaluationSubject {
  userId: string;
  tenantId: string;
  department?: string;
  title?: string;
  riskScore?: number;
  assignedRoleIds: string[];
  [key: string]: any;
}

export interface EvaluationResource {
  resourceType: PermissionResource;
  resourceId?: string;
  amountCents?: number;
  currency?: string;
  department?: string;
  ownerUserId?: string;
  [key: string]: any;
}

export interface EvaluationEnvironment {
  ipAddress: string;
  deviceTrustLevel: "UNKNOWN" | "UNTRUSTED" | "COMPLIANT" | "MANAGED_ENTERPRISE";
  timestampIso: string;
  requestHourUtc: number;
}

export interface AbacEvaluationResult {
  allowed: boolean;
  decisionReason: string;
  evaluatedRuleIds: string[];
  matchedRuleId?: string;
}

export class AbacPolicyEngine {
  private rules: AbacPolicyRule[] = [];

  constructor() {
    this.seedDefaultAbacPolicies();
  }

  private seedDefaultAbacPolicies(): void {
    // 1. Deny High Value Refunds outside enterprise managed devices
    this.addRule({
      ruleId: "abac_deny_unmanaged_high_value_refund",
      name: "Enforce Managed Device for High Value Refunds",
      description: "Denies refund approval > $1,000 if device trust level is not COMPLIANT or MANAGED_ENTERPRISE.",
      effect: "DENY",
      resource: "REFUNDS",
      action: "APPROVE",
      priority: 100, // High priority DENY rule
      conditions: [
        { attributeKey: "resource.amountCents", operator: "GREATER_THAN", targetValue: 100000 },
        { attributeKey: "environment.deviceTrustLevel", operator: "IN_LIST", targetValue: ["UNKNOWN", "UNTRUSTED"] }
      ]
    });

    // 2. Deny Financial Operations outside allowed IP range or suspicious risk score
    this.addRule({
      ruleId: "abac_deny_high_user_risk_finance",
      name: "Deny Finance Actions for Compromised Accounts",
      description: "Denies billing and financial modifications if subject user risk score exceeds 80.",
      effect: "DENY",
      resource: "BILLING",
      action: "UPDATE",
      priority: 90,
      conditions: [
        { attributeKey: "subject.riskScore", operator: "GREATER_THAN", targetValue: 80 }
      ]
    });
  }

  public addRule(rule: AbacPolicyRule): void {
    this.rules.push(rule);
    // Sort rules by priority descending (higher priority evaluated first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  public evaluatePolicy(
    subject: EvaluationSubject,
    resource: EvaluationResource,
    action: PermissionAction,
    environment: EvaluationEnvironment
  ): AbacEvaluationResult {
    const context: Record<string, any> = {
      subject,
      resource,
      environment
    };

    const evaluatedRuleIds: string[] = [];

    for (const rule of this.rules) {
      if (rule.resource !== resource.resourceType && rule.resource !== "SYSTEM") continue;
      if (rule.action !== action && rule.action !== "ADMINISTER") continue;

      evaluatedRuleIds.push(rule.ruleId);

      const allConditionsMet = rule.conditions.every(cond => this.evaluateCondition(cond, context));

      if (allConditionsMet) {
        if (rule.effect === "DENY") {
          return {
            allowed: false,
            decisionReason: `Explicit ABAC DENY rule triggered: [${rule.ruleId}] ${rule.name}`,
            evaluatedRuleIds,
            matchedRuleId: rule.ruleId
          };
        } else if (rule.effect === "ALLOW") {
          return {
            allowed: true,
            decisionReason: `ABAC ALLOW rule triggered: [${rule.ruleId}] ${rule.name}`,
            evaluatedRuleIds,
            matchedRuleId: rule.ruleId
          };
        }
      }
    }

    // Default policy: if no explicit DENY rule was triggered
    return {
      allowed: true,
      decisionReason: "No matching ABAC DENY policies triggered. Permitted under standard RBAC evaluation.",
      evaluatedRuleIds
    };
  }

  private evaluateCondition(condition: AttributeCondition, context: Record<string, any>): boolean {
    const actualValue = this.resolveAttributePath(condition.attributeKey, context);
    if (actualValue === undefined || actualValue === null) return false;

    switch (condition.operator) {
      case "EQUALS":
        return actualValue === condition.targetValue;
      case "NOT_EQUALS":
        return actualValue !== condition.targetValue;
      case "GREATER_THAN":
        return typeof actualValue === "number" && actualValue > condition.targetValue;
      case "LESS_THAN":
        return typeof actualValue === "number" && actualValue < condition.targetValue;
      case "IN_LIST":
        return Array.isArray(condition.targetValue) && condition.targetValue.includes(actualValue);
      case "CONTAINS":
        return String(actualValue).includes(String(condition.targetValue));
      default:
        return false;
    }
  }

  private resolveAttributePath(path: string, obj: any): any {
    const parts = path.split(".");
    let curr = obj;
    for (const part of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[part];
    }
    return curr;
  }
}
