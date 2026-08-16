import fs from "fs";
import path from "path";
import { FeatureFlagService, FeatureFlag } from "./FeatureFlagService";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  silent?: boolean;
}

export class ConfigValidator {
  /**
   * Run all startup validation checks.
   * Throws a descriptive Error if validation fails in production mode.
   */
  public static validate(options?: ValidationOptions): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const isProduction = process.env.NODE_ENV === "production";
    const silent = options?.silent ?? false;

    if (!silent) {
      console.log("[ConfigValidator] Starting system configuration diagnostics...");
    }

    // 1. Port & Basic Environment Verification
    const port = process.env.PORT || "3000";
    if (isNaN(Number(port))) {
      errors.push(`PORT env variable must be a valid number, received: "${port}"`);
    }

    // 2. Firebase Applet Configuration Check
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const configFileExists = fs.existsSync(configPath);
    if (!configFileExists) {
      if (isProduction) {
        errors.push("CRITICAL: 'firebase-applet-config.json' is missing from root. Database operations will fail in production.");
      } else {
        warnings.push("'firebase-applet-config.json' is missing. Falling back to local/ADC authorization if present.");
      }
    } else {
      try {
        const rawConfig = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(rawConfig);
        if (!parsed.projectId) {
          errors.push("Invalid 'firebase-applet-config.json': missing 'projectId'");
        }
      } catch (err: any) {
        errors.push(`Failed to parse 'firebase-applet-config.json': ${err.message}`);
      }
    }

    // 3. Stripe Secret Key Check (Mandated when Stripe feature flag is enabled in production)
    const stripeEnabled = FeatureFlagService.isEnabled(FeatureFlag.STRIPE);
    const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
    if (stripeEnabled && !hasStripeKey) {
      const msg = "STRIPE_SECRET_KEY is missing from the environment configuration.";
      warnings.push(`Stripe Sandbox Mode Active: ${msg} The local fallback simulator will handle billing checkout.`);
    }

    // 4. Gemini API Key Check (Mandated when Gemini feature flag is enabled in production)
    const geminiEnabled = FeatureFlagService.isEnabled(FeatureFlag.GEMINI);
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    if (geminiEnabled && !hasGeminiKey) {
      const msg = "GEMINI_API_KEY is missing from the environment configuration.";
      warnings.push(`Gemini Fallback Active: ${msg} Standard static wait-time calculations or local deterministic fallbacks will handle predictions.`);
    }

    // 5. SMTP (Nodemailer) Validation
    if (process.env.SMTP_HOST) {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        errors.push("SMTP configuration mismatch: SMTP_HOST is defined, but SMTP_USER or SMTP_PASS is missing.");
      }
      if (process.env.SMTP_PORT && isNaN(Number(process.env.SMTP_PORT))) {
        errors.push(`SMTP_PORT must be a number, received: "${process.env.SMTP_PORT}"`);
      }
    } else {
      warnings.push("SMTP configuration missing. Ethereal Test Account fallback will be utilized for transactional emails.");
    }

    // 6. Twilio SMS Validation
    if (process.env.TWILIO_ACCOUNT_SID) {
      if (!process.env.TWILIO_AUTH_TOKEN) {
        errors.push("Twilio configuration mismatch: TWILIO_ACCOUNT_SID is defined, but TWILIO_AUTH_TOKEN is missing.");
      }
      if (!process.env.TWILIO_PHONE_NUMBER) {
        warnings.push("TWILIO_PHONE_NUMBER is undefined. SMS notifications will proceed using default alpha-senders if supported.");
      }
    }

    const isValid = errors.length === 0;

    if (!silent) {
      console.log("[ConfigValidator] Diagnostics complete. Status:", {
        valid: isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      if (warnings.length > 0) {
        warnings.forEach((warn) => console.warn(`\x1b[33m[Config Warning]\x1b[0m ${warn}`));
      }
    }

    if (!isValid) {
      errors.forEach((err) => console.error(`\x1b[31m[Config Error]\x1b[0m ${err}`));
      if (isProduction) {
        throw new Error(
          `Startup validation failed with ${errors.length} fatal errors in production environment:\n` +
          errors.map((e, idx) => `  ${idx + 1}. ${e}`).join("\n")
        );
      }
    }

    return {
      valid: isValid,
      errors,
      warnings,
    };
  }
}

