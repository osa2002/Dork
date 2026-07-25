import {
  AuthorizePaymentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  CancelPaymentRequest,
  TransactionResult,
  AdapterConfig
} from "../types/PPALCommonTypes";
import { ProviderCapabilities } from "../capabilities/ProviderCapabilities";

export interface IPaymentGatewayAdapter {
  readonly config: AdapterConfig;
  getCapabilities(): ProviderCapabilities;

  authorize(request: AuthorizePaymentRequest): Promise<TransactionResult>;
  capture(request: CapturePaymentRequest): Promise<TransactionResult>;
  refund(request: RefundPaymentRequest): Promise<TransactionResult>;
  cancel(request: CancelPaymentRequest): Promise<TransactionResult>;
  fetchTransactionStatus(transactionId: string): Promise<TransactionResult>;
}
