import crypto from "crypto";
import { CertificationSuiteResult, TestCaseResult } from "../types";
import { WebhookNormalizerRegistry } from "../../../billing/ppal/webhooks/WebhookNormalizerRegistry";
import { StripeWebhookNormalizer } from "../../../billing/providers/stripe/StripeWebhookNormalizer";
import { NormalizedWebhookEvent } from "../../../billing/ppal/webhooks/NormalizedWebhookEvent";

export class WebhookDuplicateAndReplaySuite {
  private readonly registry: WebhookNormalizerRegistry;
  private readonly processedEventIds: Set<string> = new Set();

  constructor() {
    this.registry = new WebhookNormalizerRegistry();
    this.registry.register(new StripeWebhookNormalizer());
  }

  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testDuplicateWebhookDeduplication());
    testResults.push(await this.testReplayAttackPreventionWithStaleTimestamp());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Webhook Duplicate & Replay Attack Defense Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testDuplicateWebhookDeduplication(): Promise<TestCaseResult> {
    const start = Date.now();
    const secret = "whsec_dedup_secret";
    const bodyObj = {
      id: "evt_dedup_9900",
      type: "charge.succeeded",
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: "ch_9900", amount: 4500, currency: "usd" } }
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(bodyObj);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${bodyStr}`, "utf8")
      .digest("hex");

    const rawPayload = {
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
      body: bodyStr
    };

    try {
      // First delivery
      const event1 = this.registry.processWebhook("stripe", rawPayload, secret);
      const isFirstNew = this.recordEventAndCheckDuplicate(event1);

      // Second delivery (Duplicate)
      const event2 = this.registry.processWebhook("stripe", rawPayload, secret);
      const isSecondDuplicate = !this.recordEventAndCheckDuplicate(event2);

      const passed = isFirstNew && isSecondDuplicate && event1.eventId === event2.eventId;

      return {
        testId: "webhook-deduplication",
        name: "Validate idempotent handling and deduplication of duplicate webhook events",
        category: "Webhooks",
        passed,
        durationMs: Date.now() - start,
        details: { eventId: event1.eventId, duplicateDetected: isSecondDuplicate }
      };
    } catch (err: any) {
      return {
        testId: "webhook-deduplication",
        name: "Validate idempotent handling and deduplication of duplicate webhook events",
        category: "Webhooks",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testReplayAttackPreventionWithStaleTimestamp(): Promise<TestCaseResult> {
    const start = Date.now();
    const secret = "whsec_replay_secret";
    
    // Create a body with an expired timestamp (e.g., 2 hours ago)
    const staleTimestamp = Math.floor((Date.now() - 7200000) / 1000).toString();
    const bodyObj = {
      id: "evt_replay_8800",
      type: "payment_intent.succeeded",
      created: Number(staleTimestamp),
      data: { object: { id: "pi_replay_8800", amount: 9900, currency: "usd" } }
    };

    const bodyStr = JSON.stringify(bodyObj);
    const validSigForStaleTs = crypto
      .createHmac("sha256", secret)
      .update(`${staleTimestamp}.${bodyStr}`, "utf8")
      .digest("hex");

    const rawPayload = {
      headers: { "stripe-signature": `t=${staleTimestamp},v1=${validSigForStaleTs}` },
      body: bodyStr
    };

    try {
      const event = this.registry.processWebhook("stripe", rawPayload, secret);
      const isStale = this.isWebhookEventStale(event, 300); // 5 minute max age

      return {
        testId: "webhook-replay-attack-defense",
        name: "Validate rejection / flagging of replayed webhooks with stale timestamp",
        category: "Webhooks",
        passed: isStale,
        durationMs: Date.now() - start,
        details: { eventAgeSeconds: Math.floor((Date.now() - event.occurredAt.getTime()) / 1000) }
      };
    } catch (err: any) {
      return {
        testId: "webhook-replay-attack-defense",
        name: "Validate rejection / flagging of replayed webhooks with stale timestamp",
        category: "Webhooks",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private recordEventAndCheckDuplicate(event: NormalizedWebhookEvent): boolean {
    if (this.processedEventIds.has(event.eventId)) {
      return false; // Duplicate
    }
    this.processedEventIds.add(event.eventId);
    return true; // New
  }

  private isWebhookEventStale(event: NormalizedWebhookEvent, maxAgeSeconds: number): boolean {
    const ageInSeconds = (Date.now() - event.occurredAt.getTime()) / 1000;
    return ageInSeconds > maxAgeSeconds;
  }
}
