export interface Runbook {
  id: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  steps: string[];
  mitigationStrategy: string;
}

export const runbooks: Runbook[] = [
  {
    id: "rb-firestore-outage",
    title: "Firestore Outage Recovery Runbook",
    description: "Operational response checklist when Google Cloud Firestore experiences partial degradation or total outage.",
    severity: "CRITICAL",
    steps: [
      "Verify outage status via GCP Status Dashboard (status.cloud.google.com).",
      "Check server logs for Firestore connection timeouts, quota exhaustion, or credential errors.",
      "If Google Firestore is completely down, flip the feature flag 'LOCAL_SANDBOX_FALLBACK' to route operations to the local, crash-resilient in-memory database to preserve merchant operations.",
      "Check database metrics on GCP Logging with query: 'resource.type=\"datastore_database\" severity>=ERROR'.",
      "Draft incident announcement for active vendor shops.",
      "Once Firestore is restored, initiate database integrity sync from local caches and notify SRE on-call team."
    ],
    mitigationStrategy: "Enable multi-regional Firestore configuration and local resilience cache replication.",
  },
  {
    id: "rb-stripe-outage",
    title: "Stripe Billing Outage Runbook",
    description: "Mitigation runbook for Stripe Payment Gateway failures preventing vendor upgrades.",
    severity: "HIGH",
    steps: [
      "Check Stripe API Status (status.stripe.com).",
      "Review logs for Stripe Checkout session failures and webhook authentication errors.",
      "If Stripe APIs are unavailable or timing out (> 5000ms), activate the sandbox stripe mock checkout flag.",
      "Inform customers during checkout that payment processing is temporarily undergoing maintenance and will auto-retry.",
      "Ensure payment webhooks queue failed events to an event log for asynchronous processing once Stripe recovers.",
      "Perform transactional audit when Stripe comes online to reconcile offline subscriptions."
    ],
    mitigationStrategy: "Graceful sandbox mock payment checkout fallback with background webhook queuing.",
  },
  {
    id: "rb-gemini-outage",
    title: "Gemini AI Outage Runbook",
    description: "Response procedure for Gemini API outages affecting estimated wait times.",
    severity: "MEDIUM",
    steps: [
      "Verify Gemini API health via Google AI Studio status console.",
      "Check backend telemetry metrics for Gemini response error rates and latency spikes.",
      "Ensure the local deterministic wait-time fallback calculator is automatically activated (zero-downtime path).",
      "Adjust wait time models dynamically based on active desk averages to ensure clients continue seeing helpful feedback.",
      "Notify on-call developer to verify API quota limits have not been breached."
    ],
    mitigationStrategy: "Instant, seamless fallback to localized, deterministic queuing calculators.",
  },
  {
    id: "rb-smtp-outage",
    title: "SMTP / NodeMailer Outage Runbook",
    description: "Troubleshooting steps for SMTP notification outages causing email confirmation delays.",
    severity: "MEDIUM",
    steps: [
      "Verify SMTP host connectivity using 'nc -zv [SMTP_HOST] [SMTP_PORT]'.",
      "Check NodeMailer logs for TLS handshake timeouts or invalid credential rejections.",
      "If the custom SMTP server is down, fallback to NodeMailer's simulated ethereal mail sandbox.",
      "Redirect failed outbound emails into an in-memory or Firestore retry-queue with exponential backoff.",
      "Monitor SMTP server queues to prevent mailbox rate limiting or IP blacklisting."
    ],
    mitigationStrategy: "Local retry queue with exponential backoff and connection pooling.",
  },
  {
    id: "rb-twilio-outage",
    title: "Twilio SMS/WhatsApp Outage Runbook",
    description: "Guidance for Twilio SMS and WhatsApp notification delivery failure mitigation.",
    severity: "HIGH",
    steps: [
      "Check Twilio status dashboard (status.twilio.com) for API carrier routing disruptions.",
      "Verify Twilio SID and Auth Token environment variable validity in production config.",
      "Switch channel routing automatically from SMS/WhatsApp to browser push notification alerts or WebSockets if available.",
      "Log un-delivered carrier alerts in an auditing table for bulk-delivery retry after recovery.",
      "Ensure Twilio client lazy-initialization handles missing keys gracefully without halting app boot."
    ],
    mitigationStrategy: "Omnichannel fallback routing and client-side web push notification alternatives.",
  },
  {
    id: "rb-cloud-run-outage",
    title: "Cloud Run Outage & Autoscaling Runbook",
    description: "Architectural steps for Cloud Run container crash, deployment failures, or regional outages.",
    severity: "CRITICAL",
    steps: [
      "Inspect Cloud Run service logs: 'resource.type=\"cloud_run_revision\" resource.labels.service_name=\"[SERVICE]\" severity>=ERROR'.",
      "Check CPU and Memory utilization charts in GCP Monitoring console.",
      "If memory leaks cause OOM (Out Of Memory) crashes, configure minimum instances to 1, scale limit to 50, and raise memory footprint to 1GB or 2GB.",
      "Trigger rollback to previous working revision via GCP console if a faulty deployment caused the crash.",
      "If regional Google Cloud Run outage is confirmed, update Cloud DNS / Global Load Balancer to route traffic to the secondary standby region (failover)."
    ],
    mitigationStrategy: "Multi-region GCLB active-passive load balancing and defensive memory limits.",
  },
  {
    id: "rb-high-latency",
    title: "High API Latency Runbook",
    description: "SRE on-call runbook for diagnosing and optimizing response latency exceeding 500ms.",
    severity: "HIGH",
    steps: [
      "Verify Event Loop lag using '/health' endpoint or node-metrics monitoring dashboards.",
      "Check for heavy synchronous operations blocking Node.js thread execution.",
      "Analyze Firestore query response speeds - ensure composite indexes are created for active where and orderBy combinations.",
      "Enable Redis/in-memory local caching for hot metadata reads like Shop profiles and Service menus.",
      "Deploy more Cloud Run instances to share request concurrency volume."
    ],
    mitigationStrategy: "Query indexing, cache-aside patterns, and horizontal autoscaling.",
  },
  {
    id: "rb-db-contention",
    title: "Database Lock & Contention Runbook",
    description: "Operational checks for Firestore transaction lock contentions and high-frequency collision aborts.",
    severity: "HIGH",
    steps: [
      "Check server logs for Firestore errors matching: 'ABORTED: Transaction failed due to concurrent modification'.",
      "Locate the high-frequency writes (e.g. fast-rate ticket creations) causing locks.",
      "Optimize transactional operations by keeping reads outside the transaction body where possible, or reducing block sizes.",
      "Implement client-side jittered exponential retry backoffs to spread lock demand.",
      "If necessary, shard critical counter documents (e.g. ticket numbers) to spread contention across multiple documents."
    ],
    mitigationStrategy: "Document sharding, transactional minimized writes, and client-side jitter backoff.",
  },
  {
    id: "rb-queue-failures",
    title: "Queue Operations & Processing Failure Runbook",
    description: "Troubleshooting steps for queue flow bottlenecks or client ticket sync issues.",
    severity: "HIGH",
    steps: [
      "Verify active WebSocket connections to clients to ensure real-time queue boards are receiving state changes.",
      "Review queue business metrics: average wait time, average service duration, and active counters count.",
      "Check if tickets are getting 'stuck' in 'calling' state without transitioning to 'completed' or 'no_show'.",
      "Manually trigger a force-refresh signal via display broadcast mechanisms if board state stalls.",
      "Ensure local database transactional updates prevent two counters from calling the same ticket simultaneously."
    ],
    mitigationStrategy: "Optimistic locking on ticket state, automated timeouts, and heartbeat connections."
  }
];
