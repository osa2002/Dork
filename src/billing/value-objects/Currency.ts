export class Currency {
  private readonly _code: string;
  private readonly _symbol: string;
  private readonly _decimalPlaces: number;

  public static readonly USD = new Currency("USD", "$", 2);
  public static readonly EUR = new Currency("EUR", "€", 2);
  public static readonly GBP = new Currency("GBP", "£", 2);
  public static readonly CAD = new Currency("CAD", "CA$", 2);
  public static readonly AUD = new Currency("AUD", "A$", 2);
  public static readonly JPY = new Currency("JPY", "¥", 0);

  constructor(code: string, symbol: string = "$", decimalPlaces: number = 2) {
    if (!code || code.trim().length !== 3) {
      throw new Error("Currency code must be a 3-letter ISO code.");
    }
    this._code = code.trim().toUpperCase();
    this._symbol = symbol;
    this._decimalPlaces = decimalPlaces;
  }

  public get code(): string {
    return this._code;
  }

  public get symbol(): string {
    return this._symbol;
  }

  public get decimalPlaces(): number {
    return this._decimalPlaces;
  }

  public equals(other?: Currency): boolean {
    if (!other) return false;
    return this._code === other._code;
  }

  public static fromCode(code: string): Currency {
    const normalized = code.trim().toUpperCase();
    switch (normalized) {
      case "USD":
        return Currency.USD;
      case "EUR":
        return Currency.EUR;
      case "GBP":
        return Currency.GBP;
      case "CAD":
        return Currency.CAD;
      case "AUD":
        return Currency.AUD;
      case "JPY":
        return Currency.JPY;
      default:
        return new Currency(normalized);
    }
  }
}
