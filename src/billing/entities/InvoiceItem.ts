import { Money } from "../value-objects/Money";

export interface InvoiceItemProps {
  id: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  taxRatePercent: number;
  category: "SUBSCRIPTION" | "USAGE" | "ONE_TIME" | "TAX" | "CREDIT";
  periodStart?: Date;
  periodEnd?: Date;
}

export class InvoiceItem {
  private readonly _id: string;
  private _description: string;
  private _quantity: number;
  private _unitPrice: Money;
  private _taxRatePercent: number;
  private _category: "SUBSCRIPTION" | "USAGE" | "ONE_TIME" | "TAX" | "CREDIT";
  private _periodStart?: Date;
  private _periodEnd?: Date;

  constructor(props: InvoiceItemProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("InvoiceItem ID cannot be empty.");
    }
    if (!props.description || props.description.trim().length === 0) {
      throw new Error("InvoiceItem description cannot be empty.");
    }
    if (props.quantity <= 0) {
      throw new Error("InvoiceItem quantity must be greater than zero.");
    }
    if (props.taxRatePercent < 0) {
      throw new Error("Tax rate percent cannot be negative.");
    }

    this._id = props.id;
    this._description = props.description.trim();
    this._quantity = props.quantity;
    this._unitPrice = props.unitPrice;
    this._taxRatePercent = props.taxRatePercent;
    this._category = props.category;
    this._periodStart = props.periodStart;
    this._periodEnd = props.periodEnd;
  }

  public get id(): string { return this._id; }
  public get description(): string { return this._description; }
  public get quantity(): number { return this._quantity; }
  public get unitPrice(): Money { return this._unitPrice; }
  public get taxRatePercent(): number { return this._taxRatePercent; }
  public get category(): string { return this._category; }
  public get periodStart(): Date | undefined { return this._periodStart; }
  public get periodEnd(): Date | undefined { return this._periodEnd; }

  public get subtotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }

  public get taxAmount(): Money {
    const sub = this.subtotal;
    const taxInCents = Math.round((sub.amountInCents * this._taxRatePercent) / 100);
    return new Money(taxInCents, sub.currency);
  }

  public get total(): Money {
    return this.subtotal.add(this.taxAmount);
  }
}
