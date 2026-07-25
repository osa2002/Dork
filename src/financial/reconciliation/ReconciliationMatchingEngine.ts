import { CurrencyCode } from "../value-objects/FinancialValueObjects";

export interface ProviderStatementItem {
  statementItemId: string;
  providerId: string; // e.g. "stripe", "paypal", "adyen"
  externalTransactionId: string;
  payoutId?: string;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  currency: CurrencyCode;
  transactionDateIso: string;
  type: "CHARGE" | "REFUND" | "DISPUTE" | "FEE" | "PAYOUT";
}

export interface InternalLedgerItem {
  ledgerEntryId: string;
  tenantId: string;
  paymentIntentId: string;
  grossAmountCents: number;
  expectedFeeCents: number;
  currency: CurrencyCode;
  createdAtIso: string;
}

export type MatchStatus = "EXACT_MATCH" | "VARIANCE_MATCH" | "UNMATCHED_INTERNAL" | "UNMATCHED_PROVIDER" | "DISCREPANCY_FLAGGED";

export interface ReconciliationResult {
  reconciliationId: string;
  tenantId: string;
  providerId: string;
  totalGrossInternalCents: number;
  totalGrossProviderCents: number;
  matchedCount: number;
  unmatchedInternalCount: number;
  unmatchedProviderCount: number;
  discrepanciesCount: number;
  matches: Array<{
    internalEntryId: string;
    statementItemId: string;
    status: MatchStatus;
    grossDifferenceCents: number;
    feeDifferenceCents: number;
    notes?: string;
  }>;
  unmatchedInternal: InternalLedgerItem[];
  unmatchedProvider: ProviderStatementItem[];
}

export class ReconciliationMatchingEngine {
  public reconcileBatch(
    tenantId: string,
    providerId: string,
    internalItems: InternalLedgerItem[],
    statementItems: ProviderStatementItem[],
    allowedFeeVarianceCents: number = 50 // $0.50 tolerance
  ): ReconciliationResult {
    const matches: ReconciliationResult["matches"] = [];
    const unmatchedInternal: InternalLedgerItem[] = [];
    const matchedStatementIds = new Set<string>();

    let totalGrossInternal = 0;
    let totalGrossProvider = 0;

    for (const statementItem of statementItems) {
      totalGrossProvider += statementItem.grossAmountCents;
    }

    for (const internal of internalItems) {
      totalGrossInternal += internal.grossAmountCents;

      // Search for corresponding statement item by external transaction ID or gross amount + timing
      const statementMatch = statementItems.find(
        st =>
          !matchedStatementIds.has(st.statementItemId) &&
          (st.externalTransactionId === internal.paymentIntentId ||
            (st.grossAmountCents === internal.grossAmountCents && st.currency === internal.currency))
      );

      if (!statementMatch) {
        unmatchedInternal.push(internal);
        continue;
      }

      matchedStatementIds.add(statementMatch.statementItemId);

      const grossDiff = Math.abs(internal.grossAmountCents - statementMatch.grossAmountCents);
      const feeDiff = Math.abs(internal.expectedFeeCents - statementMatch.feeAmountCents);

      let status: MatchStatus = "EXACT_MATCH";
      let notes: string | undefined;

      if (grossDiff > 0) {
        status = "DISCREPANCY_FLAGGED";
        notes = `Gross amount mismatch: internal ${internal.grossAmountCents} vs statement ${statementMatch.grossAmountCents}`;
      } else if (feeDiff > allowedFeeVarianceCents) {
        status = "VARIANCE_MATCH";
        notes = `Fee variance exceeds threshold: internal ${internal.expectedFeeCents} vs statement ${statementMatch.feeAmountCents}`;
      }

      matches.push({
        internalEntryId: internal.ledgerEntryId,
        statementItemId: statementMatch.statementItemId,
        status,
        grossDifferenceCents: grossDiff,
        feeDifferenceCents: feeDiff,
        notes
      });
    }

    const unmatchedProvider = statementItems.filter(st => !matchedStatementIds.has(st.statementItemId));

    const matchedCount = matches.filter(m => m.status === "EXACT_MATCH" || m.status === "VARIANCE_MATCH").length;
    const discrepanciesCount = matches.filter(m => m.status === "DISCREPANCY_FLAGGED").length;

    return {
      reconciliationId: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      providerId,
      totalGrossInternalCents: totalGrossInternal,
      totalGrossProviderCents: totalGrossProvider,
      matchedCount,
      unmatchedInternalCount: unmatchedInternal.length,
      unmatchedProviderCount: unmatchedProvider.length,
      discrepanciesCount,
      matches,
      unmatchedInternal,
      unmatchedProvider
    };
  }
}
