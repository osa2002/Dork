import { DomainEvent } from "../../../billing/domain-events/DomainEvent";

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

export class DomainEventPublisher {
  private static instance: DomainEventPublisher;
  private handlers: Map<string, Set<EventHandler>> = new Map();

  public static getInstance(): DomainEventPublisher {
    if (!DomainEventPublisher.instance) {
      DomainEventPublisher.instance = new DomainEventPublisher();
    }
    return DomainEventPublisher.instance;
  }

  public subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler as EventHandler);
  }

  public unsubscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    const existing = this.handlers.get(eventName);
    if (existing) {
      existing.delete(handler as EventHandler);
    }
  }

  public async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventName);
    if (eventHandlers) {
      const promises = Array.from(eventHandlers).map(handler => {
        try {
          return Promise.resolve(handler(event));
        } catch (err) {
          console.error(`[DomainEventPublisher] Error executing handler for '${event.eventName}':`, err);
          return Promise.resolve();
        }
      });
      await Promise.all(promises);
    }
  }

  public async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  public clearAllSubscriptions(): void {
    this.handlers.clear();
  }
}
