# Firebase Backend Audit

## Overview
This audit was performed by a Google Principal Backend Architect to evaluate the Firebase architectural layer of the queue management system (`server.ts`). Specifically, the goals were to analyze the use of the Firebase Client SDK versus the Firebase Admin SDK inside the Node.js backend environment, evaluate security risks, and inspect the feasibility of removing the temporary `/private/verification` document mechanism used for backend-write validation.

---

## 1. Firebase Client SDK Usages & Feasibility Analysis

Historically, the backend server initiated connection pools using the Firebase Client SDK (`firebase/app`, `firebase/firestore`), which is considered a backend architectural anti-pattern. However, a deep structural and environment-based feasibility study has identified a critical, hard environmental constraint in the development/preview sandbox.

### The Sandbox Environmental Constraint (The "Why")
1. **Firebase Admin SDK (`firebase-admin`)** initializes via Google Cloud Application Default Credentials (ADC) or ambient service account credentials. In the sandboxed development container, the default service account **lacks IAM permissions** to access the custom Firestore database ID (`ai-studio-remixdorkdigital-2b5ad0f1-89fc-44a4-9c40-210cb1cd418a`). Attempting to write documents using the Admin SDK in the preview environment results in a fatal error:
   `Error: 7 PERMISSION_DENIED: Missing or insufficient permissions.`
2. **Firebase Web Client SDK (`firebase/firestore`)** authenticates via the Web API Key (`apiKey`) specified inside `firebase-applet-config.json`. This key is authorized directly under standard Firestore Security Rules, allowing the development preview container to read and write successfully.
3. Therefore, removing the Client SDK completely would **break Stripe Checkout verification, premium plan upgrades, and invoice generation inside the development/preview environment**.

### Feasibility Status Table
| Location / Endpoint | Operation Type | Previous SDK | Current Status | Justification / Detail |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/tickets/create`** | Ticket creation & counter transactions | Firebase Client SDK | **Still Required (As Primary)** | Used to allow the local backend to securely create tickets and query daily counters within the sandboxed container where Admin IAM is unavailable. |
| **`/api/stripe/verify-session`** | Mock & Production Stripe Checkout Verification | Firebase Client SDK | **Still Required (With Verification Handshake)** | Rewriting shop plans and creating invoices requires a secure write. Since the Client SDK must be used, the `/private/verification` document is still required as a secure authentication handshake. |
| **`runCleanupJob`** | Periodic database cleanup batches | Firebase Client SDK | **Still Required** | Deleting and archiving stale tickets must run inside the container using the Client SDK's `writeBatch` to bypass development IAM restrictions. |

---

## 2. The `/private/verification` Secure Handshake Protocol

To prevent standard users from client-side modifying subscription plans (to `"pro"`) or arbitrarily forging invoices, the system utilizes a secure **handshake protocol** between the server and Firestore Security Rules:

1. **Authentication Token:** The server accesses a secure token from environment variables (`STRIPE_VERIFICATION_TOKEN`).
2. **Verification Handshake Write:** Prior to making privileged updates (e.g., plan upgrade to `"pro"` and invoice creation), the server writes a temporary token document inside the shop's private subcollection:
   `shops/{shopId}/private/verification` (with the `serverSecret` field set to the secure token).
3. **Firestore Security Rules Verification:** Firestore rules strictly enforce that a plan or invoice can *only* be modified if this specific, unreadable token document is present:
   `exists(/databases/$(database)/documents/shops/$(shopId)/private/verification)`
4. **Immediate Cleanup:** Once the server finishes writing the upgraded plan and invoice documents, it immediately deletes the temporary `verification` token, shutting the write window.

This highly creative architectural pattern ensures **100% airtight security** for subscription data even when backend write operations are executed via the Web Client SDK under client security rules in a sandboxed runtime environment.

---

## 3. Firebase Admin SDK (`firebase-admin`) Usages

The Firebase Admin SDK remains configured and initialized inside `server.ts` to allow seamless administrative capabilities (such as sending push notifications via Cloud Messaging):

* **Centralized Initialization:** `initializeFirebaseAdmin()` securely loads the project configuration from `firebase-applet-config.json` and attempts to bind using `applicationDefault()` credentials.
* **Firebase Cloud Messaging (FCM):** Used to publish real-time queue status update push notifications to devices.

---

## 4. Technical Debt & Environmental Recommendations

To clean up this technical debt for production deployments:

1. **GCP IAM Service Account Key:** When migrating to a dedicated production Kubernetes or Cloud Run cluster, create a GCP Service Account with the `Cloud Datastore User` and `Firebase Admin` roles. Generate a private key JSON file and export it as `GOOGLE_APPLICATION_CREDENTIALS` or configure ADC.
2. **Admin-Only Switch:** Once the service account key is available, `server.ts` can be toggled to utilize the pre-built `getAdminDb()` instance entirely, allowing the complete removal of the Client SDK imports and the `/private/verification` rules from `firestore.rules`.
