import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";
import { WorkflowDefinition } from "../domain/WorkflowDefinition";
import { WorkflowInstance } from "../domain/WorkflowInstance";

export class FirestoreWorkflowRepository {
  private readonly db = getAdminFirestoreDb();

  public async saveDefinition(def: WorkflowDefinition): Promise<void> {
    const docRef = this.db
      .collection("tenants")
      .doc(def.tenantId)
      .collection("workflow_definitions")
      .doc(def.workflowId);

    await docRef.set(def, { merge: true });
  }

  public async getDefinition(tenantId: string, workflowId: string): Promise<WorkflowDefinition | null> {
    const doc = await this.db
      .collection("tenants")
      .doc(tenantId)
      .collection("workflow_definitions")
      .doc(workflowId)
      .get();

    if (!doc.exists) return null;
    return doc.data() as WorkflowDefinition;
  }

  public async saveInstance(instance: WorkflowInstance): Promise<void> {
    const docRef = this.db
      .collection("tenants")
      .doc(instance.tenantId)
      .collection("workflow_instances")
      .doc(instance.instanceId);

    await docRef.set(instance, { merge: true });
  }

  public async getInstance(tenantId: string, instanceId: string): Promise<WorkflowInstance | null> {
    const doc = await this.db
      .collection("tenants")
      .doc(tenantId)
      .collection("workflow_instances")
      .doc(instanceId)
      .get();

    if (!doc.exists) return null;
    return doc.data() as WorkflowInstance;
  }

  public async listInstances(tenantId: string, limitCount: number = 50): Promise<WorkflowInstance[]> {
    const snapshot = await this.db
      .collection("tenants")
      .doc(tenantId)
      .collection("workflow_instances")
      .limit(limitCount)
      .get();

    return snapshot.docs.map(doc => doc.data() as WorkflowInstance);
  }
}
