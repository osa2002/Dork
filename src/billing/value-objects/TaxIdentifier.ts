export type TaxIdentifierType = "VAT" | "GST" | "EIN" | "CUSTOM";

export class TaxIdentifier {
  private readonly _type: TaxIdentifierType;
  private readonly _value: string;
  private readonly _countryCode: string;
  private readonly _isVerified: boolean;

  constructor(type: TaxIdentifierType, value: string, countryCode: string, isVerified: boolean = false) {
    if (!value || value.trim().length === 0) {
      throw new Error("TaxIdentifier value cannot be empty.");
    }
    if (!countryCode || countryCode.trim().length !== 2) {
      throw new Error("Country code must be a 2-letter ISO string.");
    }
    this._type = type;
    this._value = value.trim();
    this._countryCode = countryCode.trim().toUpperCase();
    this._isVerified = isVerified;
  }

  public get type(): TaxIdentifierType {
    return this._type;
  }

  public get value(): string {
    return this._value;
  }

  public get countryCode(): string {
    return this._countryCode;
  }

  public get isVerified(): boolean {
    return this._isVerified;
  }

  public withVerification(verified: boolean): TaxIdentifier {
    return new TaxIdentifier(this._type, this._value, this._countryCode, verified);
  }

  public equals(other?: TaxIdentifier): boolean {
    if (!other) return false;
    return (
      this._type === other._type &&
      this._value === other._value &&
      this._countryCode === other._countryCode
    );
  }
}
