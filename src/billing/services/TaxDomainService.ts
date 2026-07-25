import { TaxIdentifier } from "../value-objects/TaxIdentifier";
import { Money } from "../value-objects/Money";

export interface TaxCalculationResult {
  taxRatePercent: number;
  taxAmount: Money;
  isReverseCharge: boolean;
}

export class TaxDomainService {
  public calculateTax(
    subtotal: Money,
    countryCode: string,
    taxIdentifier?: TaxIdentifier
  ): TaxCalculationResult {
    const uppercaseCountry = countryCode.toUpperCase();

    if (taxIdentifier && taxIdentifier.isVerified && taxIdentifier.countryCode === uppercaseCountry && taxIdentifier.type === "VAT") {
      return {
        taxRatePercent: 0,
        taxAmount: Money.zero(subtotal.currency),
        isReverseCharge: true
      };
    }

    let defaultRate = 0;
    switch (uppercaseCountry) {
      case "GB":
        defaultRate = 20.0;
        break;
      case "DE":
      case "RO":
        defaultRate = 19.0;
        break;
      case "FR":
        defaultRate = 20.0;
        break;
      case "CA":
        defaultRate = 13.0; // HST average
        break;
      case "AU":
        defaultRate = 10.0;
        break;
      case "US":
        defaultRate = 0; // Sales tax determined per state in US
        break;
      default:
        defaultRate = 0;
        break;
    }

    const taxCents = Math.round((subtotal.amountInCents * defaultRate) / 100);
    return {
      taxRatePercent: defaultRate,
      taxAmount: new Money(taxCents, subtotal.currency),
      isReverseCharge: false
    };
  }
}
