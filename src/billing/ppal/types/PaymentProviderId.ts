export type PaymentProviderId = "stripe" | "adyen" | "paypal" | "mock_provider" | string;

export class PaymentProviderIdVO {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("PaymentProviderId cannot be empty.");
    }
    this._value = value.trim().toLowerCase();
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: PaymentProviderIdVO): boolean {
    return this._value === other._value;
  }
}
