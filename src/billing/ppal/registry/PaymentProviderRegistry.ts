import { IPaymentProviderRegistry } from "./IPaymentProviderRegistry";
import { IPaymentGatewayAdapter } from "../contracts/IPaymentGatewayAdapter";
import { PaymentProviderId } from "../types/PaymentProviderId";
import { CapabilityMatrix } from "../capabilities/CapabilityMatrix";
import { PaymentProviderNotFoundException } from "../exceptions/PPALExceptions";

export class PaymentProviderRegistry implements IPaymentProviderRegistry {
  private readonly _adapters: Map<string, IPaymentGatewayAdapter> = new Map();
  private readonly _capabilityMatrix: CapabilityMatrix = new CapabilityMatrix();

  public registerAdapter(adapter: IPaymentGatewayAdapter): void {
    const providerKey = adapter.config.providerId.toLowerCase();
    this._adapters.set(providerKey, adapter);
    this._capabilityMatrix.registerCapabilities(providerKey, adapter.getCapabilities());
  }

  public getAdapter(providerId: PaymentProviderId): IPaymentGatewayAdapter {
    const adapter = this._adapters.get(providerId.toLowerCase());
    if (!adapter) {
      throw new PaymentProviderNotFoundException(providerId);
    }
    return adapter;
  }

  public hasAdapter(providerId: PaymentProviderId): boolean {
    return this._adapters.has(providerId.toLowerCase());
  }

  public getRegisteredProviderIds(): PaymentProviderId[] {
    return Array.from(this._adapters.keys());
  }

  public getCapabilityMatrix(): CapabilityMatrix {
    return this._capabilityMatrix;
  }
}
