import os from "os";
import { EnterpriseEventBus } from "../../server/chaos/governance/EnterpriseEventBus";

export interface SystemMetrics {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    freePercent: number;
  };
  cpu: {
    loadAvg: number[];
    cores: number;
  };
  cloudRun: {
    instanceId: string;
    service: string;
    revision: string;
    region: string;
  };
}

export interface QueueBusinessMetrics {
  avgWaitTime: number; // in seconds
  avgServiceTime: number; // in seconds
  abandonmentRate: number; // percentage (0-100)
  dailyCustomers: number;
  activeVendorsCount: number;
  subscriptionUpgrades: number;
  totalRevenueUSD: number;
  aiUsageCount: number;
  notificationSuccessRate: number;
}

export class MetricsService {
  // Counters for Phase 6.2 (Enterprise Metrics)
  private static apiRequests = 0;
  private static apiErrors = 0;
  private static totalLatencyMs = 0;
  
  private static activeVendors = new Set<string>();
  private static activeQueues = new Set<string>();
  
  private static ticketsCreated = 0;
  private static ticketsCompleted = 0;
  private static ticketsCancelled = 0;
  
  private static aiRequests = 0;
  private static stripeRequests = 0;
  private static emailRequests = 0;
  private static smsRequests = 0;
  
  private static firestoreReads = 0;
  private static firestoreWrites = 0;
  private static cacheHits = 0;
  private static cacheMisses = 0;

  // Counters for Phase 6.5 (Business Metrics)
  private static waitTimes: number[] = [];
  private static serviceTimes: number[] = [];
  private static subscriptionUpgradesCount = 0;
  private static totalRevenueCents = 0;
  private static notificationSent = 0;
  private static notificationFailed = 0;

  // Cloud Run metadata parsed from env
  private static cloudRunMetadata = {
    instanceId: process.env.K_REVISION ? `instance-${process.env.K_REVISION}-${Math.random().toString(36).substring(2, 7)}` : "local-dev-instance",
    service: process.env.K_SERVICE || "dorkq-service",
    revision: process.env.K_REVISION || "local-dev-revision",
    region: process.env.REGION || "europe-west2",
  };

  /**
   * Track an incoming API request with its latency and status
   */
  public static recordApiRequest(latencyMs: number, success: boolean) {
    this.apiRequests++;
    this.totalLatencyMs += latencyMs;
    if (!success) {
      this.apiErrors++;
    }

    EnterpriseEventBus.publish("MetricsUpdated", {
      requestsCount: this.apiRequests,
      latencyMs: latencyMs,
      errorRatePercent: this.apiRequests > 0 ? (this.apiErrors / this.apiRequests) * 100 : 0,
    });
  }

  /**
   * Track vendor and queue activity
   */
  public static recordVendorActivity(shopId: string) {
    if (shopId) {
      this.activeVendors.add(shopId);
    }
  }

  public static recordQueueActivity(shopId: string, serviceId: string) {
    if (shopId && serviceId) {
      this.activeQueues.add(`${shopId}:${serviceId}`);
      this.activeVendors.add(shopId);
    }
  }

  /**
   * Track ticket lifecycle
   */
  public static recordTicketCreated() {
    this.ticketsCreated++;
  }

  public static recordTicketCompleted() {
    this.ticketsCompleted++;
  }

  public static recordTicketCancelled() {
    this.ticketsCancelled++;
  }

  /**
   * Track external integrations
   */
  public static recordAiRequest() {
    this.aiRequests++;
  }

  public static recordStripeRequest(amountCents: number = 0) {
    this.stripeRequests++;
    if (amountCents > 0) {
      this.totalRevenueCents += amountCents;
    }
  }

  public static recordSubscriptionUpgrade() {
    this.subscriptionUpgradesCount++;
  }

  public static recordEmailRequest() {
    this.emailRequests++;
  }

  public static recordSmsRequest() {
    this.smsRequests++;
  }

  /**
   * Track database / cache performance
   */
  public static recordFirestoreRead(count: number = 1) {
    this.firestoreReads += count;
  }

  public static recordFirestoreWrite(count: number = 1) {
    this.firestoreWrites += count;
  }

  public static recordCacheHit() {
    this.cacheHits++;
  }

  public static recordCacheMiss() {
    this.cacheMisses++;
  }

  /**
   * Record specific business timing aggregates
   */
  public static recordWaitTime(seconds: number) {
    if (seconds >= 0) {
      this.waitTimes.push(seconds);
      // Keep running window of last 1000 items to prevent unbounded memory growth
      if (this.waitTimes.length > 1000) {
        this.waitTimes.shift();
      }
    }
  }

  public static recordServiceTime(seconds: number) {
    if (seconds >= 0) {
      this.serviceTimes.push(seconds);
      // Keep running window of last 1000 items to prevent unbounded memory growth
      if (this.serviceTimes.length > 1000) {
        this.serviceTimes.shift();
      }
    }
  }

  /**
   * Record push notification outcomes
   */
  public static recordNotificationOutcome(success: boolean) {
    if (success) {
      this.notificationSent++;
    } else {
      this.notificationFailed++;
    }
  }

  /**
   * Retrieve structured OS / memory and Cloud Run metrics
   */
  public static getSystemMetrics(): SystemMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        freePercent: Math.round((freeMem / totalMem) * 100),
      },
      cpu: {
        loadAvg: os.loadavg(),
        cores: os.cpus().length,
      },
      cloudRun: this.cloudRunMetadata,
    };
  }

  /**
   * Retrieve all aggregated counts (thread-safe, lightweight copy)
   */
  public static getCounts() {
    const totalRequests = this.apiRequests;
    const avgLatency = totalRequests > 0 ? Math.round(this.totalLatencyMs / totalRequests) : 0;
    const errorRate = totalRequests > 0 ? Number(((this.apiErrors / totalRequests) * 100).toFixed(2)) : 0;

    return {
      apiRequests: totalRequests,
      apiErrors: this.apiErrors,
      avgLatencyMs: avgLatency,
      errorRatePercent: errorRate,
      activeVendorsCount: this.activeVendors.size,
      activeQueuesCount: this.activeQueues.size,
      ticketsCreated: this.ticketsCreated,
      ticketsCompleted: this.ticketsCompleted,
      ticketsCancelled: this.ticketsCancelled,
      aiRequests: this.aiRequests,
      stripeRequests: this.stripeRequests,
      emailRequests: this.emailRequests,
      smsRequests: this.smsRequests,
      firestoreReads: this.firestoreReads,
      firestoreWrites: this.firestoreWrites,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
    };
  }

  /**
   * Retrieve all aggregated business logic KPI metrics
   */
  public static getBusinessMetrics(): QueueBusinessMetrics {
    const totalTickets = this.ticketsCreated || 1;
    const abandonmentRate = Number(((this.ticketsCancelled / totalTickets) * 100).toFixed(2));

    const sumWait = this.waitTimes.reduce((acc, val) => acc + val, 0);
    const avgWaitTime = this.waitTimes.length > 0 ? Math.round(sumWait / this.waitTimes.length) : 0;

    const sumService = this.serviceTimes.reduce((acc, val) => acc + val, 0);
    const avgServiceTime = this.serviceTimes.length > 0 ? Math.round(sumService / this.serviceTimes.length) : 0;

    const totalNotifications = this.notificationSent + this.notificationFailed;
    const notificationSuccessRate = totalNotifications > 0 
      ? Number(((this.notificationSent / totalNotifications) * 100).toFixed(2)) 
      : 100;

    return {
      avgWaitTime,
      avgServiceTime,
      abandonmentRate,
      dailyCustomers: this.ticketsCreated,
      activeVendorsCount: this.activeVendors.size,
      subscriptionUpgrades: this.subscriptionUpgradesCount,
      totalRevenueUSD: Number((this.totalRevenueCents / 100).toFixed(2)),
      aiUsageCount: this.aiRequests,
      notificationSuccessRate,
    };
  }

  /**
   * Clear active queues/vendors set on interval/day rollover to reset rolling window
   */
  public static resetIntervalMetrics() {
    this.activeVendors.clear();
    this.activeQueues.clear();
  }
}
