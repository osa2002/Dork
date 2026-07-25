import { IWebhookNormalizer, WebhookRawPayload } from "../contracts/IWebhookNormalizer";
import { NormalizedWebhookEvent } from "./NormalizedWebhookEvent";
import { PaymentProviderNotFoundException, WebhookVerificationFailedException } from "../exceptions/PPALExceptions";

export class WebhookNormalizerRegistry {
  private readonly _normalizers: Map<string, IWebhookNormalizer> = new Map();

  public register(normalizer: IWebhookNormalizer): void {
    this._normalizers.set(normalizer.providerId.toLowerCase(), normalizer);
  }

  public getNormalizer(providerId: string): IWebhookNormalizer {
    const norm = this._normalizers.get(providerId.toLowerCase());
    if (!norm) {
      throw new PaymentProviderNotFoundException(providerId);
    }
    return norm;
  }

  public processWebhook(
    providerId: string,
    rawPayload: WebhookRawPayload,
    secretKey: string
  ): NormalizedWebhookEvent {
    const normalizer = this.getNormalizer(providerId);
    const isValidSignature = normalizer.verifySignature(rawPayload, secretKey);

    if (!isValidSignature) {
      throw new WebhookVerificationFailedException(providerId, "Invalid signature or checksum.");
    }

    return normalizer.normalize(rawPayload);
  }
}
