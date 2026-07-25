export class SubscriptionId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("SubscriptionId cannot be empty.");
    }
    this._value = value.trim();
  }

  public get value(): string {
    return this._value;
  }

  public equals(other?: SubscriptionId): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
