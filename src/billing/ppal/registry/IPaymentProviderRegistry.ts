import { IPaymentGatewayAdapter } from "../contracts/IPaymentGatewayAdapter";
import { PaymentProviderId } from "../types/PaymentProviderId";
import { CapabilityMatrix } from "../capabilities/CapabilityMatrix";

export interface IPaymentProviderRegistry {
  registerAdapter(adapter: IPaymentGatewayAdapter): void;
  getAdapter(providerId: PaymentProviderId): IPaymentGatewayAdapter;
  hasAdapter(providerId: PaymentProviderId): boolean;
  getRegisteredProviderIds(): PaymentProviderId[];
  getCapabilityMatrix(): CapabilityMatrix;
}
