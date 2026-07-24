export type EnforcementMode = "enforce" | "audit";
export type EnvironmentTier = "production" | "staging" | "development";

export interface UserClaims {
  uid: string;
  email?: string;
  role?: string;
  shopId?: string;
  isDemo?: boolean;
  claims?: Record<string, any>;
}

export interface SecurityContextConfig {
  environment?: EnvironmentTier;
  correlationId?: string;
  enforcementMode?: EnforcementMode;
  user?: UserClaims;
  securityLevel?: "STRICT" | "STANDARD" | "RELAXED";
  timestamp?: string;
}

export class SecurityContext {
  public readonly environment: EnvironmentTier;
  public readonly correlationId: string;
  public readonly enforcementMode: EnforcementMode;
  public readonly user: UserClaims;
  public readonly securityLevel: "STRICT" | "STANDARD" | "RELAXED";
  public readonly timestamp: string;

  constructor(config: SecurityContextConfig = {}) {
    this.environment = config.environment || (process.env.NODE_ENV as EnvironmentTier) || "production";
    this.correlationId = config.correlationId || `sec-${Math.random().toString(36).substring(2, 9)}`;
    this.enforcementMode = config.enforcementMode || "enforce";
    this.securityLevel = config.securityLevel || "STRICT";
    this.timestamp = config.timestamp || new Date().toISOString();
    this.user = Object.freeze({
      uid: config.user?.uid || "system-internal",
      email: config.user?.email || "system@dork-enterprise.internal",
      role: config.user?.role || "SUPER_ADMIN",
      shopId: config.user && "shopId" in config.user ? config.user.shopId : "system-root",
      isDemo: config.user?.isDemo || false,
      claims: Object.freeze(config.user?.claims || {}),
    });

    Object.freeze(this);
  }

  public static create(config?: SecurityContextConfig): SecurityContext {
    return new SecurityContext(config);
  }

  public static createAnonymous(): SecurityContext {
    return new SecurityContext({
      user: {
        uid: "anonymous",
        email: "anonymous@public.user",
        role: "ANONYMOUS",
        shopId: undefined,
      },
    });
  }
}
