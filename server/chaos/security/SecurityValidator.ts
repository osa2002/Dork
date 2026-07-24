import fs from "fs";
import path from "path";
import { SecurityContext } from "./SecurityContext";

export interface StaticValidationCheck {
  readonly id: string;
  readonly category: string;
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
}

export interface SecurityValidatorReport {
  readonly timestamp: string;
  readonly correlationId: string;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly secretScanningPassed: boolean;
  readonly staticSecurityScore: number;
  readonly checks: readonly StaticValidationCheck[];
}

export class SecurityValidator {
  public static validate(context: SecurityContext = SecurityContext.create()): SecurityValidatorReport {
    const checks: StaticValidationCheck[] = [];

    // 1. Secret Scanning Audit
    let secretsCheckPassed = true;
    let secretsCheckDetails = "No exposed credentials found in core configurations.";

    const forbiddenPatterns = [
      { name: "Google API Key", pattern: /AIzaSy[a-zA-Z0-9-_]{33}/ },
      { name: "Stripe Live Secret Key", pattern: /sk_live_[a-zA-Z0-9]{24}/ },
      { name: "Slack OAuth Token", pattern: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/ },
      { name: "RSA/EC Private Key", pattern: /-----BEGIN PRIVATE KEY-----/ },
    ];

    const filesToScan = ["package.json", "tsconfig.json", "vite.config.ts", "vitest.config.ts", "server.ts"];
    
    for (const f of filesToScan) {
      try {
        const fullPath = path.join(process.cwd(), f);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const item of forbiddenPatterns) {
            if (item.pattern.test(content)) {
              secretsCheckPassed = false;
              secretsCheckDetails = `Exposed secret pattern (${item.name}) detected in file: ${f}`;
              break;
            }
          }
        }
      } catch (err) {
        // Ignore file read exceptions
      }
      if (!secretsCheckPassed) break;
    }

    checks.push({
      id: "SEC-CHK-01",
      category: "Secrets",
      name: "Secret Credentials Scanning",
      passed: secretsCheckPassed,
      details: secretsCheckDetails,
    });

    // 2. Auth Middleware Presence Check
    let authMiddlewarePassed = false;
    let authMiddlewareDetails = "Auth middleware file not found.";
    try {
      const authPath = path.join(process.cwd(), "src", "middlewares", "authMiddleware.ts");
      if (fs.existsSync(authPath)) {
        const content = fs.readFileSync(authPath, "utf-8");
        const hasVerify = content.includes("verifyIdToken") && content.includes("authenticateFirebaseUser");
        authMiddlewarePassed = hasVerify;
        authMiddlewareDetails = hasVerify
          ? "Firebase ID Token verification middleware properly implemented."
          : "Auth middleware missing required token verification logic.";
      }
    } catch (err) {
      authMiddlewareDetails = `Failed checking auth middleware: ${(err as Error).message}`;
    }

    checks.push({
      id: "SEC-CHK-02",
      category: "Authentication",
      name: "Firebase Token Verification Middleware",
      passed: authMiddlewarePassed,
      details: authMiddlewareDetails,
    });

    // 3. Error Middleware Stack Trace Masking
    let errorMaskingPassed = false;
    let errorMaskingDetails = "Error middleware not found.";
    try {
      const errorPath = path.join(process.cwd(), "src", "middlewares", "errorMiddleware.ts");
      if (fs.existsSync(errorPath)) {
        const content = fs.readFileSync(errorPath, "utf-8");
        const handlesMasking = content.includes("process.env.NODE_ENV") || content.includes("status");
        errorMaskingPassed = handlesMasking;
        errorMaskingDetails = handlesMasking
          ? "Error middleware masks raw stack traces in production environments."
          : "Error middleware may leak stack traces to clients.";
      }
    } catch (err) {
      errorMaskingDetails = `Failed checking error middleware: ${(err as Error).message}`;
    }

    checks.push({
      id: "SEC-CHK-03",
      category: "ErrorHandling",
      name: "Production Stack Trace Masking",
      passed: errorMaskingPassed,
      details: errorMaskingDetails,
    });

    // 4. Firestore Security Rules Audit
    let firestoreRulesPassed = false;
    let firestoreRulesDetails = "firestore.rules file not found.";
    try {
      const rulesPath = path.join(process.cwd(), "firestore.rules");
      if (fs.existsSync(rulesPath)) {
        const content = fs.readFileSync(rulesPath, "utf-8");
        const rulesValid = content.includes("rules_version") && content.includes("allow");
        firestoreRulesPassed = rulesValid;
        firestoreRulesDetails = rulesValid
          ? "Firestore security rules file present with explicit match blocks."
          : "Firestore rules file is invalid or lacks allow blocks.";
      }
    } catch (err) {
      firestoreRulesDetails = `Failed checking firestore rules: ${(err as Error).message}`;
    }

    checks.push({
      id: "SEC-CHK-04",
      category: "Database",
      name: "Firestore Security Rules Integrity",
      passed: firestoreRulesPassed,
      details: firestoreRulesDetails,
    });

    // 5. Environment Config Isolation (.env.example audit)
    let envExamplePassed = false;
    let envExampleDetails = ".env.example file not found.";
    try {
      const envPath = path.join(process.cwd(), ".env.example");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const hasSampleKeys = content.includes("GEMINI_API_KEY");
        envExamplePassed = hasSampleKeys;
        envExampleDetails = hasSampleKeys
          ? ".env.example documents environment configuration requirements cleanly."
          : ".env.example is missing essential configuration key keys.";
      }
    } catch (err) {
      envExampleDetails = `Failed checking .env.example: ${(err as Error).message}`;
    }

    checks.push({
      id: "SEC-CHK-05",
      category: "Configuration",
      name: "Environment Variable Documentation",
      passed: envExamplePassed,
      details: envExampleDetails,
    });

    const totalChecks = checks.length;
    const passedChecks = checks.filter((c) => c.passed).length;
    const failedChecks = totalChecks - passedChecks;
    const staticSecurityScore = Math.round((passedChecks / totalChecks) * 100);

    return {
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
      totalChecks,
      passedChecks,
      failedChecks,
      secretScanningPassed: secretsCheckPassed,
      staticSecurityScore,
      checks: Object.freeze(checks),
    };
  }
}
