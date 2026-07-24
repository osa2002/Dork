export interface WorkingHoursDay {
  enabled: boolean;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export interface WorkingHours {
  enabled: boolean;
  days: {
    [key: string]: WorkingHoursDay; // "0" to "6" for Sun to Sat
  };
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  category: string;
  logoUrl?: string;
  logoText?: string;

  ticketColor?: string;
  plan?: "free" | "pro";
  planExpiresAt?: string;
  isPaused?: boolean;
  workingHours?: WorkingHours;
  timezone?: string;
  createdAt: any;
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  avgDurationMinutes: number;
  isActive: boolean;
  createdAt: any;
}

export interface Ticket {
  id: string;
  shopId: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  emailNotify?: boolean;
  emailNotified?: boolean;
  smsNotify?: boolean;
  smsNotified?: boolean;
  whatsappNotify?: boolean;
  whatsappNotified?: boolean;
  ticketNumber: number;
  status: "waiting" | "calling" | "completed" | "cancelled" | "no_show" | "scheduled";
  isPriority?: boolean;
  counterNumber?: string;
  createdAt: any;
  calledAt?: any;
  completedAt?: any;
  rating?: number;
  ratingSpeed?: number;
  ratingQuality?: number;
  ratingComment?: string;
  ratedAt?: any;
  isScheduled?: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  fcmToken?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface PlanItem {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

export interface Display {
  id: string;
  shopId: string;
  name: string;
  lastActive: any;
  refreshRequestedAt?: any;
  createdAt: any;
}

export interface Invoice {
  id: string;
  shopId: string;
  invoiceNumber: string;
  amount: string;
  planName: string;
  status: "paid" | "failed" | "pending";
  cardBrand?: string;
  cardLast4?: string;
  createdAt: any;
}

export type WebhookEvent = 
  | "ticket.created" 
  | "ticket.calling" 
  | "ticket.completed" 
  | "ticket.cancelled" 
  | "ticket.no_show" 
  | "queue.paused" 
  | "queue.resumed";

export interface WebhookHeader {
  key: string;
  value: string;
}

export interface WebhookConfig {
  id: string;
  shopId: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  isActive: boolean;
  headers?: WebhookHeader[];
  createdAt: any;
  updatedAt?: any;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  webhookName?: string;
  shopId: string;
  event: WebhookEvent;
  url: string;
  statusCode: number;
  success: boolean;
  responseSummary?: string;
  payload: any;
  durationMs: number;
  createdAt: any;
}

export type OutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "DISPATCHED"
  | "FAILED"
  | "ABANDONED"
  | "DEAD_LETTER";

export interface OutboxRecord {
  id: string;
  topic?: string;
  eventType?: string;
  event?: string;
  payload: any;
  status: OutboxStatus;
  retryCount?: number;
  maxRetries?: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  processedAt?: string;
  lastError?: string;
  error?: string;
  createdAt: string;
  updatedAt?: string;
  partitionKey?: string;
  targetUrl?: string;
  correlationId?: string;
  idempotencyKey?: string;
  shopId?: string;
  tenantId?: string;
  leaseId?: string;
  leaseExpiresAt?: string;
}

