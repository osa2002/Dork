import { IPaymentGatewayAdapter } from "../contracts/IPaymentGatewayAdapter";
import {
  AdapterConfig,
  AuthorizePaymentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  CancelPaymentRequest,
  TransactionResult
} from "../types/PPALCommonTypes";
import { ProviderCapabilities } from "../capabilities/ProviderCapabilities";
import { PaymentGatewayAdapterException, ProviderCapabilityMismatchException } from "../exceptions/PPALExceptions";

export abstract class BasePaymentGatewayAdapter implements IPaymentGatewayAdapter {
  public readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    if (!config.providerId) {
      throw new Error("AdapterConfig requires a valid providerId.");
    }
    this.config = config;
  }

  public abstract getCapabilities(): ProviderCapabilities;

  public async authorize(request: AuthorizePaymentRequest): Promise<TransactionResult> {
    this.validateCapabilityForAuthorization(request);
    try {
      return await this.doAuthorize(request);
    } catch (err) {
      throw new PaymentGatewayAdapterException(this.config.providerId, "Authorization failed", err);
    }
  }

  public async capture(request: CapturePaymentRequest): Promise<TransactionResult> {
    this.validateCapabilityForCapture();
    try {
      return await this.doCapture(request);
    } catch (err) {
      throw new PaymentGatewayAdapterException(this.config.providerId, "Capture failed", err);
    }
  }

  public async refund(request: RefundPaymentRequest): Promise<TransactionResult> {
    try {
      return await this.doRefund(request);
    } catch (err) {
      throw new PaymentGatewayAdapterException(this.config.providerId, "Refund failed", err);
    }
  }

  public async cancel(request: CancelPaymentRequest): Promise<TransactionResult> {
    try {
      return await this.doCancel(request);
    } catch (err) {
      throw new PaymentGatewayAdapterException(this.config.providerId, "Cancel failed", err);
    }
  }

  public async fetchTransactionStatus(transactionId: string): Promise<TransactionResult> {
    try {
      return await this.doFetchTransactionStatus(transactionId);
    } catch (err) {
      throw new PaymentGatewayAdapterException(this.config.providerId, "Fetch transaction status failed", err);
    }
  }

  protected abstract doAuthorize(request: AuthorizePaymentRequest): Promise<TransactionResult>;
  protected abstract doCapture(request: CapturePaymentRequest): Promise<TransactionResult>;
  protected abstract doRefund(request: RefundPaymentRequest): Promise<TransactionResult>;
  protected abstract doCancel(request: CancelPaymentRequest): Promise<TransactionResult>;
  protected abstract doFetchTransactionStatus(transactionId: string): Promise<TransactionResult>;

  private validateCapabilityForAuthorization(request: AuthorizePaymentRequest): void {
    const caps = this.getCapabilities();
    if (!caps.supportsCurrency(request.amount.currencyCode)) {
      throw new ProviderCapabilityMismatchException(
        this.config.providerId,
        `Currency '${request.amount.currencyCode}' is not supported.`
      );
    }
    if (!caps.supportsPaymentMethodType(request.paymentMethod.type)) {
      throw new ProviderCapabilityMismatchException(
        this.config.providerId,
        `Payment method '${request.paymentMethod.type}' is not supported.`
      );
    }
  }

  private validateCapabilityForCapture(): void {
    const caps = this.getCapabilities();
    if (!caps.supportsManualCapture && !caps.supportsImmediateCapture) {
      throw new ProviderCapabilityMismatchException(
        this.config.providerId,
        "Provider does not support capture operations."
      );
    }
  }
}
