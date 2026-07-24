export class ChaosConfig {
  public static readonly AUTH_HEADER = "x-chaos-auth";
  public static readonly AUTH_TOKEN_ENV = process.env.CHAOS_AUTH_TOKEN || "dork-chaos-secret-2026";

  // Chaos-specific incoming headers (TASK 4)
  public static readonly HEADERS = {
    LATENCY: "x-chaos-latency",
    MODE: "x-chaos-mode",
    FAILURE: "x-chaos-failure",
    PROBABILITY: "x-chaos-probability",
    DELAY: "x-chaos-delay",
    TARGET: "x-chaos-target",
  };

  /**
   * Chaos mode gates: Node environment must not be production AND CHAOS_MODE must be true
   */
  public static isGateApproved(): boolean {
    const isNotProduction = process.env.NODE_ENV !== "production";
    const isChaosEnabled = process.env.CHAOS_MODE === "true";
    return isNotProduction && isChaosEnabled;
  }

  /**
   * Check if the Internal Authorization Header is present and matches
   */
  public static isAuthorized(headers: Record<string, any>): boolean {
    const incomingToken = headers[this.AUTH_HEADER] || headers["authorization"];
    if (!incomingToken) return false;

    // Support both direct token and "Bearer <token>"
    const cleanToken = incomingToken.toString().startsWith("Bearer ")
      ? incomingToken.toString().slice(7)
      : incomingToken.toString();

    return cleanToken === this.AUTH_TOKEN_ENV;
  }
}
