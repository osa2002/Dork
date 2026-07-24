/**
 * Enterprise Platform Administration - Feature Flag Engine
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Evaluates system feature flags, tenant level overrides, emergency kill-switches, and role-based rollouts.
 */

import { AdminFirebaseSDK } from "./AdminFirebaseSDK";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { AdminAuditLogger } from "./AdminAuditLogger";
import { IAdminIdentity } from "../permissions/adminPermissions";

export interface IPlatformFeatureFlagRule {
  flagKey: string;
  description: string;
  enabledGlobal: boolean;
  allowedRoles?: string[];
  tenantOverrides?: Record<string, boolean>;
  percentageRollout?: number; // 0 to 100
  updatedBy: string;
  updatedAt: string;
}

export class AdminFeatureFlagEngine {
  private static collectionName = "admin_feature_flags";
  private static inMemoryCache: Map<string, IPlatformFeatureFlagRule> = new Map();
  private static lastFetchMs = 0;
  private static CACHE_TTL_MS = 30 * 1000; // 30s cache TTL for high throughput

  /**
   * Evaluates if a feature flag is enabled for a given tenant context or admin role.
   */
  public static async isFeatureEnabled(
    flagKey: string,
    context?: { tenantId?: string; role?: string }
  ): Promise<boolean> {
    const flag = await this.getFlagRule(flagKey);
    if (!flag) {
      return false;
    }

    // 1. Tenant explicit override takes highest precedence
    if (context?.tenantId && flag.tenantOverrides && flag.tenantOverrides[context.tenantId] !== undefined) {
      return flag.tenantOverrides[context.tenantId];
    }

    // 2. Global master switch disabled
    if (!flag.enabledGlobal) {
      return false;
    }

    // 3. Role restriction check
    if (context?.role && flag.allowedRoles && flag.allowedRoles.length > 0) {
      if (!flag.allowedRoles.includes(context.role)) {
        return false;
      }
    }

    // 4. Percentage rollout calculation
    if (flag.percentageRollout !== undefined && flag.percentageRollout < 100) {
      if (!context?.tenantId) return flag.percentageRollout > 0;
      const hash = this.simpleHash(`${flagKey}:${context.tenantId}`);
      return hash % 100 < flag.percentageRollout;
    }

    return true;
  }

  /**
   * Updates or sets a platform feature flag with full security auditing.
   */
  public static async setFeatureFlagRule(
    rule: Omit<IPlatformFeatureFlagRule, "updatedAt">,
    actor: IAdminIdentity
  ): Promise<IPlatformFeatureFlagRule> {
    const fullRule: IPlatformFeatureFlagRule = {
      ...rule,
      updatedBy: actor.email,
      updatedAt: new Date().toISOString()
    };

    const beforeState = await this.getFlagRule(rule.flagKey);

    const db = AdminFirebaseSDK.getInstance().getFirestore();
    await db.collection(this.collectionName).doc(rule.flagKey).set(fullRule);

    // Evict local cache
    this.inMemoryCache.set(rule.flagKey, fullRule);

    // Audit feature flag change
    await AdminAuditLogger.record({
      actor,
      action: "UPDATE_FEATURE_FLAG",
      targetResourceType: "FEATURE_FLAG",
      targetResourceId: rule.flagKey,
      beforeState: beforeState || null,
      afterState: fullRule,
      ipAddress: "127.0.0.1",
      userAgent: "AdminEngine",
      severity: "WARNING"
    });

    AdminStructuredLogger.info(`[AdminFeatureFlagEngine] Feature flag '${rule.flagKey}' updated by ${actor.email}`);

    return fullRule;
  }

  private static async getFlagRule(flagKey: string): Promise<IPlatformFeatureFlagRule | null> {
    const now = Date.now();
    if (now - this.lastFetchMs < this.CACHE_TTL_MS && this.inMemoryCache.has(flagKey)) {
      return this.inMemoryCache.get(flagKey) || null;
    }

    try {
      const db = AdminFirebaseSDK.getInstance().getFirestore();
      const doc = await db.collection(this.collectionName).doc(flagKey).get();
      if (!doc.exists) {
        return null;
      }
      const rule = doc.data() as IPlatformFeatureFlagRule;
      this.inMemoryCache.set(flagKey, rule);
      this.lastFetchMs = now;
      return rule;
    } catch (err: any) {
      AdminStructuredLogger.error(`[AdminFeatureFlagEngine] Failed to fetch flag '${flagKey}'`, err);
      return null;
    }
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
