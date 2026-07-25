export interface CreateBillingAccountCommand {
  tenantId: string;
  companyName: string;
  billingEmail: string;
  taxNumber?: string;
  taxType?: "VAT" | "GST" | "EIN" | "CUSTOM";
  countryCode?: string;
}

export interface ICommandHandler<TCommand, TResult> {
  handle(command: TCommand): Promise<TResult>;
}
