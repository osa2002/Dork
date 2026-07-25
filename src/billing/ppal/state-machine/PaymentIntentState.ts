export enum PPALPaymentIntentStateEnum {
  CREATED = "CREATED",
  REQUIRES_PAYMENT_METHOD = "REQUIRES_PAYMENT_METHOD",
  REQUIRES_CONFIRMATION = "REQUIRES_CONFIRMATION",
  REQUIRES_ACTION = "REQUIRES_ACTION",
  PROCESSING = "PROCESSING",
  REQUIRES_CAPTURE = "REQUIRES_CAPTURE",
  SUCCEEDED = "SUCCEEDED",
  CANCELED = "CANCELED",
  FAILED = "FAILED"
}

export class PPALPaymentIntentState {
  private readonly _value: PPALPaymentIntentStateEnum;

  constructor(value: PPALPaymentIntentStateEnum) {
    this._value = value;
  }

  public get value(): PPALPaymentIntentStateEnum {
    return this._value;
  }

  public isTerminal(): boolean {
    return (
      this._value === PPALPaymentIntentStateEnum.SUCCEEDED ||
      this._value === PPALPaymentIntentStateEnum.CANCELED ||
      this._value === PPALPaymentIntentStateEnum.FAILED
    );
  }

  public equals(other: PPALPaymentIntentState): boolean {
    return this._value === other._value;
  }
}
