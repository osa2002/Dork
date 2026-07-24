export type HttpMethod = "POST" | "PUT" | "PATCH" | "GET" | "DELETE";

export type AuthType = "NONE" | "BEARER" | "BASIC" | "API_KEY" | "HMAC_SHA256";

export type DeliveryMode = "SYNC" | "ASYNC" | "BATCH" | "STREAM";

export type WebhookStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DEPRECATED";

export interface WebhookAuth {
  readonly type: AuthType;
  readonly bearerToken?: string;
  readonly username?: string;
  readonly password?: string;
  readonly apiKeyHeader?: string;
  readonly apiKeyValue?: string;
}

export interface WebhookHeader {
  readonly key: string;
  readonly value: string;
}

export interface WebhookRetryPolicy {
  readonly maxRetries: number;
  readonly backoffFactorMs: number;
  readonly maxBackoffMs: number;
}

export interface WebhookCircuitBreaker {
  readonly enabled: boolean;
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
}

export interface WebhookRateLimit {
  readonly maxRequestsPerMinute: number;
  readonly burstSize: number;
}

export interface WebhookDefinitionData {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly method: HttpMethod;
  readonly auth: WebhookAuth;
  readonly secret?: string;
  readonly version: string;
  readonly events: readonly string[];
  readonly headers: readonly WebhookHeader[];
  readonly retryPolicy: WebhookRetryPolicy;
  readonly timeoutMs: number;
  readonly circuitBreaker: WebhookCircuitBreaker;
  readonly rateLimit: WebhookRateLimit;
  readonly deliveryMode: DeliveryMode;
  readonly status: WebhookStatus;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class WebhookDefinition {
  public static create(
    params: Partial<WebhookDefinitionData> & { url: string; name: string }
  ): WebhookDefinitionData {
    const now = new Date().toISOString();
    
    const definition: WebhookDefinitionData = {
      id: params.id || `wh-def-${Math.random().toString(36).substring(2, 9)}`,
      name: params.name,
      url: params.url,
      method: params.method || "POST",
      auth: params.auth
        ? Object.freeze({ ...params.auth })
        : Object.freeze({ type: "NONE" }),
      secret: params.secret,
      version: params.version || "1.0.0",
      events: Object.freeze([...(params.events || ["ticket.created"])]),
      headers: Object.freeze(
        (params.headers || []).map((h) => Object.freeze({ key: h.key, value: h.value }))
      ),
      retryPolicy: Object.freeze({
        maxRetries: params.retryPolicy?.maxRetries ?? 3,
        backoffFactorMs: params.retryPolicy?.backoffFactorMs ?? 1000,
        maxBackoffMs: params.retryPolicy?.maxBackoffMs ?? 30000,
      }),
      timeoutMs: params.timeoutMs ?? 5000,
      circuitBreaker: Object.freeze({
        enabled: params.circuitBreaker?.enabled ?? true,
        failureThreshold: params.circuitBreaker?.failureThreshold ?? 5,
        resetTimeoutMs: params.circuitBreaker?.resetTimeoutMs ?? 60000,
      }),
      rateLimit: Object.freeze({
        maxRequestsPerMinute: params.rateLimit?.maxRequestsPerMinute ?? 120,
        burstSize: params.rateLimit?.burstSize ?? 20,
      }),
      deliveryMode: params.deliveryMode || "ASYNC",
      status: params.status || "ACTIVE",
      correlationId: params.correlationId || `corr-wh-${Math.random().toString(36).substring(2, 9)}`,
      metadata: params.metadata ? Object.freeze({ ...params.metadata }) : Object.freeze({}),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
    };

    return Object.freeze(definition);
  }

  public static validate(def: WebhookDefinitionData): { readonly valid: boolean; readonly errors: readonly string[] } {
    const errors: string[] = [];

    if (!def.id || def.id.trim() === "") errors.push("Webhook ID is required.");
    if (!def.name || def.name.trim() === "") errors.push("Webhook name is required.");
    if (!def.url || def.url.trim() === "") {
      errors.push("Destination URL is required.");
    } else {
      try {
        const parsed = new URL(def.url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.push("Destination URL must use http or https protocol.");
        }
      } catch {
        errors.push("Destination URL is not a valid URI format.");
      }
    }

    if (!def.events || def.events.length === 0) {
      errors.push("At least one event type trigger must be specified.");
    }

    if (def.timeoutMs < 100 || def.timeoutMs > 60000) {
      errors.push("Timeout must be between 100ms and 60,000ms.");
    }

    if (def.retryPolicy.maxRetries < 0 || def.retryPolicy.maxRetries > 10) {
      errors.push("Max retries must be between 0 and 10.");
    }

    if (def.rateLimit.maxRequestsPerMinute <= 0) {
      errors.push("Max requests per minute must be greater than zero.");
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    });
  }
}
