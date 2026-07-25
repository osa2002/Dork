import { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { TransactionException } from "../exceptions/InfrastructureExceptions";

export class FirestoreTransactionManager {
  private readonly db: Firestore;

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Runs an operation inside a native Firestore transaction.
   */
  public async runTransaction<T>(
    updateFunction: (transaction: Transaction) => Promise<T>,
    maxAttempts: number = 5
  ): Promise<T> {
    try {
      return await this.db.runTransaction(
        async (transaction) => {
          return await updateFunction(transaction);
        },
        { maxAttempts }
      );
    } catch (err: any) {
      throw new TransactionException(
        `Firestore transaction execution failed: ${err.message || String(err)}`,
        err
      );
    }
  }
}
