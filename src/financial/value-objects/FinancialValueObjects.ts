export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY" | "TRY" | "BRL";

export class CurrencyAmount {
  constructor(
    public readonly amountCents: number,
    public readonly currency: CurrencyCode
  ) {
    if (!Number.isInteger(amountCents)) {
      throw new Error("CurrencyAmount must be an integer in smallest currency units (cents)");
    }
  }

  public static zero(currency: CurrencyCode = "USD"): CurrencyAmount {
    return new CurrencyAmount(0, currency);
  }

  public add(other: CurrencyAmount): CurrencyAmount {
    this.ensureSameCurrency(other);
    return new CurrencyAmount(this.amountCents + other.amountCents, this.currency);
  }

  public subtract(other: CurrencyAmount): CurrencyAmount {
    this.ensureSameCurrency(other);
    return new CurrencyAmount(this.amountCents - other.amountCents, this.currency);
  }

  public multiply(factor: number): CurrencyAmount {
    return new CurrencyAmount(Math.round(this.amountCents * factor), this.currency);
  }

  public toFormattedString(): string {
    const formatted = (this.amountCents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${this.currency} ${formatted}`;
  }

  private ensureSameCurrency(other: CurrencyAmount): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot perform operation between ${this.currency} and ${other.currency}`);
    }
  }
}

export type TaxCategory = "DIGITAL_GOODS" | "SAAS_SUBSCRIPTION" | "PHYSICAL_GOODS" | "EXEMPT_SERVICES";

export interface TaxJurisdiction {
  countryCode: string; // e.g. "US", "DE", "GB"
  stateOrRegion?: string; // e.g. "CA", "NY", "ON"
  postalCode?: string;
  taxRegistrationNumber?: string;
}

export type RecognitionMethod = "IMMEDIATE" | "POINT_IN_TIME" | "RATABLE_MONTHLY" | "MILESTONE_BASED";

export interface RiskEvaluationFactors {
  ipCountryCode?: string;
  cardCountryCode?: string;
  velocity24hCount: number;
  chargebackHistoryCount: number;
  deviceFingerprintRisk: number; // 0-100
  emailDomainReputation: "TRUSTED" | "SUSPICIOUS" | "DISPOSABLE";
}
