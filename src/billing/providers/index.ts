export * from "./stripe";
export * from "./paypal";
export * from "./adyen";
export * from "./checkout";
export * from "./iyzico";

import { IPaymentProviderRegistry } from "../ppal/registry/IPaymentProviderRegistry";
import { WebhookNormalizerRegistry } from "../ppal/webhooks/WebhookNormalizerRegistry";
import { StripePaymentGatewayAdapter } from "./stripe/StripePaymentGatewayAdapter";
import { StripeWebhookNormalizer } from "./stripe/StripeWebhookNormalizer";
import { PayPalPaymentGatewayAdapter } from "./paypal/PayPalPaymentGatewayAdapter";
import { PayPalWebhookNormalizer } from "./paypal/PayPalWebhookNormalizer";
import { AdyenPaymentGatewayAdapter } from "./adyen/AdyenPaymentGatewayAdapter";
import { AdyenWebhookNormalizer } from "./adyen/AdyenWebhookNormalizer";
import { CheckoutComPaymentGatewayAdapter } from "./checkout/CheckoutComPaymentGatewayAdapter";
import { CheckoutComWebhookNormalizer } from "./checkout/CheckoutComWebhookNormalizer";
import { IyzicoPaymentGatewayAdapter } from "./iyzico/IyzicoPaymentGatewayAdapter";
import { IyzicoWebhookNormalizer } from "./iyzico/IyzicoWebhookNormalizer";

export function registerEnterprisePaymentProviders(
  registry: IPaymentProviderRegistry,
  webhookRegistry?: WebhookNormalizerRegistry
): void {
  const stripe = new StripePaymentGatewayAdapter();
  const paypal = new PayPalPaymentGatewayAdapter();
  const adyen = new AdyenPaymentGatewayAdapter();
  const checkout = new CheckoutComPaymentGatewayAdapter();
  const iyzico = new IyzicoPaymentGatewayAdapter();

  registry.registerAdapter(stripe);
  registry.registerAdapter(paypal);
  registry.registerAdapter(adyen);
  registry.registerAdapter(checkout);
  registry.registerAdapter(iyzico);

  if (webhookRegistry) {
    webhookRegistry.register(new StripeWebhookNormalizer());
    webhookRegistry.register(new PayPalWebhookNormalizer());
    webhookRegistry.register(new AdyenWebhookNormalizer());
    webhookRegistry.register(new CheckoutComWebhookNormalizer());
    webhookRegistry.register(new IyzicoWebhookNormalizer());
  }
}
