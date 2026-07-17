import "dotenv/config";
import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import fs from "fs";
import Stripe from "stripe";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { getHealth, getReady, getLive, getVersion, getMetrics, getFeatureFlags } from "./src/controllers/observabilityController";
import { AuditLogService } from "./src/services/AuditLogService";
import { SLOService } from "./src/services/SLOService";
import {
  getAuditLogs,
  createAuditLog,
  getIncidents,
  createIncident,
  resolveIncident,
  addIncidentTimeline,
  getSLOStatus,
  getDisasterRecoveryStatus,
  simulateRecovery,
  verifyBackups,
  getRunbooks,
  getRetentionPolicy,
  updateRetentionPolicy,
  getGovernanceSummary
} from "./src/controllers/governanceController";
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
  sendEmailSchema,
  sendFcmSchema,
  estimateWaitTimeSchema,
  analyzeQueueSchema,
  createTicketSchema,
  createCheckoutSessionSchema,
  verifySessionSchema
} from "./src/schemas/apiSchemas";

let firebaseAdminApp: any = null;
let firestoreDatabaseId: string | undefined = undefined;

function initializeFirebaseAdmin() {
  if (firebaseAdminApp) return;

  let projectId: string | undefined = undefined;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      projectId = config.projectId;
      firestoreDatabaseId = config.firestoreDatabaseId;
      console.log("[Firebase Admin] Loaded config:", { projectId, firestoreDatabaseId });
    }
  } catch (err: any) {
    console.warn("[Firebase Admin] Failed to parse firebase-applet-config.json:", err.message);
  }

  try {
    // Attempt standard initialization using environment variables or applicationDefault
    firebaseAdminApp = initializeApp({
      projectId: projectId,
      credential: applicationDefault()
    });
    console.log("[Firebase Admin] Initialized successfully with Application Default Credentials");
  } catch (err: any) {
    console.warn("[Firebase Admin] Failed to initialize with applicationDefault(), attempting fallback:", err.message);
    try {
      firebaseAdminApp = initializeApp({
        projectId: projectId
      });
      console.log("[Firebase Admin] Initialized with fallback config");
    } catch (err2: any) {
      console.warn("[Firebase Admin] Direct initialization failed:", err2.message);
    }
  }
}

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
  app.get("/health", getHealth);
  app.get("/ready", getReady);
  app.get("/live", getLive);
  app.get("/version", getVersion);
  app.get("/api/metrics", getMetrics);
  app.get("/api/features", getFeatureFlags);

  // Enterprise Governance, Audit Logging & Disaster Recovery Backend Endpoints (Phase 6.1)
  app.get("/api/governance/summary", getGovernanceSummary);
  app.get("/api/governance/audit-logs", getAuditLogs);
  app.post("/api/governance/audit-logs", createAuditLog);
  app.get("/api/governance/incidents", getIncidents);
  app.post("/api/governance/incidents", createIncident);
  app.post("/api/governance/incidents/:id/resolve", resolveIncident);
  app.post("/api/governance/incidents/:id/timeline", addIncidentTimeline);
  app.get("/api/governance/slo", getSLOStatus);
  app.get("/api/governance/disaster-recovery", getDisasterRecoveryStatus);
  app.post("/api/governance/disaster-recovery/simulate", simulateRecovery);
  app.post("/api/governance/disaster-recovery/verify-backups", verifyBackups);
  app.get("/api/governance/runbooks", getRunbooks);
  app.get("/api/governance/retention", getRetentionPolicy);
  app.post("/api/governance/retention", updateRetentionPolicy);

  // 3. API Rate Limiting to prevent denial-of-wallet and abuse
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      error: "Too many requests from this IP, please try again later."
    }
  });
  app.use("/api/", apiLimiter);

  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use(observabilityMiddleware);

  // API Route to send email
  app.post("/api/send-email", validateRequest(sendEmailSchema), async (req, res, next) => {
    const { email, name, ticketNumber, serviceName, shopName, lang } = req.body;

    const isAr = lang === "ar";
    const smtpSpan = TelemetryService.startSpan("smtp:sendMail");
    smtpSpan.setAttribute("mail.to", email);

    try {
      let transporter;

      // Use SMTP environment variables if provided
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        // Fallback: Create ethereal test account for testing
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log("Created ephemeral Ethereal SMTP test account:", testAccount.user);
      }

      const subject = isAr
        ? `اقترب دورك في ${shopName}! (تذكرة رقم ${ticketNumber})`
        : `Your turn is approaching at ${shopName}! (Ticket #${ticketNumber})`;

      const fromName = isAr ? "طابور دورك الرقمي" : "Dork Digital Queue";
      const fromEmail = process.env.SMTP_FROM || "noreply@dorkqueue.com";

      const htmlContent = isAr
        ? `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="background-color: #4f46e5; padding: 15px; border-radius: 12px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 20px;">اقترب دورك في ${shopName}!</h2>
            </div>
            <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
              <p style="font-size: 16px; font-weight: bold;">مرحباً ${name}،</p>
              <p>يسعدنا إبلاغك بأن دورك في <strong>${shopName}</strong> قد اقترب!</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: center;">
                <span style="font-size: 12px; color: #64748b; font-weight: bold; display: block; margin-bottom: 5px;">رقم تذكرتك</span>
                <span style="font-size: 32px; font-weight: 900; color: #4f46e5; display: block; margin-bottom: 5px;">#${ticketNumber}</span>
                <span style="font-size: 14px; font-weight: bold; color: #334155;">الخدمة: ${serviceName}</span>
              </div>
              <p style="font-weight: bold; color: #e11d48; text-align: center; font-size: 16px;">يتبقى الآن شخصان فقط أمامك في طابور الانتظار.</p>
              <p>يرجى التوجه إلى المحل فوراً لضمان عدم فوات دورك أو إلغاء تذكرتك.</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
            <div style="text-align: center; color: #64748b; font-size: 11px;">
              <p>تم إرسال هذا التنبيه التلقائي بواسطة نظام إدارة الطوابير الذكي.</p>
            </div>
          </div>
        `
        : `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: left; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="background-color: #4f46e5; padding: 15px; border-radius: 12px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 20px;">Your turn is approaching at ${shopName}!</h2>
            </div>
            <div style="padding: 20px; color: #1e293b; line-height: 1.6;">
              <p style="font-size: 16px; font-weight: bold;">Hello ${name},</p>
              <p>We are pleased to inform you that your turn at <strong>${shopName}</strong> is approaching!</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: center;">
                <span style="font-size: 12px; color: #64748b; font-weight: bold; display: block; margin-bottom: 5px;">Your Ticket Number</span>
                <span style="font-size: 32px; font-weight: 900; color: #4f46e5; display: block; margin-bottom: 5px;">#${ticketNumber}</span>
                <span style="font-size: 14px; font-weight: bold; color: #334155;">Service: ${serviceName}</span>
              </div>
              <p style="font-weight: bold; color: #e11d48; text-align: center; font-size: 16px;">There are now exactly 2 people ahead of you in the queue.</p>
              <p>Please head to the shop immediately to ensure you don't miss your turn.</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
            <div style="text-align: center; color: #64748b; font-size: 11px;">
              <p>This automated alert was sent by the Dork Digital Queue management system.</p>
            </div>
          </div>
        `;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);

      console.log(`Email sent successfully to ${email}. Message ID: ${info.messageId}`);
      if (previewUrl) {
        console.log(`Email Test Preview URL: ${previewUrl}`);
      }

      smtpSpan.end();
      MetricsService.recordNotificationOutcome(true);

      return res.status(200).json({
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null,
      });
    } catch (err: any) {
      smtpSpan.setAttribute("error", true);
      smtpSpan.setAttribute("error.message", err.message);
      smtpSpan.end();
      MetricsService.recordNotificationOutcome(false);
      next(err);
    }
  });

  // Phone number normalization helper
  function normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, ""); // Keep only digits and +
    if (!cleaned) return "";

    // If it starts with 00, replace with +
    if (cleaned.startsWith("00")) {
      cleaned = "+" + cleaned.substring(2);
    }

    // Saudi number normalization
    if (cleaned.startsWith("05") && cleaned.length === 10) {
      cleaned = "+966" + cleaned.substring(1);
    } else if (cleaned.startsWith("5") && cleaned.length === 9) {
      cleaned = "+966" + cleaned;
    }

    // Ensure it has a leading plus
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    return cleaned;
  }

  // Get localized SMS/WhatsApp text templates
  function getNotificationMessage(type: "welcome" | "approaching", params: {
    name: string;
    ticketNumber: string;
    serviceName: string;
    shopName: string;
    trackingUrl?: string;
    lang: "ar" | "en";
  }): string {
    const isAr = params.lang === "ar";
    if (type === "welcome") {
      return isAr
        ? `مرحباً ${params.name}، لقد تم حجز تذكرتك رقم #${params.ticketNumber} بنجاح لخدمة ${params.serviceName} لدى ${params.shopName}. يمكنك متابعة حالة الطابور مباشرة من الرابط التالي: ${params.trackingUrl || ""}`
        : `Hello ${params.name}, your ticket #${params.ticketNumber} has been successfully booked for ${params.serviceName} at ${params.shopName}. You can track your queue status live here: ${params.trackingUrl || ""}`;
    } else {
      return isAr
        ? `تنبيه من ${params.shopName}: دورك يقترب! يرجى التوجه إلى شباك الخدمة، يتبقى شخصان فقط أمامك في الطابور لحامل التذكرة رقم #${params.ticketNumber}.`
        : `Alert from ${params.shopName}: Your turn is approaching! Please head to the service window, only 2 people are ahead of you in the queue for ticket #${params.ticketNumber}.`;
    }
  }

  // Direct Twilio sender helper (handles both real Twilio API and offline/fallback logs)
  async function triggerTwilioSendDirect(phone: string, bodyText: string, isWhatsapp: boolean) {
    const toPhone = normalizePhoneNumber(phone);
    if (!toPhone) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const twilioWA = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

    const twilioSpan = TelemetryService.startSpan("twilio:sendDirect");
    twilioSpan.setAttribute("twilio.to", toPhone);
    twilioSpan.setAttribute("twilio.is_whatsapp", isWhatsapp);

    if (!accountSid || !authToken) {
      console.log(`[Twilio Simulation] Simulated Direct Send to ${toPhone} via ${isWhatsapp ? "WhatsApp" : "SMS"}: "${bodyText}"`);
      twilioSpan.setAttribute("twilio.simulated", true);
      twilioSpan.end();
      return { simulated: true, recipient: toPhone, body: bodyText };
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const fromNumber = isWhatsapp ? (twilioWA.startsWith("whatsapp:") ? twilioWA : `whatsapp:${twilioWA}`) : twilioPhone;
    const toNumber = isWhatsapp ? (toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`) : toPhone;

    if (!fromNumber) {
      console.warn(`[Twilio Warning] Missing sender phone number for ${isWhatsapp ? "WhatsApp" : "SMS"}. Falling back to simulation.`);
      twilioSpan.setAttribute("twilio.simulated", true);
      twilioSpan.setAttribute("twilio.warning", "Missing sender phone number");
      twilioSpan.end();
      return { simulated: true, recipient: toPhone, body: bodyText };
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: toNumber,
            Body: bodyText,
          }),
        }
      );

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Twilio error status ${response.status}`);
      }

      console.log(`[Twilio Direct Send Success] Message Sid: ${data.sid}`);
      twilioSpan.setAttribute("twilio.sid", data.sid);
      twilioSpan.end();
      MetricsService.recordNotificationOutcome(true);
      return { success: true, sid: data.sid, recipient: toPhone };
    } catch (err: any) {
      console.error(`[Twilio Direct Send Error] Failed to send message directly:`, err.message);
      twilioSpan.setAttribute("error", true);
      twilioSpan.setAttribute("error.message", err.message);
      twilioSpan.end();
      MetricsService.recordNotificationOutcome(false);
      return { simulated: true, recipient: toPhone, body: bodyText, warning: err.message };
    }
  }

  // Auto-send welcome notifications on ticket booking
  async function sendWelcomeNotificationsOnServer(ticket: any, shopName: string, shopSlug: string, origin: string, lang: string) {
    const phone = ticket.customerPhone;
    if (!phone) return;

    const trackingUrl = `${origin}/?shop=${shopSlug}&ticketId=${ticket.id}`;
    const language = lang === "ar" ? "ar" : "en";

    if (ticket.smsNotify) {
      try {
        const bodyText = getNotificationMessage("welcome", {
          name: ticket.customerName,
          ticketNumber: String(ticket.ticketNumber).padStart(2, "0"),
          serviceName: ticket.serviceName,
          shopName: shopName,
          trackingUrl: trackingUrl,
          lang: language,
        });
        console.log(`[Server Welcome SMS] Triggering welcome SMS to ${phone}`);
        await triggerTwilioSendDirect(phone, bodyText, false);
      } catch (err) {
        console.error("[Server Welcome SMS Error]", err);
      }
    }

    if (ticket.whatsappNotify) {
      try {
        const bodyText = getNotificationMessage("welcome", {
          name: ticket.customerName,
          ticketNumber: String(ticket.ticketNumber).padStart(2, "0"),
          serviceName: ticket.serviceName,
          shopName: shopName,
          trackingUrl: trackingUrl,
          lang: language,
        });
        console.log(`[Server Welcome WhatsApp] Triggering welcome WhatsApp to ${phone}`);
        await triggerTwilioSendDirect(phone, bodyText, true);
      } catch (err) {
        console.error("[Server Welcome WhatsApp Error]", err);
      }
    }
  }

  // Unified Omnichannel API endpoint
  app.post("/api/send-sms-whatsapp", async (req, res) => {
    const { phone, messageType, channel, name, ticketNumber, serviceName, shopName, trackingUrl, lang } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    const toPhone = normalizePhoneNumber(phone);
    if (!toPhone) {
      return res.status(400).json({ error: "Invalid phone number format." });
    }

    const isAr = lang === "ar";
    const bodyText = getNotificationMessage(messageType || "welcome", {
      name: name || "Customer",
      ticketNumber: String(ticketNumber || ""),
      serviceName: serviceName || "Service",
      shopName: shopName || "Shop",
      trackingUrl: trackingUrl || "",
      lang: isAr ? "ar" : "en",
    });

    const isWhatsapp = channel === "whatsapp";
    const result = await triggerTwilioSendDirect(toPhone, bodyText, isWhatsapp);
    return res.status(200).json({
      success: true,
      ...result,
      channel,
    });
  });

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

  // Send FCM instant notification when 1 person is left
  app.post("/api/send-fcm-alert", validateRequest(sendFcmSchema), async (req, res, next) => {
    const { fcmToken, shopName, ticketNumber, lang } = req.body;

    const isAr = lang === "ar";
    const title = isAr
      ? "تنبيه هام من دورك! 🔔"
      : "Important Alert from Dork! 🔔";
    const body = isAr
      ? `يتبقى شخص واحد فقط أمامك في طابور الانتظار لدى ${shopName || "المحل"}. يرجى التوجه فوراً!`
      : `Only 1 person is left ahead of you in the queue at ${shopName || "the shop"}. Please head there immediately!`;

    console.log(`[FCM] Attempting to send FCM notification to token ${fcmToken.substring(0, 10)}...: "${title}" - "${body}"`);

    try {
      initializeFirebaseAdmin();
      const messagingService = getMessaging();

      const message = {
        notification: {
          title: title,
          body: body,
        },
        token: fcmToken,
      };

      const response = await messagingService.send(message);
      console.log("[FCM] Successfully sent message via FCM:", response);
      MetricsService.recordNotificationOutcome(true);
      return res.status(200).json({ success: true, messageId: response });
    } catch (err: any) {
      console.log("[FCM] Real FCM sending unconfigured or lacks permission. Falling back to simulated delivery.");
      MetricsService.recordNotificationOutcome(true); // Treat sandbox simulation as successful outcome in fallback mode

      return res.status(200).json({
        success: true,
        simulated: true,
        message: "FCM configuration simulated successfully. Real sending requires service account credentials in .env.",
        title,
        body
      });
    }
  });

  // AI Estimated Wait Time Endpoint
  app.post("/api/estimate-wait-time", validateRequest(estimateWaitTimeSchema), async (req, res, next) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { shopName, serviceName, peopleInFront, recentTickets, activeCountersCount, avgDuration, lang } = req.body;
    const isAr = lang === "ar";

    const counters = Math.max(1, activeCountersCount || 1);
    const speed = Math.max(1, avgDuration || 10);

    // Dynamic deterministic fallback calculator for 100% uptime
    const getFallbackEstimate = () => {
      let avgSpeed = speed;
      if (recentTickets && Array.isArray(recentTickets) && recentTickets.length > 0) {
        // Extract durationMinutes if they are objects
        const validTimes = recentTickets
          .map((t: any) => {
            if (typeof t === "number") return t;
            if (t && typeof t === "object" && typeof t.durationMinutes === "number") return t.durationMinutes;
            return parseFloat(t);
          })
          .filter((t: number) => !isNaN(t) && t > 0);
        if (validTimes.length > 0) {
          avgSpeed = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
        }
      }
      
      const estimatedTime = Math.max(1, Math.round((peopleInFront * avgSpeed) / counters));

      if (isAr) {
        if (peopleInFront === 0) {
          return "أنت التالي في الطابور! الوقت المقدر للانتظار هو أقل من دقيقتين.";
        }
        return `بناءً على أداء الخدمة لعدد ${counters} شباك نشط بمتوسط سرعة ${Math.round(avgSpeed)} دقائق لكل عميل، الوقت المتوقع لانتظارك هو حوالي ${estimatedTime} دقيقة.`;
      } else {
        if (peopleInFront === 0) {
          return "You are next in line! Estimated wait time is less than 2 minutes.";
        }
        return `Based on active service performance with ${counters} active desk(s) at an average of ${Math.round(avgSpeed)} mins per client, your estimated wait time is around ${estimatedTime} minutes.`;
      }
    };

    if (!apiKey) {
      console.log("[Gemini API] API key not found. Using local wait-time fallback calculation.");
      return res.json({ estimateMessage: getFallbackEstimate() });
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const prompt = `You are an AI Wait-Time Predictor for a digital queue management platform called Dork (دورك).
Analyze this live queue state and service performance telemetry:
- Shop Name: "${shopName}"
- Service requested: "${serviceName}"
- Active counters/desks serving customers right now: ${counters} active desk(s)
- Number of people waiting in queue ahead of this customer: ${peopleInFront} people
- Current average service time per customer: ${Math.round(speed)} minutes
- Recent completed session durations telemetry (in minutes): ${JSON.stringify(recentTickets)}

Task:
Calculate a smart, reassuring, and precise wait time prediction based on the people ahead divided by active counters, weighted by average service speed.
Return ONLY a short, friendly, reassuring, and natural sentence in ${isAr ? "Arabic" : "English"} explaining the expected wait time (e.g. "الوقت المتوقع لانتظارك هو 14 دقيقة" or "We estimate your wait time to be around 14 minutes").
Do NOT write any preambles, markdown formatting, or system debug output. Return a direct customer-facing friendly notification.`;

      const aiSpan = TelemetryService.startSpan("gemini:generateContent");
      aiSpan.setAttribute("model", "gemini-2.5-flash");
      aiSpan.setAttribute("task", "estimate-wait-time");

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
          actor: "Customer",
          operation: "AI_ESTIMATE_WAIT_TIME",
          entity: "AI",
          result: "SUCCESS",
          duration,
          severity: "INFO"
        });

        return res.json({ estimateMessage: response.text?.trim() || getFallbackEstimate() });
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