export class RetryPolicy {
  private readonly _intervalsInDays: number[];

  constructor(intervalsInDays: number[] = [1, 3, 7, 14]) {
    if (!intervalsInDays || intervalsInDays.length === 0) {
      throw new Error("RetryPolicy requires at least one interval.");
    }
    this._intervalsInDays = [...intervalsInDays].sort((a, b) => a - b);
  }

  public get intervalsInDays(): number[] {
    return [...this._intervalsInDays];
  }

  public get maxAttempts(): number {
    return this._intervalsInDays.length;
  }

  public getNextRetryDate(firstFailedDate: Date, attemptNumber: number): Date | null {
    if (attemptNumber < 1 || attemptNumber > this.maxAttempts) {
      return null;
    }
    const intervalDays = this._intervalsInDays[attemptNumber - 1];
    const nextRetry = new Date(firstFailedDate.getTime());
    nextRetry.setDate(nextRetry.getDate() + intervalDays);
    return nextRetry;
  }

  public isFinalAttemptExceeded(attemptCount: number): boolean {
    return attemptCount >= this.maxAttempts;
  }
}
