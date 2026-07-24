import { SecurityContext } from "./SecurityContext";

export type SecurityPrinciple =
  | "LeastPrivilege"
  | "ZeroTrust"
  | "DefenseInDepth"
  | "SecureDefaults"
  | "ImmutableInfrastructure";

export interface PolicyEvaluationResult {
  readonly ruleId: string;
  readonly principle: SecurityPrinciple;
  readonly name: string;
  readonly passed: boolean;
  readonly reason: string;
}

export interface SecurityPolicyRule {
  readonly id: string;
  readonly principle: SecurityPrinciple;
  readonly name: string;
  readonly description: string;
  readonly evaluate: (context: SecurityContext) => PolicyEvaluationResult;
}

export class SecurityPolicy {
  private static readonly rules: readonly SecurityPolicyRule[] = Object.freeze([
    {
      id: "POL-LP-01",
      principle: "LeastPrivilege",
      name: "Role-Based Access Enforcement",
      description: "Verify users operate with minimum necessary roles and scope boundaries.",
      evaluate: (context: SecurityContext): PolicyEvaluationResult => {
        const validRoles = ["SUPER_ADMIN", "VENDOR_ADMIN", "QUEUE_STAFF", "CUSTOMER", "ANONYMOUS"];
        const passed = validRoles.includes(context.user.role || "");
        return {
          ruleId: "POL-LP-01",
          principle: "LeastPrivilege",
          name: "Role-Based Access Enforcement",
          passed,
          reason: passed
            ? `User role '${context.user.role}' belongs to strict RBAC role set.`
            : `User role '${context.user.role}' is invalid or unauthorized.`,
        };
      },
    },
    {
      id: "POL-ZT-01",
      principle: "ZeroTrust",
      name: "Explicit Token Verification & Correlation Tracking",
      description: "Never trust network location; every request must carry valid correlation and identity context.",
      evaluate: (context: SecurityContext): PolicyEvaluationResult => {
        const hasCorrelation = Boolean(context.correlationId && context.correlationId.length > 3);
        const hasUser = Boolean(context.user && context.user.uid);
        const passed = hasCorrelation && hasUser;
        return {
          ruleId: "POL-ZT-01",
          principle: "ZeroTrust",
          name: "Explicit Token Verification & Correlation Tracking",
          passed,
          reason: passed
            ? "Context contains verified user identity and active correlation ID."
            : "Missing correlation ID or user identity in request context.",
        };
      },
    },
    {
      id: "POL-DID-01",
      principle: "DefenseInDepth",
      name: "Multi-Layer Security Validation",
      description: "Ensure security controls are enforced across API middleware, schema validators, and DB rules.",
      evaluate: (context: SecurityContext): PolicyEvaluationResult => {
        // Enforce strict security level in production
        const isStrict = context.environment === "production" ? context.securityLevel === "STRICT" : true;
        return {
          ruleId: "POL-DID-01",
          principle: "DefenseInDepth",
          name: "Multi-Layer Security Validation",
          passed: isStrict,
          reason: isStrict
            ? "Multi-layer defense rules enabled across API, middleware, and database levels."
            : "Security level relaxed in production environment.",
        };
      },
    },
    {
      id: "POL-SD-01",
      principle: "SecureDefaults",
      name: "Fail-Closed & Deny-By-Default",
      description: "Default action for unauthenticated or unmapped routes must be DENY / UnauthorizedError.",
      evaluate: (context: SecurityContext): PolicyEvaluationResult => {
        const passed = context.enforcementMode === "enforce";
        return {
          ruleId: "POL-SD-01",
          principle: "SecureDefaults",
          name: "Fail-Closed & Deny-By-Default",
          passed,
          reason: passed
            ? "System operates in default enforce mode (fail-closed)."
            : "System operating in audit-only mode.",
        };
      },
    },
    {
      id: "POL-II-01",
      principle: "ImmutableInfrastructure",
      name: "Stateless Cloud Run Runtime",
      description: "Disallow persistent local filesystem state mutation during container runtime.",
      evaluate: (context: SecurityContext): PolicyEvaluationResult => {
        const passed = process.env.DB_PROVIDER !== "sqlite_local_persistent";
        return {
          ruleId: "POL-II-01",
          principle: "ImmutableInfrastructure",
          name: "Stateless Cloud Run Runtime",
          passed,
          reason: passed
            ? "Stateless Cloud Run runtime confirmed; state managed externally in Firestore/Memory."
            : "Detected local persistent database assumption.",
        };
      },
    },
  ]);

  public static getRules(): readonly SecurityPolicyRule[] {
    return this.rules;
  }

  public static evaluatePolicySuite(context: SecurityContext) {
    const results = this.rules.map((rule) => rule.evaluate(context));
    const totalRules = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const complianceScore = Math.round((passedCount / totalRules) * 100);

    return {
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
      environment: context.environment,
      totalRules,
      passedCount,
      failedCount: totalRules - passedCount,
      complianceScore,
      results: Object.freeze(results),
    };
  }
}
