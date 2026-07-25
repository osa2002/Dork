import { Money } from "../value-objects/Money";

export interface DiscountProps {
  id: string;
  code: string;
  percentageOff?: number;
  amountOff?: Money;
  expiresAt?: Date;
  isActive: boolean;
}

export class Discount {
  private readonly _id: string;
  private readonly _code: string;
  private readonly _percentageOff?: number;
  private readonly _amountOff?: Money;
  private readonly _expiresAt?: Date;
  private _isActive: boolean;

  constructor(props: DiscountProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("Discount ID cannot be empty.");
    }
    if (!props.code || props.code.trim().length === 0) {
      throw new Error("Discount code cannot be empty.");
    }
    if (props.percentageOff === undefined && props.amountOff === undefined) {
      throw new Error("Discount must specify either percentageOff or amountOff.");
    }
    if (props.percentageOff !== undefined && (props.percentageOff <= 0 || props.percentageOff > 100)) {
      throw new Error("Percentage off must be between 1 and 100.");
    }

    this._id = props.id;
    this._code = props.code.trim().toUpperCase();
    this._percentageOff = props.percentageOff;
    this._amountOff = props.amountOff;
    this._expiresAt = props.expiresAt;
    this._isActive = props.isActive;
  }

  public get id(): string { return this._id; }
  public get code(): string { return this._code; }
  public get percentageOff(): number | undefined { return this._percentageOff; }
  public get amountOff(): Money | undefined { return this._amountOff; }
  public get expiresAt(): Date | undefined { return this._expiresAt; }
  public get isActive(): boolean { return this._isActive; }

  public isValidAt(date: Date = new Date()): boolean {
    if (!this._isActive) return false;
    if (this._expiresAt && date > this._expiresAt) return false;
    return true;
  }

  public calculateDiscountAmount(originalAmount: Money): Money {
    if (!this.isValidAt()) {
      return Money.zero(originalAmount.currency);
    }

    if (this._percentageOff !== undefined) {
      const discountCents = Math.round((originalAmount.amountInCents * this._percentageOff) / 100);
      return new Money(discountCents, originalAmount.currency);
    }

    if (this._amountOff !== undefined) {
      if (!this._amountOff.currency.equals(originalAmount.currency)) {
        throw new Error("Discount currency mismatch with original amount.");
      }
      return this._amountOff.isGreaterThan(originalAmount)
        ? originalAmount
        : this._amountOff;
    }

    return Money.zero(originalAmount.currency);
  }
}
