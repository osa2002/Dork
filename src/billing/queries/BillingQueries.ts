export interface GetBillingAccountQuery {
  tenantId: string;
}

export interface GetActiveSubscriptionQuery {
  tenantId: string;
}

export interface GetInvoiceHistoryQuery {
  tenantId: string;
  statusFilter?: string;
  limit?: number;
  offset?: number;
}

export interface GetPaymentStatusQuery {
  tenantId: string;
  paymentIntentId: string;
}

export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}
