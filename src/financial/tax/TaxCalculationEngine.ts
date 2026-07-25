import { CurrencyAmount, TaxCategory, TaxJurisdiction } from "../value-objects/FinancialValueObjects";

export interface TaxRateRule {
  countryCode: string;
  stateOrRegion?: string;
  taxName: string; // e.g. "US Sales Tax", "EU VAT", "UK VAT", "GST"
  standardRatePercentage: number; // e.g. 19.0 for 19%
  reducedRatePercentage?: number;
  category: TaxCategory;
  isReverseChargeEligible: boolean;
}

export interface TaxCalculationLineItem {
  lineItemId: string;
  category: TaxCategory;
  subtotal: CurrencyAmount;
  exemptCertificateNumber?: string;
}

export interface TaxCalculationResult {
  subtotal: CurrencyAmount;
  totalTaxAmount: CurrencyAmount;
  grandTotal: CurrencyAmount;
  taxJurisdiction: TaxJurisdiction;
  isReverseChargeApplied: boolean;
  lineBreakdown: Array<{
    lineItemId: string;
    subtotalCents: number;
    taxRatePercentage: number;
    taxAmountCents: number;
    effectiveTaxName: string;
  }>;
}

export class TaxCalculationEngine {
  private taxRules: TaxRateRule[] = [];

  constructor() {
    this.seedDefaultRules();
  }

  private seedDefaultRules(): void {
    this.taxRules = [
      { countryCode: "US", stateOrRegion: "CA", taxName: "CA Sales Tax", standardRatePercentage: 7.25, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: false },
      { countryCode: "US", stateOrRegion: "NY", taxName: "NY Sales Tax", standardRatePercentage: 8.875, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: false },
      { countryCode: "DE", taxName: "German VAT (MwSt)", standardRatePercentage: 19.0, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: true },
      { countryCode: "FR", taxName: "French VAT (TVA)", standardRatePercentage: 20.0, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: true },
      { countryCode: "GB", taxName: "UK VAT", standardRatePercentage: 20.0, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: true },
      { countryCode: "CA", stateOrRegion: "ON", taxName: "HST (Ontario)", standardRatePercentage: 13.0, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: false },
      { countryCode: "AU", taxName: "AU GST", standardRatePercentage: 10.0, category: "SAAS_SUBSCRIPTION", isReverseChargeEligible: false }
    ];
  }

  public calculateTax(
    jurisdiction: TaxJurisdiction,
    items: TaxCalculationLineItem[],
    customerVatOrTaxId?: string
  ): TaxCalculationResult {
    const currency = items[0]?.subtotal.currency || "USD";
    let subtotalCents = 0;
    let totalTaxCents = 0;

    const matchedRule = this.findMatchingRule(jurisdiction);

    // Check B2B Reverse charge eligibility (e.g., EU intra-community B2B supply with valid VAT ID)
    const isReverseChargeApplied = Boolean(
      customerVatOrTaxId && matchedRule?.isReverseChargeEligible && jurisdiction.countryCode !== "US"
    );

    const breakdown = items.map(item => {
      subtotalCents += item.subtotal.amountCents;

      // Check exemption
      if (item.exemptCertificateNumber || isReverseChargeApplied) {
        return {
          lineItemId: item.lineItemId,
          subtotalCents: item.subtotal.amountCents,
          taxRatePercentage: 0,
          taxAmountCents: 0,
          effectiveTaxName: isReverseChargeApplied ? `${matchedRule?.taxName || "VAT"} (Reverse Charge)` : "Tax Exempt"
        };
      }

      const ratePct = matchedRule ? matchedRule.standardRatePercentage : 0;
      const taxForLineCents = Math.round((item.subtotal.amountCents * ratePct) / 100);

      totalTaxCents += taxForLineCents;

      return {
        lineItemId: item.lineItemId,
        subtotalCents: item.subtotal.amountCents,
        taxRatePercentage: ratePct,
        taxAmountCents: taxForLineCents,
        effectiveTaxName: matchedRule ? matchedRule.taxName : "No Tax Applicable"
      };
    });

    return {
      subtotal: new CurrencyAmount(subtotalCents, currency),
      totalTaxAmount: new CurrencyAmount(totalTaxCents, currency),
      grandTotal: new CurrencyAmount(subtotalCents + totalTaxCents, currency),
      taxJurisdiction: jurisdiction,
      isReverseChargeApplied,
      lineBreakdown: breakdown
    };
  }

  private findMatchingRule(jurisdiction: TaxJurisdiction): TaxRateRule | undefined {
    return this.taxRules.find(r => {
      if (r.countryCode !== jurisdiction.countryCode) return false;
      if (r.stateOrRegion && jurisdiction.stateOrRegion && r.stateOrRegion !== jurisdiction.stateOrRegion) return false;
      return true;
    });
  }
}
