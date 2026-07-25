export type SystemRole = "SUPER_ADMIN" | "ORG_ADMIN" | "FINANCE_ADMIN" | "BILLING_MANAGER" | "DEVELOPER" | "AUDITOR" | "CUSTOM";

export type PermissionAction = "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE" | "EXECUTE" | "ADMINISTER";

export type PermissionResource = "BILLING" | "PAYMENTS" | "REFUNDS" | "RECONCILIATION" | "REVENUE" | "ORGANIZATION" | "USERS" | "SESSIONS" | "AUDIT_LOGS" | "SYSTEM";

export interface Permission {
  permissionId: string;
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
}

export interface AttributeCondition {
  attributeKey: string; // e.g. "user.department", "resource.amount", "environment.ipAddress"
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "GREATER_THAN" | "LESS_THAN" | "IN_LIST" | "MATCHES_REGEX";
  targetValue: any;
}

export type AbacEffect = "ALLOW" | "DENY";

export interface AbacPolicyRule {
  ruleId: string;
  name: string;
  description: string;
  effect: AbacEffect;
  resource: PermissionResource;
  action: PermissionAction;
  conditions: AttributeCondition[];
  priority: number; // Higher number = higher evaluation precedence
}

export type DeviceTrustScore = "UNKNOWN" | "UNTRUSTED" | "COMPLIANT" | "MANAGED_ENTERPRISE";

export interface DeviceTrustProfile {
  deviceId: string;
  deviceOs: string;
  browser: string;
  ipAddress: string;
  isDiskEncrypted: boolean;
  isEdrActive: boolean;
  trustScore: DeviceTrustScore;
  lastVerifiedAtIso: string;
}

export type SsoProtocol = "SAML_2_0" | "OIDC" | "AZURE_AD_ENTRA" | "OKTA" | "GOOGLE_WORKSPACE";

export interface SsoConfiguration {
  ssoId: string;
  tenantId: string;
  protocol: SsoProtocol;
  issuerUrl: string;
  ssoEndpointUrl: string;
  certificatePem?: string;
  clientId?: string;
  clientSecretEncrypted?: string;
  isEnabled: boolean;
  autoProvisionUsers: boolean;
  defaultRoleId: string;
}

export interface ScimUserPayload {
  externalId: string;
  userName: string;
  name: { givenName: string; familyName: string };
  emails: Array<{ value: string; primary: boolean }>;
  active: boolean;
  department?: string;
  title?: string;
}
