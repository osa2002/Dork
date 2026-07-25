export type BillingInterval = "MONTHLY" | "ANNUALLY" | "QUARTERLY" | "CUSTOM";

export class BillingPeriod {
  private readonly _startDate: Date;
  private readonly _endDate: Date;
  private readonly _interval: BillingInterval;

  constructor(startDate: Date, endDate: Date, interval: BillingInterval = "MONTHLY") {
    if (endDate <= startDate) {
      throw new Error("BillingPeriod endDate must be after startDate.");
    }
    this._startDate = new Date(startDate.getTime());
    this._endDate = new Date(endDate.getTime());
    this._interval = interval;
  }

  public get startDate(): Date {
    return new Date(this._startDate.getTime());
  }

  public get endDate(): Date {
    return new Date(this._endDate.getTime());
  }

  public get interval(): BillingInterval {
    return this._interval;
  }

  public durationInDays(): number {
    const diff = this._endDate.getTime() - this._startDate.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  public containsDate(date: Date): boolean {
    const time = date.getTime();
    return time >= this._startDate.getTime() && time <= this._endDate.getTime();
  }

  public equals(other?: BillingPeriod): boolean {
    if (!other) return false;
    return (
      this._startDate.getTime() === other._startDate.getTime() &&
      this._endDate.getTime() === other._endDate.getTime() &&
      this._interval === other._interval
    );
  }
}
