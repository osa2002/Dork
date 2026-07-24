import { ChaosState } from "./ChaosState";
import { AppError } from "../../src/errors/CustomErrors";

export interface ChaosScenarioContext {
  req: any;
  res: any;
  next: any;
  target?: string;
  latencyMs?: number;
  failureType?: string;
}

export interface IChaosScenario {
  name: string;
  description: string;
  run(context: ChaosScenarioContext): Promise<void>;
}

/**
 * 1. LatencyScenario - Introduces artificial request delay
 */
export class LatencyScenario implements IChaosScenario {
  public name = "LatencyScenario";
  public description = "Simulates network latency and database slowness";

  public async run(context: ChaosScenarioContext): Promise<void> {
    const delay = context.latencyMs !== undefined ? context.latencyMs : ChaosState.getLatency() || 1000;
    ChaosState.incrementMetric("chaos_latency_added", delay);
    
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      ChaosState.registerTimer(timer);
    });
  }
}

/**
 * 2. DatabaseFailureScenario - Simulates Firestore backend errors and timeouts
 */
export class DatabaseFailureScenario implements IChaosScenario {
  public name = "DatabaseFailureScenario";
  public description = "Simulates Firestore service unavailability or timeout";

  public async run(context: ChaosScenarioContext): Promise<void> {
    const failureType = context.failureType || "firestore_timeout";
    
    if (failureType === "firestore_timeout") {
      throw new AppError(
        503,
        "Firestore Timeout Simulation",
        "The query to Firestore timed out after 1500ms (Simulated Chaos)"
      );
    } else {
      throw new AppError(
        500,
        "Firestore Unavailability Simulation",
        "Firestore backend database is temporarily unavailable (Simulated Chaos)"
      );
    }
  }
}

/**
 * 3. DependencyFailureScenario - Simulates Stripe, Twilio, Gemini, etc. API failures
 */
export class DependencyFailureScenario implements IChaosScenario {
  public name = "DependencyFailureScenario";
  public description = "Simulates external third-party API timeout and failures";

  public async run(context: ChaosScenarioContext): Promise<void> {
    const failureType = context.failureType || "stripe_timeout";

    if (failureType === "stripe_timeout") {
      throw new AppError(
        504,
        "Stripe API Timeout",
        "Stripe checkout request timed out after 10000ms (Simulated Chaos)"
      );
    } else if (failureType === "twilio_timeout") {
      throw new AppError(
        504,
        "Twilio SMS Timeout",
        "Twilio notification gateway timed out (Simulated Chaos)"
      );
    } else if (failureType === "gemini_timeout") {
      throw new AppError(
        504,
        "Gemini API Timeout",
        "Google GenAI quota exhausted or model request timed out (Simulated Chaos)"
      );
    } else {
      throw new AppError(
        502,
        "External Gateway Error",
        "External dependency returned an invalid upstream response (Simulated Chaos)"
      );
    }
  }
}

/**
 * 4. CleanupFailureScenario - Simulates cron cleanup failures
 */
export class CleanupFailureScenario implements IChaosScenario {
  public name = "CleanupFailureScenario";
  public description = "Simulates artificial failures in background database cleanup";

  public async run(context: ChaosScenarioContext): Promise<void> {
    throw new AppError(
      500,
      "Cleanup Failure Simulation",
      "Database cleanup failed to archive and purge yesterday's tickets (Simulated Chaos)"
    );
  }
}

/**
 * 5. SchedulerFailureScenario - Simulates cron scheduler delays
 */
export class SchedulerFailureScenario implements IChaosScenario {
  public name = "SchedulerFailureScenario";
  public description = "Simulates delays or starvation in scheduler execution loops";

  public async run(context: ChaosScenarioContext): Promise<void> {
    // Delay scheduler execution by blocking/sleeping for a set duration
    const delay = 3000; // 3 seconds delay
    ChaosState.incrementMetric("chaos_latency_added", delay);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      ChaosState.registerTimer(timer);
    });
  }
}

/**
 * 6. TransactionFailureScenario - Simulates concurrent transaction friction/contention
 */
export class TransactionFailureScenario implements IChaosScenario {
  public name = "TransactionFailureScenario";
  public description = "Simulates Firestore concurrent contention and transaction aborts";

  public async run(context: ChaosScenarioContext): Promise<void> {
    throw new AppError(
      409,
      "Firestore Contention",
      "Aborting transaction due to high concurrent write contention on shop document (Simulated Chaos)"
    );
  }
}

/**
 * 7. RateLimitScenario - Simulates API client rate limit triggers (HTTP 429)
 */
export class RateLimitScenario implements IChaosScenario {
  public name = "RateLimitScenario";
  public description = "Simulates too many client requests (HTTP 429)";

  public async run(context: ChaosScenarioContext): Promise<void> {
    throw new AppError(
      429,
      "Too Many Requests",
      "Too many requests from this IP. Rate limit exceeded (Simulated Chaos)"
    );
  }
}

/**
 * 8. AuthenticationFailureScenario - Simulates Firebase Auth verification failure (HTTP 401)
 */
export class AuthenticationFailureScenario implements IChaosScenario {
  public name = "AuthenticationFailureScenario";
  public description = "Simulates invalid or expired identity tokens (HTTP 401)";

  public async run(context: ChaosScenarioContext): Promise<void> {
    throw new AppError(
      401,
      "Unauthorized",
      "Firebase ID token has expired or is invalid (Simulated Chaos)"
    );
  }
}
