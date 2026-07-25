import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";
import { OrganizationNode, UserRoleBinding } from "../domain/OrgHierarchy";
import { RoleDefinition } from "../rbac/RbacEngine";
import { AbacPolicyRule, SsoConfiguration } from "../value-objects/IamValueObjects";

export class FirestoreIamRepository {
  private readonly db = getAdminFirestoreDb();

  public async saveOrganization(org: OrganizationNode): Promise<void> {
    const docRef = this.db.collection("tenants").doc(org.tenantId).collection("organization_hierarchy").doc(org.orgId);
    await docRef.set(org, { merge: true });
  }

  public async getOrganization(tenantId: string, orgId: string): Promise<OrganizationNode | null> {
    const doc = await this.db.collection("tenants").doc(tenantId).collection("organization_hierarchy").doc(orgId).get();
    if (!doc.exists) return null;
    return doc.data() as OrganizationNode;
  }

  public async saveRoleBinding(binding: UserRoleBinding): Promise<void> {
    const docRef = this.db.collection("tenants").doc(binding.tenantId).collection("role_bindings").doc(binding.bindingId);
    await docRef.set(binding);
  }

  public async getUserRoleBindings(tenantId: string, userId: string): Promise<UserRoleBinding[]> {
    const snapshot = await this.db
      .collection("tenants")
      .doc(tenantId)
      .collection("role_bindings")
      .where("userId", "==", userId)
      .get();

    return snapshot.docs.map(doc => doc.data() as UserRoleBinding);
  }

  public async saveCustomRole(role: RoleDefinition): Promise<void> {
    const docRef = this.db.collection("tenants").doc(role.tenantId).collection("custom_roles").doc(role.roleId);
    await docRef.set(role);
  }

  public async saveAbacPolicyRule(tenantId: string, rule: AbacPolicyRule): Promise<void> {
    const docRef = this.db.collection("tenants").doc(tenantId).collection("abac_policies").doc(rule.ruleId);
    await docRef.set(rule);
  }

  public async saveSsoConfig(config: SsoConfiguration): Promise<void> {
    const docRef = this.db.collection("tenants").doc(config.tenantId).collection("sso_configs").doc(config.ssoId);
    await docRef.set(config);
  }
}
