import { CurrencyAmount, CurrencyCode } from "../value-objects/FinancialValueObjects";

export interface TrialBalanceLine {
  accountNumber: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  debitCents: number;
  creditCents: number;
}

export interface IncomeStatementReport {
  tenantId: string;
  periodId: string;
  currency: CurrencyCode;
  grossBookings: CurrencyAmount;
  recognizedRevenue: CurrencyAmount;
  gatewayFees: CurrencyAmount;
  refundsAndDisputes: CurrencyAmount;
  netOperatingIncome: CurrencyAmount;
}

export interface BalanceSheetReport {
  tenantId: string;
  asOfDateIso: string;
  currency: CurrencyCode;
  assets: {
    cashAndEquivalents: CurrencyAmount;
    accountsReceivable: CurrencyAmount;
    totalAssets: CurrencyAmount;
  };
  liabilities: {
    deferredRevenue: CurrencyAmount;
    taxLiabilityAccrued: CurrencyAmount;
    totalLiabilities: CurrencyAmount;
  };
  equity: {
    retainedEarnings: CurrencyAmount;
    totalEquity: CurrencyAmount;
  };
}

export class FinancialReportingService {
  public generateIncomeStatement(
    tenantId: string,
    periodId: string,
    grossBookingsCents: number,
    recognizedRevenueCents: number,
    gatewayFeesCents: number,
    refundsCents: number,
    currency: CurrencyCode = "USD"
  ): IncomeStatementReport {
    const netIncomeCents = recognizedRevenueCents - gatewayFeesCents - refundsCents;

    return {
      tenantId,
      periodId,
      currency,
      grossBookings: new CurrencyAmount(grossBookingsCents, currency),
      recognizedRevenue: new CurrencyAmount(recognizedRevenueCents, currency),
      gatewayFees: new CurrencyAmount(gatewayFeesCents, currency),
      refundsAndDisputes: new CurrencyAmount(refundsCents, currency),
      netOperatingIncome: new CurrencyAmount(netIncomeCents, currency)
    };
  }

  public generateBalanceSheet(
    tenantId: string,
    cashCents: number,
    arCents: number,
    deferredRevenueCents: number,
    taxLiabilityCents: number,
    currency: CurrencyCode = "USD"
  ): BalanceSheetReport {
    const totalAssetsCents = cashCents + arCents;
    const totalLiabilitiesCents = deferredRevenueCents + taxLiabilityCents;
    const retainedEarningsCents = totalAssetsCents - totalLiabilitiesCents;

    return {
      tenantId,
      asOfDateIso: new Date().toISOString(),
      currency,
      assets: {
        cashAndEquivalents: new CurrencyAmount(cashCents, currency),
        accountsReceivable: new CurrencyAmount(arCents, currency),
        totalAssets: new CurrencyAmount(totalAssetsCents, currency)
      },
      liabilities: {
        deferredRevenue: new CurrencyAmount(deferredRevenueCents, currency),
        taxLiabilityAccrued: new CurrencyAmount(taxLiabilityCents, currency),
        totalLiabilities: new CurrencyAmount(totalLiabilitiesCents, currency)
      },
      equity: {
        retainedEarnings: new CurrencyAmount(retainedEarningsCents, currency),
        totalEquity: new CurrencyAmount(retainedEarningsCents, currency)
      }
    };
  }

  public generateTrialBalance(
    cashCents: number,
    arCents: number,
    deferredRevenueCents: number,
    taxLiabilityCents: number,
    revenueCents: number,
    expenseCents: number
  ): TrialBalanceLine[] {
    return [
      { accountNumber: "1010", accountName: "Cash & Clearing Accounts", accountType: "ASSET", debitCents: cashCents, creditCents: 0 },
      { accountNumber: "1100", accountName: "Accounts Receivable", accountType: "ASSET", debitCents: arCents, creditCents: 0 },
      { accountNumber: "2010", accountName: "Unearned / Deferred Revenue", accountType: "LIABILITY", debitCents: 0, creditCents: deferredRevenueCents },
      { accountNumber: "2050", accountName: "Sales & VAT Tax Payable", accountType: "LIABILITY", debitCents: 0, creditCents: taxLiabilityCents },
      { accountNumber: "4010", accountName: "Recognized Subscription Revenue", accountType: "REVENUE", debitCents: 0, creditCents: revenueCents },
      { accountNumber: "5010", accountName: "Payment Gateway Processing Fees", accountType: "EXPENSE", debitCents: expenseCents, creditCents: 0 }
    ];
  }
}
