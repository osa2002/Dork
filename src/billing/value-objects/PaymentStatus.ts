export enum PaymentStatusEnum {
  REQUIRES_PAYMENT_METHOD = "REQUIRES_PAYMENT_METHOD",
  REQUIRES_CONFIRMATION = "REQUIRES_CONFIRMATION",
  REQUIRES_ACTION = "REQUIRES_ACTION",
  PROCESSING = "PROCESSING",
  SUCCEEDED = "SUCCEEDED",
  CANCELED = "CANCELED",
  FAILED = "FAILED"
}

export class PaymentStatus {
  private readonly _value: PaymentStatusEnum;

  constructor(value: PaymentStatusEnum) {
    this._value = value;
  }

  public get value(): PaymentStatusEnum {
    return this._value;
  }

  public isSuccessful(): boolean {
    return this._value === PaymentStatusEnum.SUCCEEDED;
  }

  public isTerminal(): boolean {
    return (
      this._value === PaymentStatusEnum.SUCCEEDED ||
      this._value === PaymentStatusEnum.CANCELED ||
      this._value === PaymentStatusEnum.FAILED
    );
  }

  public equals(other?: PaymentStatus): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
