export enum InvoiceStatusEnum {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  PAID = "PAID",
  VOID = "VOID",
  UNCOLLECTIBLE = "UNCOLLECTIBLE"
}

export class InvoiceStatus {
  private readonly _value: InvoiceStatusEnum;

  constructor(value: InvoiceStatusEnum) {
    this._value = value;
  }

  public get value(): InvoiceStatusEnum {
    return this._value;
  }

  public isSettled(): boolean {
    return (
      this._value === InvoiceStatusEnum.PAID ||
      this._value === InvoiceStatusEnum.VOID ||
      this._value === InvoiceStatusEnum.UNCOLLECTIBLE
    );
  }

  public isCollectible(): boolean {
    return this._value === InvoiceStatusEnum.OPEN;
  }

  public equals(other?: InvoiceStatus): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}
