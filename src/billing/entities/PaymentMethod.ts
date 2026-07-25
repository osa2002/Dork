import { PaymentMethodId } from "../value-objects/PaymentMethodId";

export type PaymentMethodType = "CARD" | "BANK_ACCOUNT" | "DIGITAL_WALLET" | "SEPA_DEBIT";

export interface BillingContactDetails {
  name: string;
  email: string;
  addressLine1?: string;
  city?: string;
  country: string;
  postalCode?: string;
}

export interface PaymentMethodProps {
  id: PaymentMethodId;
  type: PaymentMethodType;
  isDefault: boolean;
  last4: string;
  brand: string;
  expiryMonth?: number;
  expiryYear?: number;
  billingDetails: BillingContactDetails;
  providerReferenceId: string;
  createdAt: Date;
}

export class PaymentMethod {
  private readonly _id: PaymentMethodId;
  private readonly _type: PaymentMethodType;
  private _isDefault: boolean;
  private readonly _last4: string;
  private readonly _brand: string;
  private readonly _expiryMonth?: number;
  private readonly _expiryYear?: number;
  private _billingDetails: BillingContactDetails;
  private readonly _providerReferenceId: string;
  private readonly _createdAt: Date;

  constructor(props: PaymentMethodProps) {
    if (!props.id) {
      throw new Error("PaymentMethodId is required.");
    }
    if (!props.last4 || props.last4.length !== 4) {
      throw new Error("Last 4 digits must be exactly 4 characters.");
    }
    if (!props.providerReferenceId) {
      throw new Error("Provider reference ID is required.");
    }

    this._id = props.id;
    this._type = props.type;
    this._isDefault = props.isDefault;
    this._last4 = props.last4;
    this._brand = props.brand;
    this._expiryMonth = props.expiryMonth;
    this._expiryYear = props.expiryYear;
    this._billingDetails = { ...props.billingDetails };
    this._providerReferenceId = props.providerReferenceId;
    this._createdAt = props.createdAt || new Date();
  }

  public get id(): PaymentMethodId { return this._id; }
  public get type(): PaymentMethodType { return this._type; }
  public get isDefault(): boolean { return this._isDefault; }
  public get last4(): string { return this._last4; }
  public get brand(): string { return this._brand; }
  public get expiryMonth(): number | undefined { return this._expiryMonth; }
  public get expiryYear(): number | undefined { return this._expiryYear; }
  public get billingDetails(): BillingContactDetails { return { ...this._billingDetails }; }
  public get providerReferenceId(): string { return this._providerReferenceId; }
  public get createdAt(): Date { return this._createdAt; }

  public setDefault(isDefault: boolean): void {
    this._isDefault = isDefault;
  }

  public updateBillingDetails(details: Partial<BillingContactDetails>): void {
    this._billingDetails = {
      ...this._billingDetails,
      ...details
    };
  }

  public isExpired(currentDate: Date = new Date()): boolean {
    if (!this._expiryYear || !this._expiryMonth) return false;
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth() + 1;

    if (this._expiryYear < currentYear) return true;
    if (this._expiryYear === currentYear && this._expiryMonth < currentMonth) return true;
    return false;
  }
}
