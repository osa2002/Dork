export type AtomicOperationType = "READ" | "WRITE" | "UPDATE" | "DELETE" | "CHECK";

export type ConditionPredicate = (currentData: any) => boolean | Promise<boolean>;
export type CompensatingAction = (context: any) => Promise<void> | void;

export interface AtomicOperationSpec<T = any> {
  id?: string;
  type: AtomicOperationType;
  targetPath: string;
  payload?: T;
  condition?: ConditionPredicate;
  compensatingAction?: CompensatingAction;
  idempotencyKey?: string;
}

export interface OperationExecutionResult {
  operationId: string;
  type: AtomicOperationType;
  targetPath: string;
  success: boolean;
  beforeData?: any;
  afterData?: any;
  executedAt: string;
  error?: string;
}

export class AtomicOperation<T = any> {
  public readonly id: string;
  public readonly type: AtomicOperationType;
  public readonly targetPath: string;
  public readonly payload?: T;
  public readonly condition?: ConditionPredicate;
  public readonly compensatingAction?: CompensatingAction;
  public readonly idempotencyKey?: string;

  private _result?: OperationExecutionResult;

  constructor(spec: AtomicOperationSpec<T>) {
    if (!spec.targetPath || spec.targetPath.trim() === "") {
      throw new Error("AtomicOperation requires a valid non-empty targetPath");
    }
    this.id = spec.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.type = spec.type;
    this.targetPath = spec.targetPath;
    this.payload = spec.payload;
    this.condition = spec.condition;
    this.compensatingAction = spec.compensatingAction;
    this.idempotencyKey = spec.idempotencyKey;
  }

  public get result(): OperationExecutionResult | undefined {
    return this._result;
  }

  public setResult(result: OperationExecutionResult): void {
    this._result = result;
  }

  public static read(targetPath: string, id?: string): AtomicOperation {
    return new AtomicOperation({ id, type: "READ", targetPath });
  }

  public static write<T>(targetPath: string, payload: T, options: Partial<AtomicOperationSpec<T>> = {}): AtomicOperation<T> {
    return new AtomicOperation<T>({ ...options, type: "WRITE", targetPath, payload });
  }

  public static update<T>(targetPath: string, payload: T, options: Partial<AtomicOperationSpec<T>> = {}): AtomicOperation<T> {
    return new AtomicOperation<T>({ ...options, type: "UPDATE", targetPath, payload });
  }

  public static delete(targetPath: string, options: Partial<AtomicOperationSpec> = {}): AtomicOperation {
    return new AtomicOperation({ ...options, type: "DELETE", targetPath });
  }

  public static check(targetPath: string, condition: ConditionPredicate, id?: string): AtomicOperation {
    return new AtomicOperation({ id, type: "CHECK", targetPath, condition });
  }
}
