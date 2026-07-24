import { WebhookDefinitionData } from "./WebhookDefinition";
import { WebhookContextData } from "./WebhookContext";

export interface WebhookPolicyConfig {
  readonly enforceHttpsInProduction: boolean;
  readonly requireSecretInProduction: boolean;
  readonly minSecretLength: number;
  readonly maxRateLimitPerMinute: number;
  readonly maxTimeoutMs: number;
  readonly minTimeoutMs: number;
  readonly maxRetryCount: number;
  readonly forbiddenDomainsOrIps: readonly string[];
  readonly allowedDomainsWhitelist?: readonly string[];
  readonly requireCircuitBreakerInProduction: boolean;
  readonly requireCorrelationId: boolean;
  readonly maxEndpointsPerTenant: number;
}

export interface WebhookPolicyRuleResult {
  readonly ruleId: string;
  readonly name: string;
  readonly passed: boolean;
  readonly severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  readonly message: string;
}

export interface WebhookPolicyEvaluationResult {
  readonly compliant: boolean;
  readonly environment: "production" | "staging" | "development";
  readonly score: number; // 0-100
  readonly rulesEvaluated: number;
  readonly violationsCount: number;
  readonly results: readonly WebhookPolicyRuleResult[];
  readonly timestamp: string;
}

export const DEFAULT_WEBHOOK_POLICY_CONFIG: WebhookPolicyConfig = Object.freeze({
  enforceHttpsInProduction: true,
  requireSecretInProduction: true,
  minSecretLength: 16,
  maxRateLimitPerMinute: 600,
  maxTimeoutMs: 30000,
  minTimeoutMs: 500,
  maxRetryCount: 5,
  forbiddenDomainsOrIps: Object.freeze([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254", // Cloud metadata service IP
    "::1",
  ]),
  requireCircuitBreakerInProduction: true,
  requireCorrelationId: true,
  maxEndpointsPerTenant: 50,
});

export class WebhookPolicy {
  /**
   * Pure, read-only evaluation of a Webhook Definition against enterprise compliance policies and platform context.
   */
  public static evaluate(
    definition: WebhookDefinitionData,
    context: WebhookContextData,
    customConfig?: Partial<WebhookPolicyConfig>
  ): WebhookPolicyEvaluationResult {
    const config: WebhookPolicyConfig = Object.freeze({
      ...DEFAULT_WEBHOOK_POLICY_CONFIG,
      ...customConfig,
    });

    const results: WebhookPolicyRuleResult[] = [];
    const env = context.environment;

    // Rule 1: HTTPS Requirement
    if (env === "production" && config.enforceHttpsInProduction) {
      const isHttps = definition.url.toLowerCase().startsWith("https://");
      results.push(
        Object.freeze({
          ruleId: "WH-POL-001",
          name: "Enforce HTTPS in Production",
          passed: isHttps,
          severity: "CRITICAL",
          message: isHttps
            ? "Destination URL uses secure HTTPS encryption."
            : "Production webhooks MUST use HTTPS protocol.",
        })
      );
    } else {
      results.push(
        Object.freeze({
          ruleId: "WH-POL-001",
          name: "Enforce HTTPS Protocol",
          passed: true,
          severity: "INFO",
          message: `HTTPS enforcement skipped or verified for environment '${env}'.`,
        })
      );
    }

    // Rule 2: Forbidden Domains / Internal Loopback Security
    let hostname = "";
    try {
      hostname = new URL(definition.url).hostname.toLowerCase();
    } catch {
      hostname = "";
    }

    const isForbiddenDomain =
      env === "production" &&
      config.forbiddenDomainsOrIps.some(
        (forbidden) => hostname === forbidden || hostname.endsWith(`.${forbidden}`)
      );

    results.push(
      Object.freeze({
        ruleId: "WH-POL-002",
        name: "Forbidden Domain / Loopback IP Check",
        passed: !isForbiddenDomain,
        severity: "CRITICAL",
        message: !isForbiddenDomain
          ? `Destination hostname '${hostname}' complies with domain security policy.`
          : `Destination hostname '${hostname}' resolves to a forbidden internal or loopback address.`,
      })
    );

    // Rule 3: Whitelisted Domains Check (if whitelist configured)
    if (config.allowedDomainsWhitelist && config.allowedDomainsWhitelist.length > 0) {
      const isWhitelisted = config.allowedDomainsWhitelist.some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
      );
      results.push(
        Object.freeze({
          ruleId: "WH-POL-003",
          name: "Allowed Domains Whitelist",
          passed: isWhitelisted,
          severity: "HIGH",
          message: isWhitelisted
            ? `Hostname '${hostname}' is on the allowed domain whitelist.`
            : `Hostname '${hostname}' is not present in the enterprise domain whitelist.`,
        })
      );
    }

    // Rule 4: Secret Requirements in Production / HMAC
    const requiresSecret =
      (env === "production" && config.requireSecretInProduction) ||
      definition.auth.type === "HMAC_SHA256";

    const secretProvided = !!definition.secret && definition.secret.trim().length >= config.minSecretLength;

    results.push(
      Object.freeze({
        ruleId: "WH-POL-004",
        name: "Webhook Secret & Signature Policy",
        passed: !requiresSecret || secretProvided,
        severity: "HIGH",
        message: !requiresSecret
          ? "Secret validation satisfied."
          : secretProvided
          ? `Webhook secret provided and meets minimum length of ${config.minSecretLength} characters.`
          : `Production or HMAC webhooks require a secret with at least ${config.minSecretLength} characters.`,
      })
    );

    // Rule 5: Rate Limits Policy
    const rateLimitValid = definition.rateLimit.maxRequestsPerMinute <= config.maxRateLimitPerMinute;
    results.push(
      Object.freeze({
        ruleId: "WH-POL-005",
        name: "Rate Limit Threshold Ceiling",
        passed: rateLimitValid,
        severity: "MEDIUM",
        message: rateLimitValid
          ? `Configured rate limit (${definition.rateLimit.maxRequestsPerMinute}/min) is within policy ceiling (${config.maxRateLimitPerMinute}/min).`
          : `Configured rate limit (${definition.rateLimit.maxRequestsPerMinute}/min) exceeds enterprise ceiling (${config.maxRateLimitPerMinute}/min).`,
      })
    );

    // Rule 6: Timeout Policy
    const timeoutValid =
      definition.timeoutMs >= config.minTimeoutMs && definition.timeoutMs <= config.maxTimeoutMs;
    results.push(
      Object.freeze({
        ruleId: "WH-POL-006",
        name: "HTTP Timeout Bounds",
        passed: timeoutValid,
        severity: "MEDIUM",
        message: timeoutValid
          ? `Timeout (${definition.timeoutMs}ms) is within permissible bounds [${config.minTimeoutMs}ms - ${config.maxTimeoutMs}ms].`
          : `Timeout (${definition.timeoutMs}ms) violates allowed range [${config.minTimeoutMs}ms - ${config.maxTimeoutMs}ms].`,
      })
    );

    // Rule 7: Retry Limits Policy
    const retryValid = definition.retryPolicy.maxRetries <= config.maxRetryCount;
    results.push(
      Object.freeze({
        ruleId: "WH-POL-007",
        name: "Retry Policy Ceiling",
        passed: retryValid,
        severity: "LOW",
        message: retryValid
          ? `Max retries (${definition.retryPolicy.maxRetries}) within limit (${config.maxRetryCount}).`
          : `Max retries (${definition.retryPolicy.maxRetries}) exceeds allowed maximum (${config.maxRetryCount}).`,
      })
    );

    // Rule 8: Circuit Breaker Requirement
    if (env === "production" && config.requireCircuitBreakerInProduction) {
      const cbEnabled = definition.circuitBreaker.enabled;
      results.push(
        Object.freeze({
          ruleId: "WH-POL-008",
          name: "Production Circuit Breaker Protection",
          passed: cbEnabled,
          severity: "HIGH",
          message: cbEnabled
            ? "Circuit breaker fault protection is active."
            : "Production webhooks MUST have circuit breaker protection enabled.",
        })
      );
    }

    // Rule 9: Correlation ID Verification
    if (config.requireCorrelationId) {
      const hasCorrId = !!definition.correlationId && definition.correlationId.trim() !== "";
      results.push(
        Object.freeze({
          ruleId: "WH-POL-009",
          name: "Correlation ID Requirement",
          passed: hasCorrId,
          severity: "MEDIUM",
          message: hasCorrId
            ? "Valid correlation ID present."
            : "Correlation ID is required for distributed tracing compliance.",
        })
      );
    }

    // Rule 10: Status Restriction (DEPRECATED endpoints forbidden in prod)
    if (env === "production") {
      const isNotDeprecated = definition.status !== "DEPRECATED";
      results.push(
        Object.freeze({
          ruleId: "WH-POL-010",
          name: "Deprecated Webhook Endpoint Guard",
          passed: isNotDeprecated,
          severity: "HIGH",
          message: isNotDeprecated
            ? "Webhook status is active or valid."
            : "DEPRECATED webhooks cannot be registered in production.",
        })
      );
    }

    // Calculations
    const violations = results.filter((r) => !r.passed);
    const criticalViolations = violations.filter((r) => r.severity === "CRITICAL");
    const passedCount = results.filter((r) => r.passed).length;
    const score = Math.round((passedCount / results.length) * 100);

    const compliant = criticalViolations.length === 0 && violations.length === 0;

    return Object.freeze({
      compliant,
      environment: env,
      score,
      rulesEvaluated: results.length,
      violationsCount: violations.length,
      results: Object.freeze(results),
      timestamp: new Date().toISOString(),
    });
  }
}
