export type TransactionIsolationLevel = "READ_COMMITTED" | "REPEATABLE_READ" | "SERIALIZABLE";
export type TransactionStatus = "PENDING" | "EXECUTING" | "COMMITTED" | "ROLLED_BACK" | "FAILED" | "TIMED_OUT";

export interface TransactionAttemptRecord {
  attemptNumber: number;
  timestamp: string;
  durationMs: number;
  status: "SUCCESS" | "FAILED";
  error?: string;
  operationsCount: number;
}

export interface TransactionSnapshot {
  path: string;
  beforeData: any;
  afterData?: any;
  capturedAt: string;
}

export class TransactionContext {
  public readonly transactionId: string;
  public readonly correlationId: string;
  public readonly tenantId: string;
  public readonly isolationLevel: TransactionIsolationLevel;
  public readonly createdAt: string;
  
  private _status: TransactionStatus = "PENDING";
  private _attempts: TransactionAttemptRecord[] = [];
  private _snapshots: TransactionSnapshot[] = [];
  private _operationsExecuted: string[] = [];
  private _metadata: Record<string, any> = {};
  private _startTimeMs: number;
  private _endTimeMs?: number;

  constructor(options: {
    transactionId?: string;
    correlationId?: string;
    tenantId?: string;
    isolationLevel?: TransactionIsolationLevel;
    metadata?: Record<string, any>;
  } = {}) {
    this.transactionId = options.transactionId || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.correlationId = options.correlationId || `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.tenantId = options.tenantId || "default";
    this.isolationLevel = options.isolationLevel || "SERIALIZABLE";
    this.createdAt = new Date().toISOString();
    this._metadata = { ...(options.metadata || {}) };
    this._startTimeMs = Date.now();
  }

  public get status(): TransactionStatus {
    return this._status;
  }

  public setStatus(status: TransactionStatus): void {
    this._status = status;
    if (status === "COMMITTED" || status === "ROLLED_BACK" || status === "FAILED" || status === "TIMED_OUT") {
      this._endTimeMs = Date.now();
    }
  }

  public get durationMs(): number {
    return (this._endTimeMs || Date.now()) - this._startTimeMs;
  }

  public get attempts(): readonly TransactionAttemptRecord[] {
    return [...this._attempts];
  }

  public get currentAttemptCount(): number {
    return this._attempts.length;
  }

  public get snapshots(): readonly TransactionSnapshot[] {
    return [...this._snapshots];
  }

  public get operationsExecuted(): readonly string[] {
    return [...this._operationsExecuted];
  }

  public get metadata(): Record<string, any> {
    return { ...this._metadata };
  }

  public recordAttempt(record: TransactionAttemptRecord): void {
    this._attempts.push(record);
  }

  public addSnapshot(snapshot: TransactionSnapshot): void {
    this._snapshots.push(snapshot);
  }

  public markOperationExecuted(operationId: string): void {
    this._operationsExecuted.push(operationId);
  }

  public setMetadata(key: string, value: any): void {
    this._metadata[key] = value;
  }

  public toJSON(): Record<string, any> {
    return {
      transactionId: this.transactionId,
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      isolationLevel: this.isolationLevel,
      status: this._status,
      createdAt: this.createdAt,
      durationMs: this.durationMs,
      attemptsCount: this._attempts.length,
      attempts: this._attempts,
      operationsExecuted: this._operationsExecuted,
      snapshotsCount: this._snapshots.length,
      metadata: this._metadata,
    };
  }
}
