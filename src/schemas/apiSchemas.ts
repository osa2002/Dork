import { z } from "zod";

export const sendEmailSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    name: z.string().min(1, "Name is required"),
    ticketNumber: z.union([z.string(), z.number()]).transform(val => String(val)),
    serviceName: z.string().min(1, "Service name is required"),
    shopName: z.string().min(1, "Shop name is required"),
    lang: z.string().optional()
  })
});

export const sendFcmSchema = z.object({
  body: z.object({
    fcmToken: z.string().min(1, "FCM token is required"),
    ticketNumber: z.union([z.string(), z.number()]).transform(val => String(val)),
    shopName: z.string().min(1, "Shop name is required"),
    lang: z.string().optional(),
    customTitle: z.string().optional(),
    customBody: z.string().optional()
  })
});

export const estimateWaitTimeSchema = z.object({
  body: z.object({
    shopName: z.string().min(1, "Shop name is required"),
    serviceName: z.string().min(1, "Service name is required"),
    peopleInFront: z.number().min(0, "People in front cannot be negative"),
    recentTickets: z.array(z.any()).optional().default([]),
    activeCountersCount: z.number().min(1, "Active counters count must be at least 1"),
    avgDuration: z.number().min(1, "Average duration must be at least 1"),
    historicalAvgDuration: z.number().optional(),
    dayOfWeek: z.string().optional(),
    hourOfDay: z.number().optional(),
    lang: z.string().optional()
  })
});

export const analyzeQueueSchema = z.object({
  body: z.object({
    shopData: z.record(z.string(), z.any()).optional().default({}),
    stats: z.record(z.string(), z.any()).optional().default({}),
    lang: z.string().optional()
  })
});

export const createTicketSchema = z.object({
  body: z.object({
    shopId: z.string().min(1, "Shop ID is required"),
    serviceId: z.string().min(1, "Service ID is required"),
    serviceName: z.string().min(1, "Service name is required"),
    customerName: z.string().min(1, "Customer name is required"),
    customerPhone: z.string().optional().default(""),
    customerEmail: z.string().optional().default(""),
    emailNotify: z.boolean().optional().default(false),
    smsNotify: z.boolean().optional().default(false),
    whatsappNotify: z.boolean().optional().default(false),
    fcmToken: z.string().optional(),
    lang: z.string().optional()
  })
});

export const createCheckoutSessionSchema = z.object({
  body: z.object({
    shopId: z.string().min(1, "Shop ID is required"),
    lang: z.string().optional()
  })
});

export const verifySessionSchema = z.object({
  query: z.object({
    sessionId: z.string().min(1, "Session ID is required"),
    shopId: z.string().min(1, "Shop ID is required")
  })
});

export const mobileShopIdentifierSchema = z.object({
  params: z.object({
    identifier: z.string().min(1, "Shop identifier is required")
  })
});

export const mobileTicketCancelSchema = z.object({
  body: z.object({
    ticketId: z.string().min(1, "Ticket ID is required"),
    reason: z.string().optional()
  })
});

export const mobileTicketHistorySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
  })
});

export const mobileFcmRegisterSchema = z.object({
  body: z.object({
    token: z.string().min(1, "FCM token is required"),
    platform: z.enum(["android", "ios", "web"]).optional().default("android"),
    deviceId: z.string().optional()
  })
});

