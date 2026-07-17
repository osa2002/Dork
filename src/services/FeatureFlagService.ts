export enum FeatureFlag {
  GEMINI = "gemini",
  STRIPE = "stripe",
  SMS = "sms",
  EMAIL = "email",
  NOTIFICATIONS = "notifications",
  ANALYTICS = "analytics",
  EXPERIMENTAL = "experimental"
}

export class FeatureFlagService {
  private static flags: Record<FeatureFlag, boolean> = {
    [FeatureFlag.GEMINI]: true,
    [FeatureFlag.STRIPE]: true,
    [FeatureFlag.SMS]: true,
    [FeatureFlag.EMAIL]: true,
    [FeatureFlag.NOTIFICATIONS]: true,
    [FeatureFlag.ANALYTICS]: true,
    [FeatureFlag.EXPERIMENTAL]: false, // Disabled by default in production
  };

  private static runtimeOverrides = new Map<string, boolean>();

  static {
    // Initialize defaults from environment variables if present
    this.initializeFromEnv();
  }

  /**
   * Loads flag configuration from process.env overrides
   */
  private static initializeFromEnv() {
    Object.values(FeatureFlag).forEach((flag) => {
      const envKey = `FEATURE_FLAG_${flag.toUpperCase()}`;
      if (process.env[envKey] !== undefined) {
        const val = process.env[envKey]?.trim().toLowerCase();
        this.flags[flag] = val === "true" || val === "1";
      }
    });
  }

  /**
   * Check if a feature flag is enabled
   */
  public static isEnabled(flag: FeatureFlag | string): boolean {
    const flagKey = flag.toLowerCase() as FeatureFlag;
    
    // 1. Check runtime memory overrides (simulates Remote Config dynamic push)
    if (this.runtimeOverrides.has(flagKey)) {
      return this.runtimeOverrides.get(flagKey) === true;
    }

    // 2. Check static config (defaults + env)
    if (this.flags[flagKey] !== undefined) {
      return this.flags[flagKey];
    }

    // 3. Fallback for unrecognized/experimental flags
    return false;
  }

  /**
   * Set a runtime flag override (useful for dynamic administration/Remote Config syncing)
   */
  public static setOverride(flag: FeatureFlag | string, enabled: boolean) {
    const flagKey = flag.toLowerCase();
    this.runtimeOverrides.set(flagKey, enabled);
    console.log(`[FeatureFlagService] Flag override applied: '${flagKey}' = ${enabled}`);
  }

  /**
   * Clear a specific runtime override or all overrides
   */
  public static clearOverride(flag?: FeatureFlag | string) {
    if (flag) {
      const flagKey = flag.toLowerCase();
      this.runtimeOverrides.delete(flagKey);
      console.log(`[FeatureFlagService] Flag override cleared for '${flagKey}'`);
    } else {
      this.runtimeOverrides.clear();
      console.log(`[FeatureFlagService] All flag overrides cleared`);
    }
  }

  /**
   * Return the complete list of flags and their resolved states
   */
  public static getAllFlags(): Record<string, boolean> {
    const resolved: Record<string, boolean> = {};
    
    Object.values(FeatureFlag).forEach((flag) => {
      resolved[flag] = this.isEnabled(flag);
    });

    // Also include any custom runtime overrides
    this.runtimeOverrides.forEach((val, key) => {
      resolved[key] = val;
    });

    return resolved;
  }
}
