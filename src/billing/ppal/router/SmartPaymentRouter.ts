import { IPaymentRouter, RoutingCriteria } from "./IPaymentRouter";
import { PaymentProviderId } from "../types/PaymentProviderId";
import { IPaymentProviderRegistry } from "../registry/IPaymentProviderRegistry";
import { ICircuitBreaker } from "../contracts/ICircuitBreaker";
import { AuthorizePaymentRequest } from "../types/PPALCommonTypes";
import { PaymentProviderNotFoundException, ProviderCapabilityMismatchException } from "../exceptions/PPALExceptions";

export class SmartPaymentRouter implements IPaymentRouter {
  private readonly _registry: IPaymentProviderRegistry;
  private readonly _circuitBreakers: Map<string, ICircuitBreaker>;

  constructor(
    registry: IPaymentProviderRegistry,
    circuitBreakers: Map<string, ICircuitBreaker> = new Map()
  ) {
    this._registry = registry;
    this._circuitBreakers = circuitBreakers;
  }

  public routeForRequest(
    request: AuthorizePaymentRequest,
    preferredProviderId?: PaymentProviderId
  ): PaymentProviderId {
    return this.route({
      preferredProviderId,
      currency: request.amount.currencyCode,
      paymentMethodType: request.paymentMethod.type,
      amountInCents: request.amount.amountInCents
    });
  }

  public route(criteria: RoutingCriteria): PaymentProviderId {
    const matrix = this._registry.getCapabilityMatrix();

    if (criteria.preferredProviderId && this._registry.hasAdapter(criteria.preferredProviderId)) {
      const preferred = criteria.preferredProviderId.toLowerCase();
      const isCapable = matrix.isCapable(preferred, {
        currency: criteria.currency,
        paymentMethodType: criteria.paymentMethodType as any,
        requires3DSecure: criteria.require3DSecure
      });

      const cb = this._circuitBreakers.get(preferred);
      const isHealthy = !cb || cb.state !== "OPEN";

      if (isCapable && isHealthy) {
        return preferred;
      }
    }

    const capableProviders = matrix.findCapableProviders({
      currency: criteria.currency,
      paymentMethodType: criteria.paymentMethodType as any,
      requires3DSecure: criteria.require3DSecure
    });

    const healthyCapable = capableProviders.filter(providerId => {
      const cb = this._circuitBreakers.get(providerId.toLowerCase());
      return !cb || cb.state !== "OPEN";
    });

    if (healthyCapable.length === 0) {
      if (capableProviders.length > 0) {
        throw new ProviderCapabilityMismatchException(
          capableProviders.join(", "),
          "All capable payment providers currently have open circuit breakers."
        );
      }
      throw new PaymentProviderNotFoundException(
        `No registered provider satisfies routing criteria for currency '${criteria.currency}' and method '${criteria.paymentMethodType}'.`
      );
    }

    return healthyCapable[0];
  }
}
