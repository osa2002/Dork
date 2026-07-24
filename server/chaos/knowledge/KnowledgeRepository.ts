import { KnowledgeRecord } from "./KnowledgeRecord";
import { KnowledgeIndex } from "./KnowledgeIndex";

export class KnowledgeRepository {
  private static records: KnowledgeRecord[] = [];
  private static maxCapacity = 100; // configurable limit, SRE standard default

  /**
   * Appends an immutable KnowledgeRecord to the repository.
   * Automatically enforces bounded capacity and keeps the KnowledgeIndex perfectly in-sync.
   */
  public static add(record: KnowledgeRecord): void {
    // Enforce immutability
    const immutableRecord = Object.freeze({
      ...record,
      tags: Object.freeze([...record.tags]),
      metadata: Object.freeze({ ...record.metadata }),
    });

    this.records.unshift(immutableRecord);
    this.enforceBoundedCapacity();
    this.syncIndex();
  }

  /**
   * Retrieves the current historical list of normalized knowledge records.
   */
  public static getAll(): readonly KnowledgeRecord[] {
    return this.records;
  }

  /**
   * Retrieves a single record by its ID.
   */
  public static getById(id: string): KnowledgeRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Configures the maximum capacity of the in-memory repository.
   * If the current capacity is higher, oldest records are truncated.
   */
  public static setCapacityLimit(limit: number): void {
    if (limit < 1) {
      throw new Error("Capacity limit must be at least 1.");
    }
    this.maxCapacity = limit;
    this.enforceBoundedCapacity();
    this.syncIndex();
  }

  /**
   * Retrieves the current capacity limit.
   */
  public static getCapacityLimit(): number {
    return this.maxCapacity;
  }

  /**
   * Clears the historical logs and resets the indexes.
   */
  public static clear(): void {
    this.records = [];
    this.syncIndex();
  }

  /**
   * Truncates oldest records automatically to prevent memory leaks in long-running runtimes.
   */
  private static enforceBoundedCapacity(): void {
    while (this.records.length > this.maxCapacity) {
      this.records.pop();
    }
  }

  /**
   * Syncs the lightweight search indexes.
   */
  private static syncIndex(): void {
    KnowledgeIndex.rebuild(this.records);
  }
}
