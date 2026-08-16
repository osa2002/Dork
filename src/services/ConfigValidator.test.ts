import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigValidator } from "./ConfigValidator";

describe("ConfigValidator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates default development configuration with valid: true and no fatal errors", () => {
    const result = ConfigValidator.validate({ silent: true });
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("detects invalid PORT environment variables", () => {
    const originalPort = process.env.PORT;
    try {
      process.env.PORT = "invalid_port";
      const result = ConfigValidator.validate({ silent: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("PORT env variable must be a valid number"))).toBe(true);
    } finally {
      process.env.PORT = originalPort;
    }
  });

  it("detects SMTP mismatched credentials when host is defined", () => {
    const originalHost = process.env.SMTP_HOST;
    const originalUser = process.env.SMTP_USER;
    try {
      process.env.SMTP_HOST = "smtp.mailgun.org";
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const result = ConfigValidator.validate({ silent: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("SMTP configuration mismatch"))).toBe(true);
    } finally {
      if (originalHost) process.env.SMTP_HOST = originalHost;
      else delete process.env.SMTP_HOST;
      if (originalUser) process.env.SMTP_USER = originalUser;
    }
  });
});
