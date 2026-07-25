export enum SubscriptionStatusEnum {
  TRIALING = "TRIALING",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  UNPAID = "UNPAID",
  PAUSED = "PAUSED"
}

export class SubscriptionStatus {
  private readonly _value: SubscriptionStatusEnum;

  constructor(value: SubscriptionStatusEnum) {
    this._value = value;
  }

  public get value(): SubscriptionStatusEnum {
    return this._value;
  }

  public isCanAccessServices(): boolean {
    return this._value === SubscriptionStatusEnum.ACTIVE || this._value === SubscriptionStatusEnum.TRIALING;
  }

  public isTerminal(): boolean {
    return this._value === SubscriptionStatusEnum.CANCELED;
  }

  public equals(other?: SubscriptionStatus): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
