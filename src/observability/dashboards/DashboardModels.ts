export type WidgetType = "TIMESERIES" | "GAUGE" | "STAT_CARD" | "BAR_CHART" | "TABLE" | "STATUS_GRID";

export interface DashboardWidget {
  id: string;
  title: string;
  type: WidgetType;
  metricQuery: string;
  gridPos: { x: number; y: number; w: number; h: number };
  unit?: string;
  refreshIntervalSeconds?: number;
  thresholds?: Array<{ value: number; color: string }>;
}

export interface OperationalDashboard {
  id: string;
  title: string;
  description: string;
  category: "Executive" | "Operations" | "Providers" | "Tenant";
  widgets: DashboardWidget[];
}

export class DashboardModels {
  public static getExecutiveBillingOverview(): OperationalDashboard {
    return {
      id: "dash-executive-billing",
      title: "Executive Billing & Revenue Overview",
      description: "Real-time visibility into authorization volumes, payment success rates, and revenue flow across tenants.",
      category: "Executive",
      widgets: [
        {
          id: "w-total-payment-volume",
          title: "Total Payment Volume (USD)",
          type: "STAT_CARD",
          metricQuery: "sum(billing_payment_volume_cents) / 100",
          gridPos: { x: 0, y: 0, w: 3, h: 2 },
          unit: "USD"
        },
        {
          id: "w-auth-success-rate",
          title: "Authorization Success Rate (%)",
          type: "GAUGE",
          metricQuery: "sum(billing_authorization_requests_total{status='SUCCESS'}) / sum(billing_authorization_requests_total) * 100",
          gridPos: { x: 3, y: 0, w: 3, h: 2 },
          unit: "%",
          thresholds: [
            { value: 90, color: "#e53e3e" },
            { value: 95, color: "#dd6b20" },
            { value: 98, color: "#38a169" }
          ]
        },
        {
          id: "w-authorization-latency-timeseries",
          title: "Authorization Latency (P50, P95, P99)",
          type: "TIMESERIES",
          metricQuery: "histogram_quantile(billing_authorization_latency_ms)",
          gridPos: { x: 0, y: 2, w: 6, h: 4 },
          unit: "ms"
        }
      ]
    };
  }

  public static getProviderReliabilityMatrix(): OperationalDashboard {
    return {
      id: "dash-provider-reliability",
      title: "Payment Gateway Provider Reliability Matrix",
      description: "Comparative health, error rates, and response latency across Stripe, PayPal, Adyen, Checkout.com, and Iyzico.",
      category: "Providers",
      widgets: [
        {
          id: "w-provider-status-grid",
          title: "Adapter Circuit Breaker States",
          type: "STATUS_GRID",
          metricQuery: "provider_circuit_breaker_state",
          gridPos: { x: 0, y: 0, w: 6, h: 2 }
        },
        {
          id: "w-provider-latency-bar",
          title: "Provider P95 Latency Comparison",
          type: "BAR_CHART",
          metricQuery: "provider_request_latency_ms{quantile='0.95'} by (providerId)",
          gridPos: { x: 0, y: 2, w: 6, h: 4 },
          unit: "ms"
        }
      ]
    };
  }

  public static getQueueOperationsDashboard(): OperationalDashboard {
    return {
      id: "dash-queue-operations",
      title: "Outbox, Webhook & Dead Letter Queue Operations",
      description: "Monitors async transactional event outbox, incoming webhook idempotency pipelines, and DLQ resolution.",
      category: "Operations",
      widgets: [
        {
          id: "w-dlq-unresolved",
          title: "Unresolved Dead Letter Messages",
          type: "STAT_CARD",
          metricQuery: "queue_pending_items_count{queueName='dlq'}",
          gridPos: { x: 0, y: 0, w: 3, h: 2 },
          thresholds: [{ value: 0, color: "#38a169" }, { value: 5, color: "#dd6b20" }, { value: 10, color: "#e53e3e" }]
        },
        {
          id: "w-outbox-pending",
          title: "Outbox Pending Events",
          type: "GAUGE",
          metricQuery: "queue_pending_items_count{queueName='outbox'}",
          gridPos: { x: 3, y: 0, w: 3, h: 2 }
        }
      ]
    };
  }
}
