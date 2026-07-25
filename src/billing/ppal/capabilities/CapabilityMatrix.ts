import { ProviderCapabilities } from "./ProviderCapabilities";
import { PaymentProviderId } from "../types/PaymentProviderId";
import { PPALPaymentMethodType } from "../types/PPALCommonTypes";

export interface CapabilityRequirements {
  currency?: string;
  paymentMethodType?: PPALPaymentMethodType;
  requires3DSecure?: boolean;
  requiresRecurring?: boolean;
  requiresPartialRefund?: boolean;
}

export class CapabilityMatrix {
  private readonly _matrix: Map<PaymentProviderId, ProviderCapabilities> = new Map();

  public registerCapabilities(providerId: PaymentProviderId, capabilities: ProviderCapabilities): void {
    this._matrix.set(providerId.toLowerCase(), capabilities);
  }

  public getCapabilities(providerId: PaymentProviderId): ProviderCapabilities | undefined {
    return this._matrix.get(providerId.toLowerCase());
  }

  public isCapable(providerId: PaymentProviderId, requirements: CapabilityRequirements): boolean {
    const capabilities = this.getCapabilities(providerId);
    if (!capabilities) return false;

    if (requirements.currency && !capabilities.supportsCurrency(requirements.currency)) {
      return false;
    }
    if (requirements.paymentMethodType && !capabilities.supportsPaymentMethodType(requirements.paymentMethodType)) {
      return false;
    }
    if (requirements.requires3DSecure && !capabilities.supports3DSecure) {
      return false;
    }
    if (requirements.requiresRecurring && !capabilities.supportsRecurring) {
      return false;
    }
    if (requirements.requiresPartialRefund && !capabilities.supportsPartialRefunds) {
      return false;
    }

    return true;
  }

  public findCapableProviders(requirements: CapabilityRequirements): PaymentProviderId[] {
    const capable: PaymentProviderId[] = [];
    for (const [providerId] of this._matrix) {
      if (this.isCapable(providerId, requirements)) {
        capable.push(providerId);
      }
    }
    return capable;
  }
}
