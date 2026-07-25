import { DeviceTrustProfile, DeviceTrustScore } from "../value-objects/IamValueObjects";

export interface ActiveSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  deviceProfile: DeviceTrustProfile;
  issuedAtIso: string;
  expiresAtIso: string;
  lastActiveAtIso: string;
  isMfaVerified: boolean;
  mfaTypeUsed?: "TOTP" | "PASSKEY_WEBAUTHN" | "SMS";
  isRevoked: boolean;
}

export class SessionManager {
  private activeSessions: Map<string, ActiveSession> = new Map();
  private revokedSessionIds: Set<string> = new Set();

  public createSession(
    userId: string,
    tenantId: string,
    deviceProfile: DeviceTrustProfile,
    isMfaVerified: boolean = false,
    mfaTypeUsed?: "TOTP" | "PASSKEY_WEBAUTHN" | "SMS",
    ttlHours: number = 8
  ): ActiveSession {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const session: ActiveSession = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      tenantId,
      deviceProfile,
      issuedAtIso: now.toISOString(),
      expiresAtIso: expiresAt.toISOString(),
      lastActiveAtIso: now.toISOString(),
      isMfaVerified,
      mfaTypeUsed,
      isRevoked: false
    };

    this.activeSessions.set(session.sessionId, session);
    return session;
  }

  public validateSession(sessionId: string): { isValid: boolean; session?: ActiveSession; error?: string } {
    if (this.revokedSessionIds.has(sessionId)) {
      return { isValid: false, error: "Session has been explicitly revoked" };
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { isValid: false, error: "Session not found" };
    }

    if (session.isRevoked) {
      return { isValid: false, error: "Session is marked revoked" };
    }

    const now = new Date();
    if (new Date(session.expiresAtIso) < now) {
      return { isValid: false, error: "Session expired" };
    }

    // Update last active timestamp
    session.lastActiveAtIso = now.toISOString();

    return { isValid: true, session };
  }

  public revokeSession(sessionId: string): void {
    this.revokedSessionIds.add(sessionId);
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isRevoked = true;
    }
  }

  public revokeAllUserSessions(userId: string): void {
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId) {
        session.isRevoked = true;
        this.revokedSessionIds.add(session.sessionId);
      }
    }
  }

  public evaluateDeviceTrust(
    ipAddress: string,
    userAgent: string,
    isEncrypted: boolean,
    isEdrActive: boolean
  ): DeviceTrustProfile {
    let score: DeviceTrustScore = "UNKNOWN";

    if (isEncrypted && isEdrActive) {
      score = "MANAGED_ENTERPRISE";
    } else if (isEncrypted) {
      score = "COMPLIANT";
    } else {
      score = "UNTRUSTED";
    }

    return {
      deviceId: `dev_${Math.random().toString(36).substring(2, 9)}`,
      deviceOs: userAgent.includes("Macintosh") ? "macOS" : userAgent.includes("Windows") ? "Windows" : "Linux",
      browser: userAgent.includes("Chrome") ? "Chrome" : userAgent.includes("Safari") ? "Safari" : "Firefox",
      ipAddress,
      isDiskEncrypted: isEncrypted,
      isEdrActive: isEdrActive,
      trustScore: score,
      lastVerifiedAtIso: new Date().toISOString()
    };
  }
}
