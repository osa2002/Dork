import { ChaosState } from "../ChaosState";

export interface BlastRadiusReport {
  blastRadiusPercentage: number; // 0 - 100
  impactLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedServices: string[];
  affectedRepositories: string[];
  affectedEndpoints: string[];
  affectedDependencies: string[];
  explanation: string;
}

export class ChaosImpactAnalyzer {
  /**
   * Compiles and calculates the dynamic runtime blast radius of active chaos experiments.
   */
  public static calculateBlastRadius(): BlastRadiusReport {
    if (!ChaosState.getIsEnabled()) {
      return {
        blastRadiusPercentage: 0,
        impactLevel: "NONE",
        affectedServices: [],
        affectedRepositories: [],
        affectedEndpoints: [],
        affectedDependencies: [],
        explanation: "No active chaos is configured. Blast radius is zero.",
      };
    }

    const activeScenarios = ChaosState.getActiveScenarios();
    const globalLatency = ChaosState.getLatency();
    const probability = ChaosState.getProbability();

    const services = new Set<string>();
    const repositories = new Set<string>();
    const endpoints = new Set<string>();
    const dependencies = new Set<string>();

    let maxBaseImpact = 0;
    const explanations: string[] = [];

    // Analyze specific active experiments
    if (activeScenarios.length > 0) {
      for (const s of activeScenarios) {
        const lower = s.toLowerCase();

        if (lower.includes("kill") || lower.includes("cold_start") || lower.includes("instance")) {
          maxBaseImpact = Math.max(maxBaseImpact, 95);
          services.add("ExpressWebGateway");
          services.add("ShutdownManager");
          endpoints.add("ALL");
          dependencies.add("CloudRunRuntime");
          explanations.push("Simulates full container interruption and scale-down.");
        } 
        else if (lower.includes("partition") || lower.includes("blackout")) {
          maxBaseImpact = Math.max(maxBaseImpact, 90);
          services.add("ExpressWebGateway");
          services.add("QueueProcessing");
          repositories.add("ShopsRepository");
          repositories.add("TicketsRepository");
          endpoints.add("/api/tickets/create");
          endpoints.add("/api/stripe/create-checkout-session");
          endpoints.add("/api/stripe/verify-session");
          dependencies.add("Firestore");
          dependencies.add("StripeAPI");
          dependencies.add("GeminiAI");
          dependencies.add("TwilioSMS");
          explanations.push("Complete disconnection from database and dependencies.");
        }
        else if (lower.includes("database") || lower.includes("firestore") || lower.includes("contention") || lower.includes("transaction")) {
          maxBaseImpact = Math.max(maxBaseImpact, 70);
          repositories.add("ShopsRepository");
          repositories.add("TicketsRepository");
          endpoints.add("/api/tickets/create");
          dependencies.add("Firestore");
          explanations.push("Restricts ticket persistence and critical transaction lookups.");
        }
        else if (lower.includes("stripe")) {
          maxBaseImpact = Math.max(maxBaseImpact, 40);
          repositories.add("InvoicesRepository");
          endpoints.add("/api/stripe/create-checkout-session");
          endpoints.add("/api/stripe/verify-session");
          dependencies.add("StripeAPI");
          explanations.push("Payment gateway and subscription upgrading is degraded.");
        }
        else if (lower.includes("gemini")) {
          maxBaseImpact = Math.max(maxBaseImpact, 35);
          endpoints.add("/api/estimate-wait-time");
          endpoints.add("/api/analyze-queue");
          endpoints.add("/api/ai-diagnose");
          dependencies.add("GeminiAI");
          explanations.push("Wait time predictions and analytics fallback to local deterministic rules.");
        }
        else if (lower.includes("twilio") || lower.includes("notification")) {
          maxBaseImpact = Math.max(maxBaseImpact, 25);
          services.add("NotificationService");
          dependencies.add("TwilioSMS");
          explanations.push("Real-time notifications and alerts fail to dispatch.");
        }
        else if (lower.includes("pressure") || lower.includes("cpu") || lower.includes("memory") || lower.includes("loop")) {
          maxBaseImpact = Math.max(maxBaseImpact, 55);
          services.add("ExpressWebGateway");
          endpoints.add("ALL");
          explanations.push("Global resource pressure causing high response latency.");
        }
        else if (lower.includes("cleanup") || lower.includes("scheduler") || lower.includes("cron")) {
          maxBaseImpact = Math.max(maxBaseImpact, 20);
          services.add("CronScheduler");
          endpoints.add("/api/cron/cleanup");
          explanations.push("Yesterday's tickets fail to purge/archive, causing DB inflation.");
        }
        else if (lower.includes("rate_limit") || lower.includes("limit")) {
          maxBaseImpact = Math.max(maxBaseImpact, 30);
          endpoints.add("ALL");
          explanations.push("Clients experience denial-of-service blockages (HTTP 429).");
        }
        else if (lower.includes("auth") || lower.includes("unauthorized")) {
          maxBaseImpact = Math.max(maxBaseImpact, 45);
          services.add("AuthService");
          endpoints.add("ALL (except public routes)");
          explanations.push("Token validation errors block incoming customer or vendor requests.");
        }
      }
    } else if (globalLatency > 0) {
      maxBaseImpact = globalLatency > 2000 ? 40 : 15;
      endpoints.add("ALL");
      explanations.push(`Artificial latency delay of ${globalLatency}ms added globally.`);
    }

    // Multiply by probability to capture "effective blast radius"
    const blastRadiusPercentage = Math.round(maxBaseImpact * probability);

    let impactLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "NONE";
    if (blastRadiusPercentage > 80) impactLevel = "CRITICAL";
    else if (blastRadiusPercentage > 50) impactLevel = "HIGH";
    else if (blastRadiusPercentage > 20) impactLevel = "MEDIUM";
    else if (blastRadiusPercentage > 0) impactLevel = "LOW";

    const explanation = explanations.length > 0 
      ? explanations.join(" ") 
      : `Nominal blast radius under low priority latency adjustments.`;

    return {
      blastRadiusPercentage,
      impactLevel,
      affectedServices: Array.from(services),
      affectedRepositories: Array.from(repositories),
      affectedEndpoints: Array.from(endpoints),
      affectedDependencies: Array.from(dependencies),
      explanation,
    };
  }
}
