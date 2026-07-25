import { DomainEvent } from "../domain-events/DomainEvent";
import { Money } from "../value-objects/Money";
import { TaxIdentifier } from "../value-objects/TaxIdentifier";
import { BillingPeriod } from "../value-objects/BillingPeriod";
import { TaxCalculationResult } from "../services/TaxDomainService";
import { ProrationCalculationResult } from "../services/ProrationService";

export interface IBillingUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IDomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

export interface ITaxCalculatorContract {
  calculateTax(subtotal: Money, countryCode: string, taxIdentifier?: TaxIdentifier): TaxCalculationResult;
}

export interface IProrationCalculatorContract {
  calculateProration(
    currentPeriod: BillingPeriod,
    oldUnitPrice: Money,
    oldQuantity: number,
    newUnitPrice: Money,
    newQuantity: number,
    changeDate?: Date
  ): ProrationCalculationResult;
}
