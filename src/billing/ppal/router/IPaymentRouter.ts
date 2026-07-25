import { PaymentProviderId } from "../types/PaymentProviderId";
import { AuthorizePaymentRequest } from "../types/PPALCommonTypes";

export interface RoutingCriteria {
  preferredProviderId?: PaymentProviderId;
  currency: string;
  paymentMethodType: string;
  amountInCents: number;
  countryCode?: string;
  require3DSecure?: boolean;
}

export interface IPaymentRouter {
  route(criteria: RoutingCriteria): PaymentProviderId;
  routeForRequest(request: AuthorizePaymentRequest, preferredProviderId?: PaymentProviderId): PaymentProviderId;
}
