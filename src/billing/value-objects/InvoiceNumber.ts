export class InvoiceNumber {
  private readonly _prefix: string;
  private readonly _sequence: number;
  private readonly _formatted: string;

  constructor(sequence: number, prefix: string = "INV", year?: number) {
    if (!Number.isInteger(sequence) || sequence <= 0) {
      throw new Error("Invoice sequence must be a positive integer.");
    }
    const currentYear = year || new Date().getUTCFullYear();
    this._prefix = prefix.toUpperCase();
    this._sequence = sequence;
    this._formatted = `${this._prefix}-${currentYear}-${sequence.toString().padStart(6, "0")}`;
  }

  public get prefix(): string {
    return this._prefix;
  }

  public get sequence(): number {
    return this._sequence;
  }

  public get formatted(): string {
    return this._formatted;
  }

  public static parse(formatted: string): InvoiceNumber {
    const parts = formatted.split("-");
    if (parts.length !== 3) {
      throw new Error("Invalid invoice number format. Expected PREFIX-YEAR-SEQUENCE.");
    }
    const [prefix, yearStr, seqStr] = parts;
    const year = parseInt(yearStr, 10);
    const seq = parseInt(seqStr, 10);
    if (isNaN(year) || isNaN(seq)) {
      throw new Error("Invalid year or sequence in invoice number string.");
    }
    return new InvoiceNumber(seq, prefix, year);
  }

  public equals(other?: InvoiceNumber): boolean {
    if (!other) return false;
    return this._formatted === other._formatted;
  }

  public toString(): string {
    return this._formatted;
  }
}
