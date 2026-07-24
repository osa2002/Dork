# Enterprise Chaos Engineering Infrastructure (Dork Enterprise Platform)

Welcome to the Enterprise Chaos Engineering module of the Dork Enterprise Platform. This module provides a highly isolated, safe, and controlled runtime failure injection environment to validate platform resilience, verify self-healing behaviors, and audit service-level objectives (SLOs) under degraded conditions.

---

## 1. System Architecture

The Chaos Engineering infrastructure is completely decoupled from standard core business logic. No core services, controllers, or database helpers contain hardcoded chaos conditions. Instead, chaos is injected transparently via an asynchronous HTTP request middleware pipeline.

```
Incoming Request (Staging/Sandbox)
       │
       ▼
┌─────────────────────────────────────────┐
│     Express Chaos Middleware Gate       │  ◄─── Filters out Production Environment
└─────────────────────────────────────────┘
       │ (Gate approved, Token Authorized)
       ▼
┌─────────────────────────────────────────┐
│       Chaos Scenario Router             │  ◄─── Matches URL target patterns
└─────────────────────────────────────────┘
       │ (Matches e.g. /api/tickets)
       ▼
┌─────────────────────────────────────────┐
│       Seeded Probability Engine         │  ◄─── Seeded LCG Roll (e.g. 25% chance)
└─────────────────────────────────────────┘
       │ (Roll evaluation = true)
       ▼
┌─────────────────────────────────────────┐
│       Failure Scenario Execution        │  ◄─── Executes matching IChaosScenario
└─────────────────────────────────────────┘
       │
       ▼
Thrown AppError / Injected Delay -> Handled by standard global handler
```

### Module Components
- **`ChaosState.ts`**: Holds the volatile in-memory state of Chaos Mode, metrics, targets, and active scenario lists. It houses the deterministic seeded random engine.
- **`ChaosConfig.ts`**: Enforces strict environmental gates, API headers, and internal authentication checks.
- **`ChaosRegistry.ts`**: Standard registry mapping available scenario classes (`IChaosScenario`) and managing shutdown hook callbacks.
- **`ChaosScenarios.ts`**: Implements concrete scenario classes covering database contention, transient network timeouts, rate limits, dependency outages, and latency injections.
- **`ChaosMiddleware.ts`**: The runtime interceptor evaluating request paths, parsing headers, selecting probabilities, and coordinating injection runs.
- **`ChaosController.ts`**: The control plane API controller allowing DevOps and reliability teams to query state, adjust parameters, and reset chaos properties.

---

## 2. Production Guarantees & Safety Policies

To prevent accidental production outages, the Chaos module is built with **multi-layered failsafe guards**:

1. **Environment Gate**: Chaos mode **cannot** run in production. If `NODE_ENV === "production"`, the middleware instantly halts execution and passes through as a no-op (byte-for-byte identical to a non-chaos deployment).
2. **Flag Gate**: The module requires the explicit environment variable setting `CHAOS_MODE=true` to load.
3. **Internal Auth Gate**: Requests must present a valid internal authentication token via the header `X-Chaos-Auth` or standard `Authorization: Bearer <token>` matching `CHAOS_AUTH_TOKEN`.
4. **Shutdown Protection**: All chaos timers (timeouts, intervals, delayed runs) are managed by `ChaosState` and registered with the core platform `ShutdownManager` to prevent memory leaks and blocking locks during graceful scaling.

---

## 3. Supported Scenarios

| Scenario / Injector | Failure Target | Simulated Response / Effect |
| :--- | :--- | :--- |
| **`LatencyScenario`** | Any Endpoint / Service | Introduces artificial connection delay via asynchronous non-blocking timers. |
| **`DatabaseFailureScenario`** | Firestore | Simulates database outages, socket timeouts, and unavailable errors. |
| **`DependencyFailureScenario`**| Third-Party APIs | Simulates Stripe Checkout timeouts, Twilio Gateway errors, or Gemini LLM model exhaustion. |
| **`CleanupFailureScenario`** | Background Cron Jobs | Simulates errors during daily database purges and ticket archiving. |
| **`SchedulerFailureScenario`** | Event Loops / Cron | Imposes latency starvation on task scheduler execution windows. |
| **`TransactionFailureScenario`**| Transactions | Injects concurrency conflicts causing standard transactions to abort and trigger retry exhaustion tests. |
| **`RateLimitScenario`** | Client Limits | Immediately returns HTTP 429 Too Many Requests. |
| **`AuthenticationFailureScenario`**| Auth Gates | Simulates invalid, forged, or expired Firebase ID tokens (HTTP 401). |

---

## 4. Activation & Request Headers

To run ad-hoc chaos injection on an authorized request, send the following request headers:

* **`X-Chaos-Auth`**: Matches `CHAOS_AUTH_TOKEN` (Required to authorize).
* **`X-Chaos-Failure`**: Set to failure type (`latency`, `firestore_timeout`, `stripe_timeout`, `twilio_timeout`, `gemini_timeout`, `firestore_contention`, `rate_limit`, `auth_failure`).
* **`X-Chaos-Probability`**: Overrides the default trigger probability (Supported values: `0%`, `10%`, `25%`, `50%`, `75%`, `100%`).
* **`X-Chaos-Latency`** or **`X-Chaos-Delay`**: Injected delay in milliseconds.
* **`X-Chaos-Target`**: Endpoints to restrict (e.g. `/api/tickets`).

---

## 5. Control Plane REST Endpoints

### 5.1 Query Dashboard State
* **Method**: `GET`
* **Path**: `/api/chaos/state`
* **Headers**: `X-Chaos-Auth: <token>`
* **Response**:
```json
{
  "enabled": true,
  "probability": 0.25,
  "latencyMs": 500,
  "targetEndpoints": ["/api/tickets"],
  "activeScenarios": ["DatabaseFailureScenario"],
  "availableScenarios": [...],
  "metrics": {
    "chaos_events_total": 120,
    "chaos_events_success": 90,
    "chaos_events_failed": 30,
    "chaos_latency_added": 15000,
    "chaos_probability_hits": 30
  }
}
```

### 5.2 Dynamic Update Configuration
* **Method**: `POST`
* **Path**: `/api/chaos/configure`
* **Headers**: `X-Chaos-Auth: <token>`
* **Body**:
```json
{
  "enabled": true,
  "probability": 0.5,
  "latencyMs": 1000,
  "targetEndpoints": ["/api/tickets", "/api/auth"],
  "activateScenarios": ["DatabaseFailureScenario"]
}
```

### 5.3 Reset Chaos State
* **Method**: `POST`
* **Path**: `/api/chaos/reset`
* **Headers**: `X-Chaos-Auth: <token>`

---

## 6. Testing & Validation

To verify the chaos framework works and compiles perfectly, execute the Vitest suite:

```bash
npm run test
```

The test runner will run 19 extensive test cases validating the Middleware, Registry, Seeded Probability Engine, Header Parsing, Scenario Execution, Telemetry logs, and Metrics Service reporting.

---

## 7. Rollback & Remediation

If any abnormal behavior is detected, or for complete chaos decommission:
1. Revoke the environment variable `CHAOS_MODE` by setting it to `false` or deleting it.
2. In the event of a platform hot-fix, trigger `/api/chaos/reset` to reset all in-memory arrays and flush active timers instantly.
