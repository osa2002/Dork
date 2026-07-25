export class GracePeriodPolicy {
  private readonly _defaultGracePeriodDays: number;

  constructor(defaultGracePeriodDays: number = 14) {
    if (defaultGracePeriodDays < 0) {
      throw new Error("Grace period days cannot be negative.");
    }
    this._defaultGracePeriodDays = defaultGracePeriodDays;
  }

  public get defaultGracePeriodDays(): number {
    return this._defaultGracePeriodDays;
  }

  public calculateExpirationDate(pastDueDate: Date, overrideDays?: number): Date {
    const days = overrideDays !== undefined ? overrideDays : this._defaultGracePeriodDays;
    const expiration = new Date(pastDueDate.getTime());
    expiration.setDate(expiration.getDate() + days);
    return expiration;
  }

  public isGracePeriodExceeded(pastDueDate: Date, currentDate: Date = new Date(), overrideDays?: number): boolean {
    const expiration = this.calculateExpirationDate(pastDueDate, overrideDays);
    return currentDate > expiration;
  }
}
