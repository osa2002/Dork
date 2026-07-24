import crypto from "crypto";
import { WebhookDefinition, WebhookDefinitionData } from "./WebhookDefinition";
import { WebhookContext, WebhookContextData } from "./WebhookContext";
import { WebhookPolicy, WebhookPolicyConfig, WebhookPolicyEvaluationResult } from "./WebhookPolicy";
import { EnterpriseEventBus, OperationalEvent } from "../governance/EnterpriseEventBus";

export interface WebhookEvaluationReport {
  readonly timestamp: string;
  readonly definitionId: string;
  readonly url: string;
  readonly isValidDefinition: boolean;
  readonly validationErrors: readonly string[];
  readonly policyCompliance: WebhookPolicyEvaluationResult;
  readonly readyForDispatch: boolean;
  readonly samplePayload: Readonly<Record<string, unknown>>;
  readonly signaturePreview?: string;
  readonly contextSnapshot: WebhookContextData;
}

export class WebhookEngine {
  /**
   * Pure, stateless evaluation of a webhook definition against system context and policy rules.
   * Performs ZERO network requests, ZERO HTTP dispatch, ZERO retries, ZERO queues, and ZERO persistence.
   */
  public static evaluateWebhook(
    definition: WebhookDefinitionData,
    context?: WebhookContextData,
    policyConfig?: Partial<WebhookPolicyConfig>
  ): WebhookEvaluationReport {
    const timestamp = new Date().toISOString();
    const activeContext = context || WebhookContext.compile("production");

    // 1. Structural Validation
    const validation = WebhookDefinition.validate(definition);

    // 2. Policy Compliance Check
    const policyCompliance = WebhookPolicy.evaluate(definition, activeContext, policyConfig);

    // 3. Generate Sample Payload & HMAC Signature Preview
    const eventType = definition.events[0] || "ticket.created";
    const samplePayload = this.generateSamplePayload(eventType, activeContext);

    let signaturePreview: string | undefined;
    if (definition.secret && definition.secret.trim() !== "") {
      const payloadString = JSON.stringify(samplePayload);
      signaturePreview = this.calculateHmacSignature(payloadString, definition.secret);
    }

    // 4. Ready for Dispatch Determination
    const readyForDispatch =
      validation.valid && policyCompliance.compliant && definition.status === "ACTIVE";

    return Object.freeze({
      timestamp,
      definitionId: definition.id,
      url: definition.url,
      isValidDefinition: validation.valid,
      validationErrors: validation.errors,
      policyCompliance,
      readyForDispatch,
      samplePayload,
      signaturePreview,
      contextSnapshot: activeContext,
    });
  }

  /**
   * Validates a Webhook Definition structure.
   */
  public static validateDefinition(
    definition: WebhookDefinitionData
  ): { readonly valid: boolean; readonly errors: readonly string[] } {
    return WebhookDefinition.validate(definition);
  }

  /**
   * Compiles an immutable snapshot of the platform context for webhook evaluation.
   */
  public static inspectContext(
    environment: "production" | "staging" | "development" = "production",
    correlationId?: string
  ): WebhookContextData {
    return WebhookContext.compile(environment, correlationId);
  }

  /**
   * Evaluates enterprise policy compliance for a webhook definition.
   */
  public static checkPolicyCompliance(
    definition: WebhookDefinitionData,
    environment: "production" | "staging" | "development" = "production",
    policyConfig?: Partial<WebhookPolicyConfig>
  ): WebhookPolicyEvaluationResult {
    const context = WebhookContext.compile(environment);
    return WebhookPolicy.evaluate(definition, context, policyConfig);
  }

  /**
   * Generates a read-only, standardized enterprise webhook payload sample for an event type.
   */
  public static generateSamplePayload(
    eventType: string,
    context?: WebhookContextData
  ): Readonly<Record<string, unknown>> {
    const activeContext = context || WebhookContext.compile("production");
    const timestamp = new Date().toISOString();

    return Object.freeze({
      event: eventType,
      timestamp,
      correlationId: activeContext.correlationId,
      environment: activeContext.environment,
      kernelVersion: activeContext.platformKernel.kernelVersion,
      data: Object.freeze({
        healthStatus: activeContext.operationsState.controlPlane.healthStatus,
        activeRiskScore: activeContext.operationsState.predictions.activeRiskScore,
        errorBudgetRemaining: activeContext.governance.errorBudgetRemaining,
        securityLevel: activeContext.security.securityLevel,
        sampleTicket: Object.freeze({
          id: `tkt-${Math.random().toString(36).substring(2, 9)}`,
          number: "A-102",
          status: "CALLED",
          counter: "Counter 1",
          createdAt: timestamp,
        }),
      }),
    });
  }

  /**
   * Calculates HMAC SHA-256 signature for payload validation.
   */
  public static calculateHmacSignature(payloadString: string, secret: string): string {
    if (!secret || secret.trim() === "") return "";
    return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
  }

  /**
   * Read-only integration with EnterpriseEventBus for event observation.
   * Returns an unsubscribe cleanup function.
   */
  public static subscribeToEventBus(
    callback: (event: OperationalEvent) => void
  ): () => void {
    const subId = EnterpriseEventBus.subscribe(
      "EnterpriseWebhookEngineObserver",
      "*",
      async (event: OperationalEvent) => {
        try {
          callback(event);
        } catch (err) {
          console.warn("[WebhookEngineObserver] Observer callback error:", err);
        }
      }
    );

    return () => {
      EnterpriseEventBus.unsubscribe(subId);
    };
  }
}
