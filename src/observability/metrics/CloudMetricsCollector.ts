export type MetricType = "COUNTER" | "GAUGE" | "HISTOGRAM";

export interface MetricLabelSet {
  tenantId?: string;
  providerId?: string;
  currency?: string;
  status?: string;
  action?: string;
  queueName?: string;
  [key: string]: string | undefined;
}

export interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestampMs: number;
}

export interface HistogramSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export class Counter {
  private value = 0;
  constructor(public readonly name: string, public readonly labels: Record<string, string> = {}) {}

  public inc(amount: number = 1): void {
    if (amount < 0) throw new Error("Counter increment cannot be negative");
    this.value += amount;
  }

  public getValue(): number {
    return this.value;
  }
}

export class Gauge {
  private value = 0;
  constructor(public readonly name: string, public readonly labels: Record<string, string> = {}) {}

  public set(val: number): void {
    this.value = val;
  }

  public inc(amount: number = 1): void {
    this.value += amount;
  }

  public dec(amount: number = 1): void {
    this.value -= amount;
  }

  public getValue(): number {
    return this.value;
  }
}

export class Histogram {
  private samples: number[] = [];
  private sumValue = 0;

  constructor(public readonly name: string, public readonly labels: Record<string, string> = {}) {}

  public observe(value: number): void {
    this.samples.push(value);
    this.sumValue += value;
    if (this.samples.length > 5000) {
      this.samples.shift(); // keep sliding window bounded
    }
  }

  public getSnapshot(): HistogramSnapshot {
    if (this.samples.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const count = sorted.length;
    return {
      count,
      sum: this.sumValue,
      min: sorted[0],
      max: sorted[count - 1],
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.min(count - 1, Math.floor(count * 0.99))]
    };
  }
}

export class CloudMetricsCollector {
  private static instance: CloudMetricsCollector;

  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  public static getInstance(): CloudMetricsCollector {
    if (!CloudMetricsCollector.instance) {
      CloudMetricsCollector.instance = new CloudMetricsCollector();
    }
    return CloudMetricsCollector.instance;
  }

  private formatKey(name: string, labels: Record<string, string>): string {
    const sortedProps = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(",");
    return `${name}{${sortedProps}}`;
  }

  public incrementCounter(name: string, value: number = 1, labels: MetricLabelSet = {}): void {
    const cleanLabels = this.sanitizeLabels(labels);
    const key = this.formatKey(name, cleanLabels);
    if (!this.counters.has(key)) {
      this.counters.set(key, new Counter(name, cleanLabels));
    }
    this.counters.get(key)!.inc(value);
  }

  public setGauge(name: string, value: number, labels: MetricLabelSet = {}): void {
    const cleanLabels = this.sanitizeLabels(labels);
    const key = this.formatKey(name, cleanLabels);
    if (!this.gauges.has(key)) {
      this.gauges.set(key, new Gauge(name, cleanLabels));
    }
    this.gauges.get(key)!.set(value);
  }

  public observeHistogram(name: string, value: number, labels: MetricLabelSet = {}): void {
    const cleanLabels = this.sanitizeLabels(labels);
    const key = this.formatKey(name, cleanLabels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new Histogram(name, cleanLabels));
    }
    this.histograms.get(key)!.observe(value);
  }

  // --- Specialized Domain Helper Methods ---

  public recordAuthorization(tenantId: string, providerId: string, success: boolean, durationMs: number, amountCents: number): void {
    const labels = { tenantId, providerId, status: success ? "SUCCESS" : "FAILED" };
    this.incrementCounter("billing_authorization_requests_total", 1, labels);
    this.observeHistogram("billing_authorization_latency_ms", durationMs, labels);
    if (success) {
      this.incrementCounter("billing_payment_volume_cents", amountCents, { tenantId, providerId });
    }
  }

  public recordProviderLatency(providerId: string, durationMs: number, success: boolean): void {
    this.observeHistogram("provider_request_latency_ms", durationMs, { providerId, status: success ? "OK" : "ERROR" });
  }

  public recordQueueDepth(queueName: string, count: number): void {
    this.setGauge("queue_pending_items_count", count, { queueName });
  }

  public recordEstimatedCloudCost(vcpuSeconds: number, firestoreReads: number, firestoreWrites: number): void {
    this.incrementCounter("cloud_run_vcpu_seconds_total", vcpuSeconds);
    this.incrementCounter("firestore_read_ops_total", firestoreReads);
    this.incrementCounter("firestore_write_ops_total", firestoreWrites);
  }

  private sanitizeLabels(labels: MetricLabelSet): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) {
      if (v !== undefined && v !== null) {
        clean[k] = String(v);
      }
    }
    return clean;
  }

  public snapshotAllMetrics(): {
    counters: Array<{ name: string; value: number; labels: Record<string, string> }>;
    gauges: Array<{ name: string; value: number; labels: Record<string, string> }>;
    histograms: Array<{ name: string; snapshot: HistogramSnapshot; labels: Record<string, string> }>;
  } {
    return {
      counters: Array.from(this.counters.values()).map(c => ({ name: c.name, value: c.getValue(), labels: c.labels })),
      gauges: Array.from(this.gauges.values()).map(g => ({ name: g.name, value: g.getValue(), labels: g.labels })),
      histograms: Array.from(this.histograms.values()).map(h => ({ name: h.name, snapshot: h.getSnapshot(), labels: h.labels }))
    };
  }
}
