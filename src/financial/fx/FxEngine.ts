import { CurrencyAmount, CurrencyCode } from "../value-objects/FinancialValueObjects";

export interface ExchangeRatePair {
  baseCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  rate: number;
  effectiveDateIso: string;
  source: string; // e.g. "ECB", "FED", "OANDA"
}

export interface FxGainLossResult {
  realizedGainLossCents: number;
  isGain: boolean;
  baseCurrency: CurrencyCode;
  transactionAmountInBaseCents: number;
  settlementAmountInBaseCents: number;
}

export class FxEngine {
  private ratesMap: Map<string, ExchangeRatePair> = new Map();

  constructor() {
    this.seedDefaultRates();
  }

  private seedDefaultRates(): void {
    const defaultPairs: ExchangeRatePair[] = [
      { baseCurrency: "USD", targetCurrency: "EUR", rate: 0.92, effectiveDateIso: new Date().toISOString(), source: "ECB" },
      { baseCurrency: "EUR", targetCurrency: "USD", rate: 1.087, effectiveDateIso: new Date().toISOString(), source: "ECB" },
      { baseCurrency: "USD", targetCurrency: "GBP", rate: 0.78, effectiveDateIso: new Date().toISOString(), source: "BOE" },
      { baseCurrency: "GBP", targetCurrency: "USD", rate: 1.282, effectiveDateIso: new Date().toISOString(), source: "BOE" },
      { baseCurrency: "USD", targetCurrency: "CAD", rate: 1.36, effectiveDateIso: new Date().toISOString(), source: "BOC" },
      { baseCurrency: "CAD", targetCurrency: "USD", rate: 0.735, effectiveDateIso: new Date().toISOString(), source: "BOC" },
      { baseCurrency: "USD", targetCurrency: "AUD", rate: 1.52, effectiveDateIso: new Date().toISOString(), source: "RBA" },
      { baseCurrency: "USD", targetCurrency: "JPY", rate: 155.4, effectiveDateIso: new Date().toISOString(), source: "BOJ" },
      { baseCurrency: "USD", targetCurrency: "TRY", rate: 32.8, effectiveDateIso: new Date().toISOString(), source: "CBRT" },
      { baseCurrency: "USD", targetCurrency: "BRL", rate: 5.45, effectiveDateIso: new Date().toISOString(), source: "BCB" }
    ];

    for (const pair of defaultPairs) {
      this.registerRate(pair);
    }
  }

  public registerRate(pair: ExchangeRatePair): void {
    const key = `${pair.baseCurrency}_${pair.targetCurrency}`;
    this.ratesMap.set(key, pair);
  }

  public convert(amount: CurrencyAmount, targetCurrency: CurrencyCode): CurrencyAmount {
    if (amount.currency === targetCurrency) {
      return amount;
    }

    const key = `${amount.currency}_${targetCurrency}`;
    const pair = this.ratesMap.get(key);

    if (!pair) {
      // Attempt triangular conversion via USD
      const toUsdKey = `${amount.currency}_USD`;
      const fromUsdKey = `USD_${targetCurrency}`;

      const toUsd = this.ratesMap.get(toUsdKey);
      const fromUsd = this.ratesMap.get(fromUsdKey);

      if (toUsd && fromUsd) {
        const usdAmount = amount.amountCents * toUsd.rate;
        const targetCents = Math.round(usdAmount * fromUsd.rate);
        return new CurrencyAmount(targetCents, targetCurrency);
      }

      throw new Error(`FX Exchange Rate Exception: No valid exchange rate found for ${amount.currency} -> ${targetCurrency}`);
    }

    const convertedCents = Math.round(amount.amountCents * pair.rate);
    return new CurrencyAmount(convertedCents, targetCurrency);
  }

  /**
   * Calculates Realized FX Gain or Loss between original invoice/authorization date and final payment settlement date
   */
  public calculateRealizedGainLoss(
    foreignAmount: CurrencyAmount,
    baseCurrency: CurrencyCode,
    authorizationSpotRate: number,
    settlementSpotRate: number
  ): FxGainLossResult {
    const transactionAmountInBaseCents = Math.round(foreignAmount.amountCents * authorizationSpotRate);
    const settlementAmountInBaseCents = Math.round(foreignAmount.amountCents * settlementSpotRate);

    const differenceCents = settlementAmountInBaseCents - transactionAmountInBaseCents;

    return {
      realizedGainLossCents: Math.abs(differenceCents),
      isGain: differenceCents >= 0,
      baseCurrency,
      transactionAmountInBaseCents,
      settlementAmountInBaseCents
    };
  }
}
