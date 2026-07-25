import { IPaymentProviderRegistry } from "../registry/IPaymentProviderRegistry";
import { IPaymentRouter } from "../router/IPaymentRouter";
import { ICircuitBreaker } from "../contracts/ICircuitBreaker";
import { IRetryStrategy } from "../contracts/IRetryStrategy";
import {
  AuthorizePaymentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  CancelPaymentRequest,
  TransactionResult
} from "../types/PPALCommonTypes";
import { PaymentProviderId } from "../types/PaymentProviderId";

export class PPALOrchestratorService {
  private readonly _registry: IPaymentProviderRegistry;
  private readonly _router: IPaymentRouter;
  private readonly _circuitBreakers: Map<string, ICircuitBreaker>;
  private readonly _retryStrategy: IRetryStrategy;

  constructor(
    registry: IPaymentProviderRegistry,
    router: IPaymentRouter,
    retryStrategy: IRetryStrategy,
    circuitBreakers: Map<string, ICircuitBreaker> = new Map()
  ) {
    this._registry = registry;
    this._router = router;
    this._retryStrategy = retryStrategy;
    this._circuitBreakers = circuitBreakers;
  }

  public async processAuthorization(
    request: AuthorizePaymentRequest,
    preferredProviderId?: PaymentProviderId
  ): Promise<TransactionResult> {
    const selectedProviderId = this._router.routeForRequest(request, preferredProviderId);
    const adapter = this._registry.getAdapter(selectedProviderId);
    const circuitBreaker = this._circuitBreakers.get(selectedProviderId.toLowerCase());

    return this._retryStrategy.execute(async () => {
      if (circuitBreaker) {
        return await circuitBreaker.execute(() => adapter.authorize(request));
      }
      return await adapter.authorize(request);
    });
  }

  public async processCapture(
    request: CapturePaymentRequest,
    providerId: PaymentProviderId
  ): Promise<TransactionResult> {
    const adapter = this._registry.getAdapter(providerId);
    const circuitBreaker = this._circuitBreakers.get(providerId.toLowerCase());

    return this._retryStrategy.execute(async () => {
      if (circuitBreaker) {
        return await circuitBreaker.execute(() => adapter.capture(request));
      }
      return await adapter.capture(request);
    });
  }

  public async processRefund(
    request: RefundPaymentRequest,
    providerId: PaymentProviderId
  ): Promise<TransactionResult> {
    const adapter = this._registry.getAdapter(providerId);
    const circuitBreaker = this._circuitBreakers.get(providerId.toLowerCase());

    return this._retryStrategy.execute(async () => {
      if (circuitBreaker) {
        return await circuitBreaker.execute(() => adapter.refund(request));
      }
      return await adapter.refund(request);
    });
  }

  public async processCancel(
    request: CancelPaymentRequest,
    providerId: PaymentProviderId
  ): Promise<TransactionResult> {
    const adapter = this._registry.getAdapter(providerId);
    return await adapter.cancel(request);
  }
}
