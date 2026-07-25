export type PeriodStatus = "OPEN" | "CLOSING" | "CLOSED" | "AUDITED";

export interface PeriodCloseValidationResult {
  canClose: boolean;
  unreconciledStatementsCount: number;
  pendingOutboxEventsCount: number;
  unapprovedRefundRequestsCount: number;
  warnings: string[];
  blockers: string[];
}

export interface FinancialPeriod {
  periodId: string; // YYYY-MM
  tenantId: string;
  startDateIso: string;
  endDateIso: string;
  status: PeriodStatus;
  closedAtIso?: string;
  closedByUserId?: string;
  closingSnapshotHash?: string;
}

export class PeriodClosingEngine {
  public validatePeriodForClose(
    unreconciledStatementsCount: number,
    pendingOutboxEventsCount: number,
    unapprovedRefundRequestsCount: number
  ): PeriodCloseValidationResult {
    const warnings: string[] = [];
    const blockers: string[] = [];

    if (unreconciledStatementsCount > 0) {
      blockers.push(`Cannot close financial period with ${unreconciledStatementsCount} unreconciled statement line items.`);
    }

    if (pendingOutboxEventsCount > 0) {
      blockers.push(`Cannot close financial period with ${pendingOutboxEventsCount} unprocessed transactional outbox events.`);
    }

    if (unapprovedRefundRequestsCount > 0) {
      warnings.push(`There are ${unapprovedRefundRequestsCount} pending refund authorization requests awaiting manager approval.`);
    }

    return {
      canClose: blockers.length === 0,
      unreconciledStatementsCount,
      pendingOutboxEventsCount,
      unapprovedRefundRequestsCount,
      warnings,
      blockers
    };
  }

  public initiatePeriodClose(period: FinancialPeriod): FinancialPeriod {
    if (period.status !== "OPEN") {
      throw new Error(`Cannot initiate period close: period ${period.periodId} status is currently ${period.status}`);
    }

    return {
      ...period,
      status: "CLOSING"
    };
  }

  public finalizePeriodClose(period: FinancialPeriod, userId: string, snapshotHash: string): FinancialPeriod {
    if (period.status !== "CLOSING") {
      throw new Error(`Cannot finalize period close: period ${period.periodId} must be in CLOSING state (currently ${period.status})`);
    }

    return {
      ...period,
      status: "CLOSED",
      closedAtIso: new Date().toISOString(),
      closedByUserId: userId,
      closingSnapshotHash: snapshotHash
    };
  }

  public assertPeriodIsOpen(period: FinancialPeriod, targetTransactionDateIso: string): void {
    if (period.status === "CLOSED" || period.status === "AUDITED") {
      throw new Error(
        `Financial Period Lock Exception: Transaction date ${targetTransactionDateIso} falls in period ${period.periodId} which is immutable and CLOSED.`
      );
    }
  }
}
