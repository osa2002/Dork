export interface MfaEnrollment {
  userId: string;
  totpSecret?: string;
  isTotpEnabled: boolean;
  passkeys: Array<{
    credentialId: string;
    publicKeyPem: string;
    counter: number;
    nickname: string;
    enrolledAtIso: string;
  }>;
  backupCodes: string[];
}

export interface WebAuthnChallenge {
  challengeId: string;
  userId: string;
  challengeHex: string;
  expiresAtIso: string;
}

export class MfaPasskeyManager {
  private enrollments: Map<string, MfaEnrollment> = new Map();
  private activeChallenges: Map<string, WebAuthnChallenge> = new Map();

  public getOrCreateEnrollment(userId: string): MfaEnrollment {
    if (!this.enrollments.has(userId)) {
      this.enrollments.set(userId, {
        userId,
        isTotpEnabled: false,
        passkeys: [],
        backupCodes: this.generateBackupCodes()
      });
    }
    return this.enrollments.get(userId)!;
  }

  public enrollTotpSecret(userId: string): { secret: string; qrCodeUrl: string } {
    const enrollment = this.getOrCreateEnrollment(userId);
    const secret = this.generateRandomBase32Secret();
    enrollment.totpSecret = secret;
    enrollment.isTotpEnabled = false; // requires verification step to enable

    return {
      secret,
      qrCodeUrl: `otpauth://totp/DorkPlatform:${userId}?secret=${secret}&issuer=DorkEnterprise`
    };
  }

  public verifyTotpAndEnable(userId: string, code: string): boolean {
    const enrollment = this.getOrCreateEnrollment(userId);
    if (!enrollment.totpSecret) return false;

    // Simulate 6-digit TOTP verification logic
    if (code.length === 6 && /^\d+$/.test(code)) {
      enrollment.isTotpEnabled = true;
      return true;
    }
    return false;
  }

  public createPasskeyChallenge(userId: string): WebAuthnChallenge {
    const challenge: WebAuthnChallenge = {
      challengeId: `chal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      challengeHex: this.generateRandomHex(32),
      expiresAtIso: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min expiry
    };

    this.activeChallenges.set(challenge.challengeId, challenge);
    return challenge;
  }

  public verifyPasskeyAssertion(
    userId: string,
    challengeId: string,
    credentialId: string,
    signatureHex: string
  ): boolean {
    const challenge = this.activeChallenges.get(challengeId);
    if (!challenge) return false;

    if (new Date(challenge.expiresAtIso) < new Date()) {
      this.activeChallenges.delete(challengeId);
      return false;
    }

    const enrollment = this.getOrCreateEnrollment(userId);
    const passkey = enrollment.passkeys.find(p => p.credentialId === credentialId);

    // If enrolling new passkey
    if (!passkey && signatureHex.length >= 16) {
      enrollment.passkeys.push({
        credentialId,
        publicKeyPem: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE...",
        counter: 1,
        nickname: "Default Security Key",
        enrolledAtIso: new Date().toISOString()
      });
      this.activeChallenges.delete(challengeId);
      return true;
    } else if (passkey) {
      passkey.counter++;
      this.activeChallenges.delete(challengeId);
      return true;
    }

    return false;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(this.generateRandomHex(8).toUpperCase());
    }
    return codes;
  }

  private generateRandomBase32Secret(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let res = "";
    for (let i = 0; i < 16; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  }

  private generateRandomHex(length: number): string {
    let result = "";
    const hexChars = "0123456789abcdef";
    for (let i = 0; i < length; i++) {
      result += hexChars[Math.floor(Math.random() * 16)];
    }
    return result;
  }
}
