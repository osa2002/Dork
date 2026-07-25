import { Currency } from "./Currency";

export class Money {
  private readonly _amountInCents: number;
  private readonly _currency: Currency;

  constructor(amountInCents: number, currency: Currency) {
    if (!Number.isInteger(amountInCents)) {
      throw new Error("Money amount must be an integer representing smallest currency units.");
    }
    if (!currency) {
      throw new Error("Currency is required for Money value object.");
    }
    this._amountInCents = amountInCents;
    this._currency = currency;
  }

  public get amountInCents(): number {
    return this._amountInCents;
  }

  public get currency(): Currency {
    return this._currency;
  }

  public static zero(currency: Currency = Currency.USD): Money {
    return new Money(0, currency);
  }

  public static fromMajorUnits(amount: number, currency: Currency = Currency.USD): Money {
    const factor = Math.pow(10, currency.decimalPlaces);
    return new Money(Math.round(amount * factor), currency);
  }

  public toMajorUnits(): number {
    const factor = Math.pow(10, this._currency.decimalPlaces);
    return this._amountInCents / factor;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amountInCents + other._amountInCents, this._currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amountInCents - other._amountInCents, this._currency);
  }

  public multiply(multiplier: number): Money {
    return new Money(Math.round(this._amountInCents * multiplier), this._currency);
  }

  public allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) return [];
    const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
    if (totalRatio <= 0) {
      throw new Error("Allocation ratios must sum to greater than zero.");
    }

    let remainder = this._amountInCents;
    const results: Money[] = [];

    for (let i = 0; i < ratios.length; i++) {
      const share = Math.floor((this._amountInCents * ratios[i]) / totalRatio);
      results.push(new Money(share, this._currency));
      remainder -= share;
    }

    for (let i = 0; i < remainder; i++) {
      results[i] = new Money(results[i].amountInCents + 1, this._currency);
    }

    return results;
  }

  public equals(other?: Money): boolean {
    if (!other) return false;
    return this._amountInCents === other._amountInCents && this._currency.equals(other._currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amountInCents > other._amountInCents;
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amountInCents < other._amountInCents;
  }

  public isZero(): boolean {
    return this._amountInCents === 0;
  }

  public isPositive(): boolean {
    return this._amountInCents > 0;
  }

  public isNegative(): boolean {
    return this._amountInCents < 0;
  }

  public format(): string {
    return `${this._currency.symbol}${this.toMajorUnits().toFixed(this._currency.decimalPlaces)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new Error(`Currency mismatch: ${this._currency.code} vs ${other._currency.code}`);
    }
  }
}
