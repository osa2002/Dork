import { CurrencyAmount, CurrencyCode, RecognitionMethod } from "../value-objects/FinancialValueObjects";

export interface PerformanceObligation {
  obligationId: string;
  description: string;
  standalonePrice: CurrencyAmount;
  allocatedPrice: CurrencyAmount;
  method: RecognitionMethod;
  startDateIso: string;
  endDateIso: string;
  satisfiedPercentage: number; // 0 to 100
  recognizedAmountCents: number;
  deferredAmountCents: number;
}

export interface RevenueContract {
  contractId: string;
  tenantId: string;
  customerId: string;
  totalTransactionPrice: CurrencyAmount;
  currency: CurrencyCode;
  createdAtIso: string;
  obligations: PerformanceObligation[];
}

export interface RecognitionScheduleEntry {
  periodId: string; // YYYY-MM
  obligationId: string;
  recognizedAmountCents: number;
  remainingDeferredCents: number;
  recognitionDateIso: string;
}

export class RevenueRecognitionEngine {
  /**
   * Evaluates IFRS 15 / ASC 606 Step 4 (Allocation) & Step 5 (Recognition Schedule Generation)
   */
  public createContractWithObligations(
    tenantId: string,
    customerId: string,
    totalTransactionPrice: CurrencyAmount,
    items: Array<{
      description: string;
      standalonePriceCents: number;
      method: RecognitionMethod;
      startDateIso: string;
      endDateIso: string;
    }>
  ): { contract: RevenueContract; schedule: RecognitionScheduleEntry[] } {
    const totalStandaloneCents = items.reduce((sum, item) => sum + item.standalonePriceCents, 0);

    // Step 4: Pro-rata relative standalone selling price allocation
    const obligations: PerformanceObligation[] = items.map((item, index) => {
      const ratio = totalStandaloneCents > 0 ? item.standalonePriceCents / totalStandaloneCents : 1 / items.length;
      const allocatedCents = Math.round(totalTransactionPrice.amountCents * ratio);

      return {
        obligationId: `obl_${Date.now()}_${index}`,
        description: item.description,
        standalonePrice: new CurrencyAmount(item.standalonePriceCents, totalTransactionPrice.currency),
        allocatedPrice: new CurrencyAmount(allocatedCents, totalTransactionPrice.currency),
        method: item.method,
        startDateIso: item.startDateIso,
        endDateIso: item.endDateIso,
        satisfiedPercentage: 0,
        recognizedAmountCents: 0,
        deferredAmountCents: allocatedCents
      };
    });

    const contract: RevenueContract = {
      contractId: `rev_cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      customerId,
      totalTransactionPrice,
      currency: totalTransactionPrice.currency,
      createdAtIso: new Date().toISOString(),
      obligations
    };

    // Step 5: Generate Ratable Recognition Schedule
    const schedule = this.generateRecognitionSchedule(contract);

    return { contract, schedule };
  }

  public generateRecognitionSchedule(contract: RevenueContract): RecognitionScheduleEntry[] {
    const schedule: RecognitionScheduleEntry[] = [];

    for (const obl of contract.obligations) {
      if (obl.method === "IMMEDIATE" || obl.method === "POINT_IN_TIME") {
        const periodId = obl.startDateIso.substring(0, 7); // YYYY-MM
        schedule.push({
          periodId,
          obligationId: obl.obligationId,
          recognizedAmountCents: obl.allocatedPrice.amountCents,
          remainingDeferredCents: 0,
          recognitionDateIso: obl.startDateIso
        });
      } else if (obl.method === "RATABLE_MONTHLY") {
        const start = new Date(obl.startDateIso);
        const end = new Date(obl.endDateIso);

        const monthsCount = Math.max(
          1,
          (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
        );

        const monthlyRecognizedCents = Math.floor(obl.allocatedPrice.amountCents / monthsCount);
        let remainingDeferredCents = obl.allocatedPrice.amountCents;

        for (let i = 0; i < monthsCount; i++) {
          const currentMonthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
          const periodId = currentMonthDate.toISOString().substring(0, 7); // YYYY-MM

          const isLastMonth = i === monthsCount - 1;
          const toRecognize = isLastMonth ? remainingDeferredCents : monthlyRecognizedCents;
          remainingDeferredCents -= toRecognize;

          schedule.push({
            periodId,
            obligationId: obl.obligationId,
            recognizedAmountCents: toRecognize,
            remainingDeferredCents: Math.max(0, remainingDeferredCents),
            recognitionDateIso: currentMonthDate.toISOString()
          });
        }
      }
    }

    return schedule;
  }
}
