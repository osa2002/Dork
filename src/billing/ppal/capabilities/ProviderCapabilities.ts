import { PPALPaymentMethodType } from "../types/PPALCommonTypes";

export interface ProviderCapabilitiesProps {
  supports3DSecure: boolean;
  supportsRecurring: boolean;
  supportsPartialRefunds: boolean;
  supportsMultipleCurrencies: boolean;
  supportsWebhooks: boolean;
  supportsImmediateCapture: boolean;
  supportsManualCapture: boolean;
  supportedPaymentMethodTypes: ReadonlyArray<PPALPaymentMethodType>;
  supportedCurrencies: ReadonlyArray<string>;
}

export class ProviderCapabilities {
  public readonly supports3DSecure: boolean;
  public readonly supportsRecurring: boolean;
  public readonly supportsPartialRefunds: boolean;
  public readonly supportsMultipleCurrencies: boolean;
  public readonly supportsWebhooks: boolean;
  public readonly supportsImmediateCapture: boolean;
  public readonly supportsManualCapture: boolean;
  public readonly supportedPaymentMethodTypes: ReadonlyArray<PPALPaymentMethodType>;
  public readonly supportedCurrencies: ReadonlyArray<string>;

  constructor(props: ProviderCapabilitiesProps) {
    this.supports3DSecure = props.supports3DSecure;
    this.supportsRecurring = props.supportsRecurring;
    this.supportsPartialRefunds = props.supportsPartialRefunds;
    this.supportsMultipleCurrencies = props.supportsMultipleCurrencies;
    this.supportsWebhooks = props.supportsWebhooks;
    this.supportsImmediateCapture = props.supportsImmediateCapture;
    this.supportsManualCapture = props.supportsManualCapture;
    this.supportedPaymentMethodTypes = Object.freeze([...props.supportedPaymentMethodTypes]);
    this.supportedCurrencies = Object.freeze([...props.supportedCurrencies.map(c => c.toUpperCase())]);
  }

  public supportsCurrency(currencyCode: string): boolean {
    return this.supportedCurrencies.includes(currencyCode.toUpperCase());
  }

  public supportsPaymentMethodType(methodType: PPALPaymentMethodType): boolean {
    return this.supportedPaymentMethodTypes.includes(methodType);
  }
}
