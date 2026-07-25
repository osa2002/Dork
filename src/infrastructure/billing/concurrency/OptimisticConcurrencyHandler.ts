import { Transaction, DocumentReference } from "firebase-admin/firestore";
import { OptimisticLockException } from "../exceptions/InfrastructureExceptions";

export class OptimisticConcurrencyHandler {
  /**
   * Validates version inside a Firestore transaction before writing updates.
   * If document exists, verifies stored version matches expected prior version.
   */
  public static async validateAndStageWrite<T extends { version: number }>(
    transaction: Transaction,
    docRef: DocumentReference,
    newData: T
  ): Promise<void> {
    const snap = await transaction.get(docRef);

    if (snap.exists) {
      const existingData = snap.data();
      const currentStoredVersion = existingData?.version || 1;
      const expectedPriorVersion = newData.version - 1;

      if (currentStoredVersion !== expectedPriorVersion && currentStoredVersion !== newData.version) {
        throw new OptimisticLockException(
          docRef.parent.id,
          docRef.id,
          expectedPriorVersion,
          currentStoredVersion
        );
      }
    }

    transaction.set(docRef, newData, { merge: true });
  }
}
