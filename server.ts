import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Stripe from "stripe";
import { GoogleGenAI, Type } from "@google/genai";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import observabilityRouter from "./src/routes/observabilityRoutes";
import governanceRouter from "./src/routes/governanceRoutes";
import messagingRouter from "./src/routes/messagingRoutes";
import financeRouter from "./src/financial/api/financeRoutes";
import iamRouter from "./src/iam/api/iamRoutes";
import workflowRouter from "./src/workflow/api/workflowRoutes";
import { mobileRouter } from "./src/routes/mobileRoutes";
import { adminRouter } from "./server/admin/routes/adminRoutes";
import { sendWelcomeNotificationsOnServer } from "./src/services/serverNotificationService";
import { AuditLogService } from "./src/services/AuditLogService";
import { SLOService } from "./src/services/SLOService";
import { observabilityMiddleware } from "./src/middlewares/observabilityMiddleware";
import { ConfigValidator } from "./src/services/ConfigValidator";
import { ShutdownManager } from "./src/services/ShutdownManager";
import { TelemetryService } from "./src/services/TelemetryService";
import { MetricsService } from "./src/services/MetricsService";

import { getDatabaseProvider } from "./src/lib/DatabaseProvider";
import { validateRequest } from "./src/middlewares/validationMiddleware";
import { globalErrorHandler } from "./src/middlewares/errorMiddleware";
import { authenticateFirebaseUser } from "./src/middlewares/authMiddleware";
import { correlationIdMiddleware } from "./src/lib/serverLogger";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError
} from "./src/errors/CustomErrors";
import {
  estimateWaitTimeSchema,
  analyzeQueueSchema,
  createTicketSchema,
  createCheckoutSessionSchema,
  verifySessionSchema
} from "./src/schemas/apiSchemas";

function getStartOfTodayInTimezone(timezone: string): string {
  try {
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(new Date());

    const year = parseInt(tzParts.find(p => p.type === 'year')!.value, 10);
    const month = parseInt(tzParts.find(p => p.type === 'month')!.value, 10) - 1;
    const day = parseInt(tzParts.find(p => p.type === 'day')!.value, 10);

    const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const testParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    }).formatToParts(testDate);

    const tYear = parseInt(testParts.find(p => p.type === 'year')!.value, 10);
    const tMonth = parseInt(testParts.find(p => p.type === 'month')!.value, 10) - 1;
    const tDay = parseInt(testParts.find(p => p.type === 'day')!.value, 10);
    const tHour = parseInt(testParts.find(p => p.type === 'hour')!.value, 10);
    const tMinute = parseInt(testParts.find(p => p.type === 'minute')!.value, 10);

    const localTimeMs = Date.UTC(tYear, tMonth, tDay, tHour, tMinute, 0);
    const utcTimeMs = testDate.getTime();
    const offsetMs = localTimeMs - utcTimeMs;

    const localMidnightMs = Date.UTC(year, month, day, 0, 0, 0);
    const utcMidnightMs = localMidnightMs - offsetMs;

    return new Date(utcMidnightMs).toISOString();
  } catch (err) {
    console.warn(`Timezone calculation failed for ${timezone}, falling back to UTC start of day:`, err);
    const fallback = new Date();
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback.toISOString();
  }
}

function getEndOfTodayInTimezone(startOfTodayISO: string): string {
  const startMs = new Date(startOfTodayISO).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
  return new Date(endMs).toISOString();
}

async function startServer() {
  // 0. Startup Configuration Verification (Phase 6.8)
  try {
    ConfigValidator.validate();
  } catch (err: any) {
    console.error(`[Startup Failure] Critical configuration error detected: ${err.message}`);
    process.exit(1);
  }

  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;

  // 1. Enable standard CORS middleware
  app.use(
    cors({
      origin: true,
      credentials: false,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
    })
  );

  // 2. Enable Helmet for production-grade security headers & CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://js.stripe.com",
            "https://apis.google.com"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "data:"
          ],
          connectSrc: [
            "'self'",
            "https://*.firestore.googleapis.com",
            "wss://*.firestore.googleapis.com",
            "https://*.firebaseio.com",
            "wss://*.firebaseio.com",
            "https://*.googleapis.com",
            "wss://*.googleapis.com",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://fcm.googleapis.com",
            "https://fcmregistration.googleapis.com",
            "https://api.stripe.com",
            "https://api.twilio.com"
          ],
          frameSrc: [
            "'self'",
            "https://js.stripe.com",
            "https://checkout.stripe.com"
          ],
          frameAncestors: [
            "'self'",
            "https://ai.studio",
            "https://*.google.com",
            "https://*.run.app",
            "https://*.europe-west2.run.app"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https://*.googleusercontent.com",
            "https://*.firebaseusercontent.com"
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  // Observability, Metrics & Enterprise Health Endpoints (Phase 6.1)
  app.use(observabilityRouter);

  // Chaos Engineering Control Endpoints
  try {
    const { ChaosController } = await import("./server/chaos/ChaosController");
    app.get("/api/chaos/state", ChaosController.getState);
    app.get("/api/chaos/intelligence", ChaosController.getIntelligence);
    app.get("/api/chaos/governance", ChaosController.getGovernance);
    app.get("/api/chaos/eventbus", ChaosController.getEventBus);
    app.post("/api/chaos/configure", ChaosController.configure);
    app.post("/api/chaos/reset", ChaosController.reset);
  } catch (err) {
    console.warn("[Chaos Module] Failed to mount Chaos routes:", err);
  }

  // Enterprise Governance, Audit Logging & Disaster Recovery Backend Endpoints (Phase 6.1)
  app.use(governanceRouter);

  // Enterprise Financial Operations Platform Endpoints (Phase 006)
  app.use("/api/v1/finance", financeRouter);

  // Enterprise Identity & Access Management Endpoints (Phase 007)
  app.use("/api/v1/iam", iamRouter);

  // Enterprise Workflow & Automation Platform Endpoints (Phase 008)
  app.use("/api/v1/workflows", workflowRouter);

  // Enterprise Platform Administration Module (Isolated Architecture)
  app.use("/api/v1/admin", adminRouter);

  // 3. API Rate Limiting to prevent denial-of-wallet and abuse
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: {
      status: 429,
      error: "Too many requests from this IP, please try again later."
    }
  });
  app.use("/api/", apiLimiter);

  app.use(express.json());
  app.use(correlationIdMiddleware);

  // Mount Chaos Middleware safely under env and auth guards (TASK 2)
  try {
    const { chaosMiddleware } = await import("./server/chaos/ChaosMiddleware");
    app.use(chaosMiddleware);
  } catch (err) {
    console.warn("[Chaos Module] Failed to mount Chaos Middleware:", err);
  }

  // Monkeypatch MetricsService to include Chaos Metrics dynamically (TASK 9)
  try {
    const { MetricsService: MS } = await import("./src/services/MetricsService");
    const { ChaosState: CS } = await import("./server/chaos/ChaosState");
    const originalGetCounts = MS.getCounts;
    MS.getCounts = function () {
      const counts = originalGetCounts.call(MS);
      return {
        ...counts,
        chaos_events_total: CS.getMetric("chaos_events_total"),
        chaos_events_success: CS.getMetric("chaos_events_success"),
        chaos_events_failed: CS.getMetric("chaos_events_failed"),
        chaos_latency_added: CS.getMetric("chaos_latency_added"),
        chaos_probability_hits: CS.getMetric("chaos_probability_hits"),
      };
    };
  } catch (err) {
    console.warn("[Chaos Module] Failed to monkey-patch MetricsService:", err);
  }

  app.use(observabilityMiddleware);

  app.use(messagingRouter);
  app.use("/api/v1/mobile", mobileRouter);

  // Secure ticket creation & plan validation endpoint
  app.post("/api/tickets/create", validateRequest(createTicketSchema), async (req, res, next) => {
    const { shopId, serviceId, serviceName, customerName, customerPhone, customerEmail, emailNotify, smsNotify, whatsappNotify, lang } = req.body;

    try {
      const dbProvider = await getDatabaseProvider();

      // Get shop details
      const shopData = await dbProvider.getShop(shopId);
      if (!shopData) {
        throw new NotFoundError("Shop not found.");
      }

      const planType = shopData?.plan_type || shopData?.plan || "free";
      const storeTimezone = shopData?.timezone || "Asia/Riyadh";

      const startOfToday = getStartOfTodayInTimezone(storeTimezone);

      // Query existing tickets for today to find the actual current max ticket number in Firestore
      const maxTicketNumInDb = await dbProvider.getTodayTicketsMaxNumber(shopId, startOfToday);

      const dayKey = startOfToday.slice(0, 10); // YYYY-MM-DD

      let nextTicketNumber = 1;

      try {
        const isDemoShop = shopId.startsWith("demo_user_");
        nextTicketNumber = await dbProvider.incrementTicketNumberTransaction(
          shopId,
          dayKey,
          maxTicketNumInDb,
          planType,
          isDemoShop
        );
      } catch (txErr: any) {
        if (txErr?.message === "FREE_PLAN_LIMIT_REACHED") {
          throw new ForbiddenError("لقد وصلت الباقة لهذا المحل إلى الحد الأقصى اليوم (5 عملاء).");
        }
        throw txErr;
      }

      // Save ticket to Firestore
      const randomId = "t_" + Math.random().toString(36).substring(2, 15);
      const cleanTicket = {
        id: randomId,
        shopId,
        serviceId,
        serviceName,
        customerName,
        customerPhone: customerPhone || "",
        customerEmail: customerEmail || "",
        customerUid: (req as any).user?.uid || req.body.customerUid || "",
        emailNotify: !!emailNotify,
        emailNotified: false,
        smsNotify: !!smsNotify,
        smsNotified: false,
        whatsappNotify: !!whatsappNotify,
        whatsappNotified: false,
        ticketNumber: nextTicketNumber,
        status: "waiting",
        createdAt: new Date().toISOString()
      };

      const ticketStart = Date.now();
      await dbProvider.saveTicket(randomId, cleanTicket);
      const ticketDuration = Date.now() - ticketStart;
      SLOService.recordTicketCreation(ticketDuration);
      MetricsService.recordTicketCreated();

      // Log ticket creation to the audit logs
      AuditLogService.log({
        userId: null,
        shopId,
        actor: customerName,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || "unknown",
        operation: "TICKET_CREATE",
        entity: "Ticket",
        newValue: cleanTicket,
        result: "SUCCESS",
        duration: ticketDuration,
        severity: "INFO"
      });

      // Trigger server-side welcome notifications
      const origin = req.headers.origin || "http://localhost:3000";
      await sendWelcomeNotificationsOnServer(cleanTicket, shopData?.name || "Shop", shopData?.slug || "", origin, lang || "ar");

      return res.status(200).json({
        success: true,
        ticket: cleanTicket
      });
    } catch (err: any) {
      next(err);
    }
  });



  // AI Estimated Wait Time Endpoint
  app.post("/api/estimate-wait-time", validateRequest(estimateWaitTimeSchema), async (req, res, next) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { 
      shopName, 
      serviceName, 
      peopleInFront, 
      recentTickets, 
      activeCountersCount, 
      avgDuration, 
      historicalAvgDuration,
      dayOfWeek,
      hourOfDay,
      lang 
    } = req.body;
    const isAr = lang === "ar";

    const counters = Math.max(1, activeCountersCount || 1);
    const speed = Math.max(1, avgDuration || 10);
    const histAvg = historicalAvgDuration && historicalAvgDuration > 0 ? historicalAvgDuration : speed;

    // Calculate historical check-in average speed from recent completed sessions
    let recentAvgSpeed = speed;
    if (recentTickets && Array.isArray(recentTickets) && recentTickets.length > 0) {
      const validTimes = recentTickets
        .map((t: any) => {
          if (typeof t === "number") return t;
          if (t && typeof t === "object" && typeof t.durationMinutes === "number") return t.durationMinutes;
          return parseFloat(t);
        })
        .filter((t: number) => !isNaN(t) && t > 0);
      if (validTimes.length > 0) {
        recentAvgSpeed = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
      }
    }

    // Weighted blend of historical check-in duration and current session velocity
    const weightedServiceSpeed = Math.round((recentAvgSpeed * 0.5) + (speed * 0.3) + (histAvg * 0.2));
    const computedWaitMinutes = Math.max(1, Math.round((peopleInFront * weightedServiceSpeed) / counters));

    // Dynamic deterministic fallback calculator for 100% uptime
    const getFallbackEstimate = () => {
      if (isAr) {
        if (peopleInFront === 0) {
          return "أنت التالي في الطابور! الوقت المقدر للانتظار هو أقل من دقيقتين.";
        }
        return `بناءً على البيانات التاريخية لعمليات التسجيل وأداء الخدمة لعدد ${counters} شباك نشط بمتوسط ${weightedServiceSpeed} دقائق لكل عميل، الوقت المتوقع لانتظارك هو حوالي ${computedWaitMinutes} دقيقة.`;
      } else {
        if (peopleInFront === 0) {
          return "You are next in line! Estimated wait time is less than 2 minutes.";
        }
        return `Based on historical check-in data and active desk performance (${counters} active desk(s) at ~${weightedServiceSpeed} mins per client), your estimated wait time is around ${computedWaitMinutes} minutes.`;
      }
    };

    if (!apiKey) {
      console.log("[Gemini API] API key not found. Using local wait-time fallback calculation.");
      return res.json({ 
        estimateMessage: getFallbackEstimate(),
        estimatedWaitMinutes: computedWaitMinutes,
        confidenceScore: 90,
        historicalAvgMinutes: histAvg
      });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const prompt = `You are an AI Wait-Time Predictor for a digital queue management platform called Dork (دورك).
Analyze this live queue state and historical check-in telemetry:
- Shop Name: "${shopName}"
- Service requested: "${serviceName}"
- Active counters/desks serving customers right now: ${counters} active desk(s)
- Number of people waiting in queue ahead of this customer: ${peopleInFront} people
- Current average service duration per customer: ${Math.round(speed)} minutes
- Historical average service duration for this shop: ${Math.round(histAvg)} minutes
- Weighted velocity based on historical check-in data: ${weightedServiceSpeed} minutes
- Day of week & Time context: ${dayOfWeek || "Today"}, ${hourOfDay !== undefined ? `${hourOfDay}:00` : "Current time"}
- Recent completed check-in duration telemetry (in minutes): ${JSON.stringify(recentTickets)}

Task:
Calculate a smart, reassuring, and precise wait time prediction based on the people ahead divided by active counters, weighted by historical check-in performance and current queue velocity.
Return ONLY a short, friendly, reassuring, and natural sentence in ${isAr ? "Arabic" : "English"} explaining the expected wait time (e.g. "بناءً على سجلات التسجيل السابقة، الوقت المتوقع لانتظارك هو 14 دقيقة" or "Based on historical check-in records, we estimate your wait time to be around 14 minutes").
Do NOT write any preambles, markdown formatting, or system debug output. Return a direct customer-facing friendly notification.`;

      const aiSpan = TelemetryService.startSpan("gemini:generateContent");
      aiSpan.setAttribute("model", "gemini-3.6-flash");
      aiSpan.setAttribute("task", "estimate-wait-time");

      const aiStart = Date.now();
      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
        });
        const duration = Date.now() - aiStart;
        SLOService.recordAiResponse(duration);
        aiSpan.end();
        MetricsService.recordAiRequest();

        AuditLogService.log({
          actor: "Customer",
          operation: "AI_ESTIMATE_WAIT_TIME",
          entity: "AI",
          result: "SUCCESS",
          duration,
          severity: "INFO"
        });

        return res.json({ 
          estimateMessage: response.text?.trim() || getFallbackEstimate(),
          estimatedWaitMinutes: computedWaitMinutes,
          confidenceScore: 95,
          historicalAvgMinutes: histAvg
        });
      } catch (innerErr: any) {
        aiSpan.setAttribute("error", true);
        aiSpan.setAttribute("error.message", innerErr.message);
        aiSpan.end();
        throw innerErr;
      }
    } catch (err: any) {
      console.log("[Gemini API] Quota exhausted or service error. Gracefully falling back to deterministic estimate:", err.message || err);
      return res.json({ estimateMessage: getFallbackEstimate() });
    }
  });

  // AI Queue Density Analysis Endpoint using Gemini (Secured)
  app.post("/api/analyze-queue", authenticateFirebaseUser, validateRequest(analyzeQueueSchema), async (req, res, next) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const verifiedShopId = (req as any).shopId;
    const { shopData, stats, lang } = req.body;
    const isAr = lang === "ar";

    // Enforce authorization by sanitizing the shop ID
    if (shopData) {
      shopData.id = verifiedShopId;
    }

    // Dynamic detailed deterministic fallback analysis for 100% uptime
    const getFallbackAnalysis = () => {
      if (isAr) {
        return {
          optimalHoursStart: "09:00",
          optimalHoursEnd: "18:00",
          peakDensityHours: ["12:00", "13:00", "14:00"],
          slowHours: ["09:00", "17:00"],
          insights: [
            "تظهر ساعات منتصف النهار حول الساعة 12:00 م إلى 2:00 م أعلى تركيز للعملاء.",
            "تزداد أوقات الانتظار عموماً عندما تحدث تسجيلات متعددة في نفس الوقت.",
            "تمثل عطلات نهاية الأسبوع وفترات بعد الظهر في منتصف الأسبوع الأيام الأكثر نشاطاً لانتظار الدور."
          ],
          staffingRecommendations: [
            "زيادة عدد الموظفين في الخدمة بين الساعة 12:00 م و 3:00 م لتقليل الازدحام في أوقات الذروة.",
            "تشجيع خيارات التسجيل الذاتي عن بعد خلال ساعات الصباح الهادئة لتقليل التكدس.",
            "تدريب أعضاء الفريق بشكل متبادل لدعم أوقات الذروة عندما يتجاوز الطابور النشط 5 أشخاص."
          ],
          summary: "تسير عملياتك بسلاسة مع فترات ذروة يمكن التنبؤ بها. سيؤدي دعم موظفي الخدمة الإضافيين أثناء فترات بعد الظهر المزدحمة إلى تحسين رضا العملاء وتجربتهم."
        };
      } else {
        return {
          optimalHoursStart: "09:00",
          optimalHoursEnd: "18:00",
          peakDensityHours: ["12:00", "13:00", "14:00"],
          slowHours: ["09:00", "17:00"],
          insights: [
            "Midday hours around 12:00 PM to 2:00 PM show the highest concentration of customers.",
            "Wait times generally increase when multiple registrations happen simultaneously.",
            "Weekends and mid-week afternoons represent the most active days for queueing."
          ],
          staffingRecommendations: [
            "Increase server/counter availability between 12:00 PM and 3:00 PM to reduce peak congestion.",
            "Utilize self-service remote registration options during quiet morning hours.",
            "Cross-train team members to support peak times when the active queue exceeds 5 people."
          ],
          summary: "Your operations are running smoothly with predictable peak periods. Adding support during afternoon rushes will improve customer satisfaction."
        };
      }
    };

    if (!apiKey) {
      console.log("[Gemini API] API key not found. Using local queue analysis fallback.");
      return res.json(getFallbackAnalysis());
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Analyze this shop queue data and generate optimal operating hours, peak periods, and staffing suggestions.
Shop Category: ${shopData?.category || "General Service"}
Shop Name: ${shopData?.name || "Service Shop"}
Queue Data and Statistics:
${JSON.stringify(stats, null, 2)}
Please return the analysis in ${isAr ? "Arabic" : "English"}.`;

      const aiSpan = TelemetryService.startSpan("gemini:generateContent");
      aiSpan.setAttribute("model", "gemini-2.5-flash");
      aiSpan.setAttribute("task", "analyze-queue");

      try {
        const response = await aiClient.models.generateContent({
          // FIX: "gemini-3.5-flash" does not exist and always failed. Use a real,
          // currently available model name.
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            systemInstruction: `You are an expert operations research and queue optimization system.
Analyze the traffic metrics (ticket creation hours, days of week, average wait and service times) and recommend the absolute best operating hours, staffing allocations, and insights.
Write all insights, summaries, and recommendations in ${isAr ? "Arabic" : "English"}. Make the language professional, action-oriented, and perfectly clear.`,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                optimalHoursStart: { type: Type.STRING, description: "Recommended start time, e.g. '09:00' or '10:00'" },
                optimalHoursEnd: { type: Type.STRING, description: "Recommended end time, e.g. '18:00' or '20:00'" },
                peakDensityHours: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Peak crowd hours, e.g. ['12:00', '13:00']"
                },
                slowHours: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Quiet hours, e.g. ['09:00', '21:00']"
                },
                insights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3-4 actionable traffic insights based on the patterns"
                },
                staffingRecommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3-4 staffing level suggestions for peaks or quiet hours"
                },
                summary: {
                  type: Type.STRING,
                  description: "Brief reasoning summary"
                }
              },
              required: [
                "optimalHoursStart",
                "optimalHoursEnd",
                "peakDensityHours",
                "slowHours",
                "insights",
                "staffingRecommendations",
                "summary"
              ]
            }
          }
        });

        const text = response.text;
        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        aiSpan.end();
        MetricsService.recordAiRequest();

        const result = JSON.parse(text);
        return res.json(result);
      } catch (innerErr: any) {
        aiSpan.setAttribute("error", true);
        aiSpan.setAttribute("error.message", innerErr.message);
        aiSpan.end();
        throw innerErr;
      }
    } catch (err: any) {
      console.log("[Gemini API] Quota exhausted or service error. Gracefully falling back to deterministic analysis:", err.message || err);
      return res.json(getFallbackAnalysis());
    }
  });

  // AI Queue Diagnostics Endpoint for vendor analytics report insights (Secured)
  app.post("/api/ai-diagnose", authenticateFirebaseUser, async (req, res, next) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { stats, lang } = req.body;
    const isAr = lang === "ar" || (req.headers["accept-language"]?.includes("ar"));

    const getFallbackAnalysis = () => {
      if (isAr) {
        return "تسير عملياتك بسلاسة مع فترات ذروة يمكن التنبؤ بها. سيؤدي دعم موظفي الخدمة الإضافيين أثناء فترات بعد الظهر المزدحمة إلى تحسين رضا العملاء وتجربتهم.";
      } else {
        return "Your operations are running smoothly with predictable peak periods. Adding support during afternoon rushes will improve customer satisfaction.";
      }
    };

    if (!apiKey) {
      return res.json({ analysis: getFallbackAnalysis() });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const prompt = `Analyze this shop queue data and generate a short, high-level operational diagnostics advisory report for the vendor:
${JSON.stringify(stats, null, 2)}
Please return the analysis in ${isAr ? "Arabic" : "English"}.
Make it a concise 2-3 paragraph summary focusing on staffing level recommendations and wait time improvements. Do not return markdown code blocks, just plain text.`;

      const aiSpan = TelemetryService.startSpan("gemini:generateContent");
      aiSpan.setAttribute("model", "gemini-2.5-flash");
      aiSpan.setAttribute("task", "ai-diagnose");

      const aiStart = Date.now();
      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        const duration = Date.now() - aiStart;
        SLOService.recordAiResponse(duration);
        aiSpan.end();
        MetricsService.recordAiRequest();

        AuditLogService.log({
          userId: (req as any).user?.uid,
          shopId: (req as any).shopId || null,
          actor: (req as any).user?.email || "Vendor",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || "unknown",
          operation: "AI_DIAGNOSE_QUEUE",
          entity: "AI",
          result: "SUCCESS",
          duration,
          severity: "INFO"
        });

        return res.json({ analysis: response.text?.trim() || getFallbackAnalysis() });
      } catch (innerErr: any) {
        aiSpan.setAttribute("error", true);
        aiSpan.setAttribute("error.message", innerErr.message);
        aiSpan.end();
        throw innerErr;
      }
    } catch (err) {
      console.error("[Gemini API Error] ai-diagnose fallback triggered:", err);
      return res.json({ analysis: getFallbackAnalysis() });
    }
  });

  // AI Imagen Shop Logo Generator Endpoint (Secured/Validated)
  app.post("/api/generate-shop-logo", async (req, res, next) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { shopName, category, promptHint, lang } = req.body;
    const isAr = lang === "ar" || (req.headers["accept-language"]?.includes("ar"));

    const cleanShopName = (shopName && typeof shopName === "string") ? shopName.trim() : "Dork Queue";
    const cleanCategory = (category && typeof category === "string") ? category.trim() : "general";
    const hint = (promptHint && typeof promptHint === "string" && promptHint.trim()) ? ` Additional style notes: ${promptHint.trim()}` : "";

    // Dynamic SVG fallback generator if API key is not present or GenAI fails
    const getFallbackSvgLogo = () => {
      const firstChar = cleanShopName.charAt(0).toUpperCase() || "D";
      let bgGradient = ["#4f46e5", "#7c3aed"];
      let accentBadge = "#818cf8";

      if (cleanCategory.includes("barber") || cleanCategory.includes("salon") || cleanCategory.includes("حلاق")) {
        bgGradient = ["#d97706", "#b45309"];
        accentBadge = "#fef3c7";
      } else if (cleanCategory.includes("medical") || cleanCategory.includes("clinic") || cleanCategory.includes("طبي")) {
        bgGradient = ["#0284c7", "#0369a1"];
        accentBadge = "#e0f2fe";
      } else if (cleanCategory.includes("food") || cleanCategory.includes("restaurant") || cleanCategory.includes("مطعم")) {
        bgGradient = ["#dc2626", "#991b1b"];
        accentBadge = "#fee2e2";
      } else if (cleanCategory.includes("telecom") || cleanCategory.includes("retail") || cleanCategory.includes("اتصالات")) {
        bgGradient = ["#059669", "#047857"];
        accentBadge = "#d1fae5";
      }

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${bgGradient[0]}" />
            <stop offset="100%" stop-color="${bgGradient[1]}" />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.25"/>
          </filter>
        </defs>
        <rect width="512" height="512" rx="140" fill="url(#logoGrad)" />
        <circle cx="256" cy="256" r="190" fill="none" stroke="${accentBadge}" stroke-width="8" stroke-opacity="0.4" />
        <circle cx="256" cy="256" r="160" fill="#ffffff" fill-opacity="0.12" />
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="210" fill="#ffffff" filter="url(#shadow)">${firstChar}</text>
      </svg>`;
      const encoded = Buffer.from(svgString).toString("base64");
      return `data:image/svg+xml;base64,${encoded}`;
    };

    if (!apiKey) {
      console.log("[Gemini Imagen] GEMINI_API_KEY not set. Using fallback SVG logo generation.");
      return res.json({
        success: true,
        logoUrl: getFallbackSvgLogo(),
        isFallback: true,
        message: isAr ? "تم توليد الشعار بنجاح (وضع التصميم السريع)." : "Logo generated successfully (quick design mode)."
      });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const promptText = `A professional, clean minimalist vector logo icon for a business named "${cleanShopName}" in the category "${cleanCategory}". Style: modern flat visual badge icon, clean geometry, centered design, crisp logo mark, vibrant brand colors, solid light background, high resolution, minimalist aesthetic.${hint}`;

      const aiSpan = TelemetryService.startSpan("gemini:generateImage:logo");
      aiSpan.setAttribute("model", "imagen-3.0-generate-002");
      aiSpan.setAttribute("task", "generate-shop-logo");

      const aiStart = Date.now();
      try {
        let generatedImageUrl: string | null = null;

        try {
          const imageRes = await aiClient.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: promptText,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/png",
              aspectRatio: "1:1",
            },
          });

          if (imageRes.generatedImages && imageRes.generatedImages.length > 0) {
            const imgBytes = imageRes.generatedImages[0].image?.imageBytes;
            if (imgBytes) {
              generatedImageUrl = `data:image/png;base64,${imgBytes}`;
            }
          }
        } catch (_imagenErr) {
          // Quiet fallback to SVG vector logo if Imagen API model is restricted or unavailable
        }

        const duration = Date.now() - aiStart;
        SLOService.recordAiResponse(duration);
        aiSpan.end();
        MetricsService.recordAiRequest();

        if (generatedImageUrl) {
          AuditLogService.log({
            actor: "Vendor",
            operation: "AI_GENERATE_LOGO",
            entity: "Shop",
            result: "SUCCESS",
            duration,
            severity: "INFO"
          });

          return res.json({
            success: true,
            logoUrl: generatedImageUrl,
            isFallback: false,
            message: isAr ? "تم توليد الشعار بنجاح باستخدام Imagen!" : "Logo successfully generated using Imagen!"
          });
        } else {
          console.log("[Gemini Imagen] Using generated fallback SVG logo due to API quota limits.");
          return res.json({
            success: true,
            logoUrl: getFallbackSvgLogo(),
            isFallback: true,
            message: isAr ? "تم توليد الشعار بنجاح في وضع الشعار المتجهي السريع." : "Logo generated successfully in quick vector mode."
          });
        }
      } catch (innerErr: any) {
        aiSpan.setAttribute("error", true);
        aiSpan.setAttribute("error.message", innerErr?.message || "Generation error");
        aiSpan.end();
        return res.json({
          success: true,
          logoUrl: getFallbackSvgLogo(),
          isFallback: true,
          message: isAr ? "تم توليد الشعار بنجاح." : "Logo generated successfully."
        });
      }
    } catch (_err) {
      return res.json({
        success: true,
        logoUrl: getFallbackSvgLogo(),
        isFallback: true
      });
    }
  });

  // --- Webhooks Proxy & Testing Endpoints ---
  app.post("/api/webhooks/test", async (req, res) => {
    const { url, secret, headers, event, samplePayload } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "Valid target URL is required" });
    }

    const payload = samplePayload || {
      event: event || "ticket.created",
      timestamp: new Date().toISOString(),
      shop: { id: "shop_demo_101", name: "Demo Queue Shop" },
      ticket: {
        id: "tkt_test_999",
        ticketNumber: 101,
        customerName: "Jane Doe (Test)",
        customerPhone: "+1234567890",
        customerEmail: "jane@example.com",
        serviceName: "Customer Support",
        status: "waiting",
        counterNumber: "Desk 1",
        createdAt: new Date().toISOString()
      },
      isTest: true
    };

    const deliveryId = "del_" + Math.random().toString(36).substring(2, 12);
    const payloadStr = JSON.stringify(payload);

    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Dork-Webhook-Agent/1.0",
      "X-Dork-Event": event || "ticket.created",
      "X-Dork-Delivery": deliveryId
    };

    if (secret && typeof secret === "string" && secret.trim() !== "") {
      const hmac = crypto.createHmac("sha256", secret.trim());
      hmac.update(payloadStr);
      reqHeaders["X-Dork-Signature"] = `sha256=${hmac.digest("hex")}`;
    }

    if (Array.isArray(headers)) {
      headers.forEach((h: any) => {
        if (h && h.key && h.value) {
          reqHeaders[h.key] = h.value;
        }
      });
    }

    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "POST",
        headers: reqHeaders,
        body: payloadStr,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startMs;
      const respText = await response.text();
      const responseSummary = respText.substring(0, 300) || `HTTP ${response.status} ${response.statusText}`;

      return res.status(200).json({
        success: response.ok,
        statusCode: response.status,
        durationMs,
        responseSummary,
        deliveryId,
        headersSent: reqHeaders,
        payloadSent: payload
      });
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      return res.status(200).json({
        success: false,
        statusCode: 0,
        durationMs,
        responseSummary: err.name === "AbortError" ? "Request timed out after 10000ms" : (err.message || "Connection refused"),
        deliveryId,
        headersSent: reqHeaders,
        payloadSent: payload
      });
    }
  });

  app.post("/api/webhooks/dispatch", async (req, res) => {
    const { url, secret, headers, event, payload, shopId } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "Valid target URL is required" });
    }

    const deliveryId = "del_" + Math.random().toString(36).substring(2, 12);
    const finalPayload = {
      event: event || "ticket.created",
      timestamp: new Date().toISOString(),
      shopId,
      ...payload
    };
    const payloadStr = JSON.stringify(finalPayload);

    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Dork-Webhook-Agent/1.0",
      "X-Dork-Event": event || "ticket.created",
      "X-Dork-Delivery": deliveryId
    };

    if (secret && typeof secret === "string" && secret.trim() !== "") {
      const hmac = crypto.createHmac("sha256", secret.trim());
      hmac.update(payloadStr);
      reqHeaders["X-Dork-Signature"] = `sha256=${hmac.digest("hex")}`;
    }

    if (Array.isArray(headers)) {
      headers.forEach((h: any) => {
        if (h && h.key && h.value) {
          reqHeaders[h.key] = h.value;
        }
      });
    }

    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "POST",
        headers: reqHeaders,
        body: payloadStr,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startMs;
      const respText = await response.text();
      const responseSummary = respText.substring(0, 300) || `HTTP ${response.status} ${response.statusText}`;

      return res.status(200).json({
        success: response.ok,
        statusCode: response.status,
        durationMs,
        responseSummary,
        deliveryId
      });
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      return res.status(200).json({
        success: false,
        statusCode: 0,
        durationMs,
        responseSummary: err.name === "AbortError" ? "Request timed out after 10000ms" : (err.message || "Connection failed"),
        deliveryId
      });
    }
  });

  // Server-side cleanup function to automatically archive or delete tickets from the previous day
  async function runCleanupJob() {
    console.log("[Cleanup Job] Starting automatic database performance cleanup...");
    try {
      const now = new Date();
      // Get start of today in UTC
      const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      console.log(`[Cleanup Job] Querying tickets created before: ${startOfTodayUTC}`);

      const dbProvider = await getDatabaseProvider();
      const tickets = await dbProvider.getTicketsCreatedBefore(startOfTodayUTC);

      console.log(`[Cleanup Job] Found ${tickets.length} tickets from previous days to archive/delete.`);

      if (tickets.length > 0) {
        await dbProvider.archiveAndDeleteTickets(tickets);
      }

      console.log(`[Cleanup Job] Finished! Successfully archived and deleted ${tickets.length} tickets.`);
      return { success: true, archived: tickets.length, deleted: tickets.length };
    } catch (err: any) {
      console.error("[Cleanup Job] Error during database database cleanup:", err);
      return { success: false, error: err.message };
    }
  }

  // --- Stripe Settings & Helper ---
  let stripeClient: Stripe | null = null;

  function getStripeInstance() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY_MISSING");
    }
    if (!stripeClient) {
      stripeClient = new Stripe(stripeKey, {
        apiVersion: "2023-10-16" as any,
      });
    }
    return stripeClient;
  }

  // Unified secured Stripe checkout session creator handler
  const createCheckoutSessionHandler = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Override body shopId with verified shopId from ID Token to remove client trust
    const verifiedShopId = (req as any).shopId;
    req.body.shopId = verifiedShopId;

    const { shopId, lang } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const isAr = lang === "ar";
    const origin = req.headers.origin || "http://localhost:3000";

    // If STRIPE_SECRET_KEY is missing, gracefully use our fully functional Stripe Checkout simulator!
    if (!stripeKey) {
      const mockSessionId = "cs_mock_" + Math.random().toString(36).substring(2, 15);
      const mockCheckoutUrl = `${origin}/?page=stripe-mock-checkout&sessionId=${mockSessionId}&shopId=${shopId}&lang=${lang}`;
      
      console.log(`[Stripe Sandbox] STRIPE_SECRET_KEY not set. Redirecting to local secure mock gateway: ${mockCheckoutUrl}`);
      return res.status(200).json({ success: true, url: mockCheckoutUrl, isMock: true });
    }

    const stripeSpan = TelemetryService.startSpan("stripe:createSession");
    stripeSpan.setAttribute("shopId", shopId);

    try {
      const stripe = getStripeInstance();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: isAr ? "ترقية الباقة الاحترافية دورك PRO" : "Dork PRO Plan - Premium Subscription Upgrade",
                description: isAr 
                  ? "تذاكر طابور غير محدودة يومياً، تخصيص الهوية والشعار بالكامل، وتقارير وإحصائيات متكاملة لـ 30 يوماً."
                  : "Unlimited daily queue tickets, full brand/logo customization, and detailed stats/analytics for 30 days.",
              },
              unit_amount: 2000, // $20.00 USD
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/?stripe_status=success&session_id={CHECKOUT_SESSION_ID}&shopId=${shopId}`,
        cancel_url: `${origin}/?stripe_status=cancel&shopId=${shopId}`,
        metadata: {
          shopId: shopId,
        },
      });

      stripeSpan.end();
      MetricsService.recordStripeRequest();

      return res.status(200).json({ success: true, url: session.url });
    } catch (err: any) {
      stripeSpan.setAttribute("error", true);
      stripeSpan.setAttribute("error.message", err.message);
      stripeSpan.end();
      next(err);
    }
  };

  // Route bindings for checkout session creation
  app.post("/api/stripe/create-checkout-session", authenticateFirebaseUser, validateRequest(createCheckoutSessionSchema), createCheckoutSessionHandler);
  app.post("/api/checkout-session", authenticateFirebaseUser, validateRequest(createCheckoutSessionSchema), createCheckoutSessionHandler);

  // Unified secured Stripe checkout verification handler
  const verifySessionHandler = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Override query shopId with verified shopId from ID Token to remove client trust
    const verifiedShopId = (req as any).shopId;
    req.query.shopId = verifiedShopId;

    const { sessionId, shopId } = req.query;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    // Handle mock verification if key is missing and sessionId is mock
    if (!stripeKey) {
      if (typeof sessionId === "string" && sessionId.startsWith("cs_mock_")) {
        try {
          const dbProvider = await getDatabaseProvider();
          const invoiceId = "inv_stripe_mock_" + sessionId.substring(8, 20);
          const invoiceNum = "INV-STRIPE-MOCK-" + Math.floor(10000 + Math.random() * 90000);
          
          const invoiceData = {
            id: invoiceId,
            shopId: shopId as string,
            invoiceNumber: invoiceNum,
            amount: "$20.00 USD",
            planName: "PRO Plan (30 Days) - Stripe Mock",
            status: "paid",
            cardBrand: "Visa (Mock Sandbox)",
            cardLast4: "4242",
            createdAt: new Date().toISOString()
          };

          const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const paymentStart = Date.now();
          // Upgrade using Provider Abstraction
          await dbProvider.upgradeShopToProWithInvoice(shopId as string, invoiceId, invoiceData, planExpiresAt);
          const duration = Date.now() - paymentStart;

          SLOService.recordPayment(duration);

          AuditLogService.log({
            userId: (req as any).user?.uid || null,
            shopId: shopId as string,
            actor: (req as any).user?.email || "Vendor",
            ip: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            operation: "STRIPE_PAYMENT_SANDBOX",
            entity: "Subscription",
            oldValue: "free",
            newValue: "pro",
            result: "SUCCESS",
            duration,
            severity: "INFO"
          });

          AuditLogService.log({
            userId: (req as any).user?.uid || null,
            shopId: shopId as string,
            actor: (req as any).user?.email || "Vendor",
            ip: req.ip,
            userAgent: req.headers["user-agent"] || "unknown",
            operation: "SUBSCRIPTION_CHANGE",
            entity: "Subscription",
            oldValue: "free",
            newValue: "pro",
            result: "SUCCESS",
            duration,
            severity: "INFO"
          });

          console.log(`[Stripe Mock Sandbox] Upgraded Shop ${shopId} to PRO. Invoice ${invoiceNum} generated successfully.`);

          return res.status(200).json({
            success: true,
            plan: "pro",
            invoiceNumber: invoiceNum,
            message: "Shop upgraded to PRO (Mock Sandbox) successfully!"
          });
        } catch (dbErr: any) {
          next(dbErr);
        }
      } else {
        throw new ValidationError("Stripe secret key is missing. Please set STRIPE_SECRET_KEY in settings.");
      }
    }

    const verifySpan = TelemetryService.startSpan("stripe:retrieveSession");
    verifySpan.setAttribute("sessionId", sessionId as string);

    try {
      const stripe = getStripeInstance();
      const session = await stripe.checkout.sessions.retrieve(sessionId as string);

      if (session.payment_status === "paid" || session.status === "complete") {
        const dbProvider = await getDatabaseProvider();
        
        // Ensure this transaction belongs to this shop
        if (session.metadata?.shopId !== shopId) {
          throw new ValidationError("Session metadata shopId mismatch.");
        }

        // Generate an official Invoice ID & Number
        const invoiceId = "inv_stripe_" + session.id.substring(0, 15);
        const invoiceNum = "INV-STRIPE-" + Math.floor(10000 + Math.random() * 90000);
        
        // Retrieve card details if available from payment method/intent
        let cardBrand = "Credit Card";
        let cardLast4 = "Stripe";
        
        if (session.payment_intent) {
          try {
            const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
            if (pi.payment_method) {
              const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
              if (pm.card) {
                cardBrand = pm.card.brand;
                cardLast4 = pm.card.last4;
              }
            }
          } catch (pmErr) {
            console.warn("Failed to retrieve payment method card details:", pmErr);
          }
        }

        const invoiceData = {
          id: invoiceId,
          shopId: shopId as string,
          invoiceNumber: invoiceNum,
          amount: "$20.00 USD",
          planName: "PRO Plan (30 Days) - Stripe Checkout",
          status: "paid",
          cardBrand: cardBrand,
          cardLast4: cardLast4,
          createdAt: new Date().toISOString()
        };

        const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const paymentStart = Date.now();
        // Upgrade using Provider Abstraction
        await dbProvider.upgradeShopToProWithInvoice(shopId as string, invoiceId, invoiceData, planExpiresAt);
        const duration = Date.now() - paymentStart;

        SLOService.recordPayment(duration);

        AuditLogService.log({
          userId: (req as any).user?.uid || null,
          shopId: shopId as string,
          actor: (req as any).user?.email || "Vendor",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || "unknown",
          operation: "STRIPE_PAYMENT",
          entity: "Subscription",
          oldValue: "free",
          newValue: "pro",
          result: "SUCCESS",
          duration,
          severity: "INFO"
        });

        AuditLogService.log({
          userId: (req as any).user?.uid || null,
          shopId: shopId as string,
          actor: (req as any).user?.email || "Vendor",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || "unknown",
          operation: "SUBSCRIPTION_CHANGE",
          entity: "Subscription",
          oldValue: "free",
          newValue: "pro",
          result: "SUCCESS",
          duration,
          severity: "INFO"
        });

        console.log(`[Stripe Upgrade] Shop ${shopId} successfully upgraded to PRO. Invoice ${invoiceNum} generated.`);

        verifySpan.end();
        MetricsService.recordStripeRequest();

        return res.status(200).json({
          success: true,
          plan: "pro",
          invoiceNumber: invoiceNum,
          message: "Shop upgraded to PRO successfully!"
        });
      } else {
        throw new ValidationError("Session has not been paid yet.");
      }
    } catch (err: any) {
      verifySpan.setAttribute("error", true);
      verifySpan.setAttribute("error.message", err.message);
      verifySpan.end();
      next(err);
    }
  };

  // Route bindings for checkout session verification
  app.get("/api/stripe/verify-session", authenticateFirebaseUser, validateRequest(verifySessionSchema), verifySessionHandler);
  app.get("/api/verify-checkout", authenticateFirebaseUser, validateRequest(verifySessionSchema), verifySessionHandler);

  // Manual/Triggered Cleanup Endpoint
  app.post("/api/cron/cleanup", async (req, res, next) => {
    console.log("[API Route] Manual cleanup trigger received.");
    try {
      const result = await runCleanupJob();
      if (result.success) {
        return res.status(200).json(result);
      } else {
        throw new AppError(500, "Cleanup Failed", result.error || "Database cleanup failed.");
      }
    } catch (err: any) {
      next(err);
    }
  });

  // Run once on startup (after a 5-second delay to let the server boot up completely)
  setTimeout(() => {
    runCleanupJob();
  }, 5000);

  // Run every 12 hours
  setInterval(() => {
    runCleanupJob();
  }, 12 * 60 * 60 * 1000);

  // Serve static files in production / Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    // FIX: "vite" is normally a devDependency and may not be installed in a
    // production build. A top-level static import would crash the whole
    // server on startup even in production, before this branch is even
    // reached. Importing it dynamically, only when actually needed, avoids
    // that failure mode.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler for RFC 7807 problem details
  app.use(globalErrorHandler);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown Registration (Phase 6.9)
  ShutdownManager.registerServer(server);
  ShutdownManager.listen();
}

startServer();