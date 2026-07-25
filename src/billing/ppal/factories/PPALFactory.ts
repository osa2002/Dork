import { PaymentProviderRegistry } from "../registry/PaymentProviderRegistry";
import { SmartPaymentRouter } from "../router/SmartPaymentRouter";
import { CircuitBreaker } from "../circuit-breaker/CircuitBreaker";
import { RetryStrategy } from "../retry/RetryStrategy";
import { PPALOrchestratorService } from "../services/PPALOrchestratorService";
import { WebhookNormalizerRegistry } from "../webhooks/WebhookNormalizerRegistry";
import { MockPaymentGatewayAdapter } from "../adapters/MockPaymentGatewayAdapter";

export class PPALFactory {
  public static createDefaultOrchestrator(): {
    orchestrator: PPALOrchestratorService;
    registry: PaymentProviderRegistry;
    webhookRegistry: WebhookNormalizerRegistry;
  } {
    const registry = new PaymentProviderRegistry();
    const webhookRegistry = new WebhookNormalizerRegistry();
    const circuitBreakers = new Map<string, CircuitBreaker>();

    const mockAdapter = new MockPaymentGatewayAdapter();
    registry.registerAdapter(mockAdapter);

    const mockBreaker = new CircuitBreaker(mockAdapter.config.providerId);
    circuitBreakers.set(mockAdapter.config.providerId.toLowerCase(), mockBreaker);

    const router = new SmartPaymentRouter(registry, circuitBreakers);
    const retryStrategy = new RetryStrategy({ maxAttempts: 3, initialDelayMs: 100 });

    const orchestrator = new PPALOrchestratorService(
      registry,
      router,
      retryStrategy,
      circuitBreakers
    );

    return { orchestrator, registry, webhookRegistry };
  }
}
