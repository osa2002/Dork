import { ScimUserPayload, SsoConfiguration, SsoProtocol } from "../value-objects/IamValueObjects";

export interface ProvisionedUserRecord {
  userId: string;
  tenantId: string;
  externalScimId: string;
  userName: string;
  email: string;
  givenName: string;
  familyName: string;
  department?: string;
  isActive: boolean;
  provisionedAtIso: string;
  updatedAtIso: string;
}

export class SsoScimEngine {
  private ssoConfigs: Map<string, SsoConfiguration> = new Map();
  private scimUsers: Map<string, ProvisionedUserRecord> = new Map();

  public registerSsoConfig(tenantId: string, protocol: SsoProtocol, issuerUrl: string, endpointUrl: string): SsoConfiguration {
    const config: SsoConfiguration = {
      ssoId: `sso_${tenantId}_${Date.now()}`,
      tenantId,
      protocol,
      issuerUrl,
      ssoEndpointUrl: endpointUrl,
      isEnabled: true,
      autoProvisionUsers: true,
      defaultRoleId: "role_developer"
    };

    this.ssoConfigs.set(tenantId, config);
    return config;
  }

  public getSsoConfig(tenantId: string): SsoConfiguration | undefined {
    return this.ssoConfigs.get(tenantId);
  }

  // --- SCIM 2.0 Protocol Endpoints Handlers ---

  public processScimCreateUser(tenantId: string, payload: ScimUserPayload): ProvisionedUserRecord {
    const primaryEmail = payload.emails.find(e => e.primary)?.value || payload.emails[0]?.value || `${payload.userName}@example.com`;

    const userRecord: ProvisionedUserRecord = {
      userId: `usr_${tenantId}_${Date.now()}`,
      tenantId,
      externalScimId: payload.externalId || payload.userName,
      userName: payload.userName,
      email: primaryEmail,
      givenName: payload.name.givenName,
      familyName: payload.name.familyName,
      department: payload.department,
      isActive: payload.active,
      provisionedAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString()
    };

    this.scimUsers.set(`${tenantId}_${userRecord.externalScimId}`, userRecord);
    return userRecord;
  }

  public processScimUpdateUser(tenantId: string, externalScimId: string, updates: Partial<ScimUserPayload>): ProvisionedUserRecord {
    const key = `${tenantId}_${externalScimId}`;
    const existing = this.scimUsers.get(key);
    if (!existing) {
      throw new Error(`SCIM 2.0 Exception: User with external ID ${externalScimId} not found under tenant ${tenantId}`);
    }

    if (updates.active !== undefined) existing.isActive = updates.active;
    if (updates.department !== undefined) existing.department = updates.department;
    existing.updatedAtIso = new Date().toISOString();

    return existing;
  }

  public processScimDeprovisionUser(tenantId: string, externalScimId: string): void {
    const key = `${tenantId}_${externalScimId}`;
    const existing = this.scimUsers.get(key);
    if (existing) {
      existing.isActive = false;
      existing.updatedAtIso = new Date().toISOString();
    }
  }
}
