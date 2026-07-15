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

import { initializeApp as initializeClientApp, getApps as getClientApps } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  doc as clientDoc,
  getDoc as clientGetDoc,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  getDocs as clientGetDocs,
  setDoc as clientSetDoc,
  deleteDoc as clientDeleteDoc,
  runTransaction as clientRunTransaction,
  writeBatch as clientWriteBatch,
} from "firebase/firestore";

let firebaseAdminApp: any = null;
let firestoreDatabaseId: string | undefined = undefined;
let clientDb: any = null;

function getClientDb() {
  if (clientDb) return clientDb;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const apps = getClientApps();
      const clientApp = apps.length > 0 ? apps[0] : initializeClientApp(config);
      clientDb = getClientFirestore(clientApp, config.firestoreDatabaseId);
      console.log("[Firebase Client SDK] Successfully initialized Firestore Client SDK on server");
      return clientDb;
    } else {
      throw new Error("firebase-applet-config.json not found");
    }
  } catch (err: any) {
    console.error("[Firebase Client SDK] Failed to initialize Firestore client:", err.message);
    throw err;
  }
}

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
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to send email
  app.post("/api/send-email", async (req, res) => {
    const { email, name, ticketNumber, serviceName, shopName, lang } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const isAr = lang === "ar";

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

      return res.status(200).json({
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null,
      });
    } catch (err: any) {
      console.error("Error sending email:", err);
      return res.status(500).json({ error: "Failed to send email: " + err.message });
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

    if (!accountSid || !authToken) {
      console.log(`[Twilio Simulation] Simulated Direct Send to ${toPhone} via ${isWhatsapp ? "WhatsApp" : "SMS"}: "${bodyText}"`);
      return { simulated: true, recipient: toPhone, body: bodyText };
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const fromNumber = isWhatsapp ? (twilioWA.startsWith("whatsapp:") ? twilioWA : `whatsapp:${twilioWA}`) : twilioPhone;
    const toNumber = isWhatsapp ? (toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`) : toPhone;

    if (!fromNumber) {
      console.warn(`[Twilio Warning] Missing sender phone number for ${isWhatsapp ? "WhatsApp" : "SMS"}. Falling back to simulation.`);
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
      return { success: true, sid: data.sid, recipient: toPhone };
    } catch (err: any) {
      console.error(`[Twilio Direct Send Error] Failed to send message directly:`, err.message);
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
  app.post("/api/tickets/create", async (req, res) => {
    const { shopId, serviceId, serviceName, customerName, customerPhone, customerEmail, emailNotify, smsNotify, whatsappNotify, lang } = req.body;

    if (!shopId || !serviceId || !customerName) {
      return res.status(400).json({ error: "Required fields (shopId, serviceId, customerName) are missing." });
    }

    try {
      const dbClient = getClientDb();

      // Get shop details
      const shopDocRef = clientDoc(dbClient, "shops", shopId);
      const shopDoc = await clientGetDoc(shopDocRef);
      if (!shopDoc.exists()) {
        return res.status(404).json({ error: "Shop not found." });
      }

      const shopData = shopDoc.data();
      const planType = shopData?.plan_type || shopData?.plan || "free";
      const storeTimezone = shopData?.timezone || "Asia/Riyadh";

      const startOfToday = getStartOfTodayInTimezone(storeTimezone);

      // Query existing tickets for today to find the actual current max ticket number in Firestore
      let maxTicketNumInDb = 0;
      try {
        const ticketsQuery = clientQuery(
          clientCollection(dbClient, "tickets"),
          clientWhere("shopId", "==", shopId)
        );
        const ticketsSnap = await clientGetDocs(ticketsQuery);
        ticketsSnap.forEach((docSnap) => {
          const t = docSnap.data();
          if (t && t.createdAt >= startOfToday) {
            const num = Number(t.ticketNumber) || 0;
            if (num > maxTicketNumInDb) {
              maxTicketNumInDb = num;
            }
          }
        });
      } catch (err) {
        console.warn("[Server Ticket Create] Failed to query existing tickets for max ticketNumber fallback:", err);
      }

      const dayKey = startOfToday.slice(0, 10); // YYYY-MM-DD

      let nextTicketNumber = 1;

      try {
        await clientRunTransaction(dbClient, async (transaction: any) => {
          const shopSnap = await transaction.get(shopDocRef);
          if (!shopSnap.exists()) {
            throw new Error("Shop not found in transaction");
          }
          const shopData = shopSnap.data();
          const storedDate = shopData.date || "";
          
          let currentCount = 0;
          if (storedDate === dayKey) {
            currentCount = shopData.lastTicketNumber || 0;
          }

          const baseCount = Math.max(currentCount, maxTicketNumInDb);

          const isDemoShop = shopId.startsWith("demo_user_");
          if (planType === "free" && baseCount >= 5 && !isDemoShop) {
            throw new Error("FREE_PLAN_LIMIT_REACHED");
          }

          nextTicketNumber = baseCount + 1;

          transaction.set(
            shopDocRef,
            { lastTicketNumber: nextTicketNumber, date: dayKey },
            { merge: true }
          );
        });
      } catch (txErr: any) {
        if (txErr?.message === "FREE_PLAN_LIMIT_REACHED") {
          return res.status(403).json({
            error: "لقد وصلت الباقة لهذا المحل إلى الحد الأقصى اليوم (5 عملاء)."
          });
        }
        throw txErr;
      }

      // Save ticket to Firestore
      const newTicketRef = clientDoc(clientCollection(dbClient, "tickets"));
      const cleanTicket = {
        id: newTicketRef.id,
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

      await clientSetDoc(newTicketRef, cleanTicket);

      // Trigger server-side welcome notifications
      const origin = req.headers.origin || "http://localhost:3000";
      await sendWelcomeNotificationsOnServer(cleanTicket, shopData?.name || "Shop", shopData?.slug || "", origin, lang || "ar");

      return res.status(200).json({
        success: true,
        ticket: cleanTicket
      });
    } catch (err: any) {
      console.error("Error creating ticket via server API:", err);
      return res.status(500).json({ error: err.message || "Failed to create ticket on server." });
    }
  });

  // Send FCM instant notification when 1 person is left
  app.post("/api/send-fcm-alert", async (req, res) => {
    const { fcmToken, shopName, ticketNumber, lang } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: "FCM registration token is required" });
    }

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
      return res.status(200).json({ success: true, messageId: response });
    } catch (err: any) {
      console.log("[FCM] Real FCM sending unconfigured or lacks permission. Falling back to simulated delivery.");

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
  app.post("/api/estimate-wait-time", async (req, res) => {
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

      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return res.json({ estimateMessage: response.text?.trim() || getFallbackEstimate() });
    } catch (err: any) {
      console.log("[Gemini API] Quota exhausted or service error. Gracefully falling back to deterministic estimate:", err.message || err);
      return res.json({ estimateMessage: getFallbackEstimate() });
    }
  });

  // AI Queue Density Analysis Endpoint using Gemini
  app.post("/api/analyze-queue", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const { shopData, stats, lang } = req.body;
    const isAr = lang === "ar";

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

      const result = JSON.parse(text);
      return res.json(result);
    } catch (err: any) {
      console.log("[Gemini API] Quota exhausted or service error. Gracefully falling back to deterministic analysis:", err.message || err);
      return res.json(getFallbackAnalysis());
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

      let archivedCount = 0;
      let deletedCount = 0;

      // Use Client SDK for cleanup to avoid Admin SDK permission issues
      const dbClient = getClientDb();
      const ticketsCol = clientCollection(dbClient, "tickets");
      const q = clientQuery(ticketsCol, clientWhere("createdAt", "<", startOfTodayUTC));
      const snapshot = await clientGetDocs(q);

      console.log(`[Cleanup Job] Found ${snapshot.size} tickets from previous days to archive/delete.`);

      let batch = clientWriteBatch(dbClient);
      let operationsInBatch = 0;

      for (const ticketDoc of snapshot.docs) {
        const ticketData = ticketDoc.data();
        const ticketId = ticketDoc.id;

        // Archive ref
        const archiveRef = clientDoc(dbClient, "archived_tickets", ticketId);
        batch.set(archiveRef, {
          ...ticketData,
          archivedAt: new Date().toISOString()
        });

        // Delete ref
        batch.delete(ticketDoc.ref);

        operationsInBatch += 2;
        archivedCount++;
        deletedCount++;

        // Firestore batch has a limit of 500 operations
        if (operationsInBatch >= 400) {
          await batch.commit();
          console.log(`[Cleanup Job] Committed batch of ${operationsInBatch} operations.`);
          batch = clientWriteBatch(dbClient);
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
        console.log(`[Cleanup Job] Committed final batch of ${operationsInBatch} operations.`);
      }

      console.log(`[Cleanup Job] Finished! Successfully archived ${archivedCount} and deleted ${deletedCount} tickets.`);
      return { success: true, archived: archivedCount, deleted: deletedCount };
    } catch (err: any) {
      console.error("[Cleanup Job] Error during database cleanup:", err);
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

  // Route to create a Stripe checkout session for a shop upgrade
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    const { shopId, lang } = req.body;
    if (!shopId) {
      return res.status(400).json({ error: "shopId is required." });
    }

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

      return res.status(200).json({ success: true, url: session.url });
    } catch (err: any) {
      console.warn("Stripe create checkout session warning:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Route to verify completed checkout session and apply PRO upgrade
  app.get("/api/stripe/verify-session", async (req, res) => {
    const { sessionId, shopId } = req.query;

    if (!sessionId || !shopId) {
      return res.status(400).json({ error: "Missing sessionId or shopId." });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    // Handle mock verification if key is missing and sessionId is mock
    if (!stripeKey) {
      if (typeof sessionId === "string" && sessionId.startsWith("cs_mock_")) {
        try {
          const dbClient = getClientDb();
          const invoiceId = "inv_stripe_mock_" + sessionId.substring(8, 20);
          const invoiceNum = "INV-STRIPE-MOCK-" + Math.floor(10000 + Math.random() * 90000);
          
          // Save Invoice into Firestore
          const invoiceDocRef = clientDoc(dbClient, "shops", shopId as string, "invoices", invoiceId);
          await clientSetDoc(invoiceDocRef, {
            id: invoiceId,
            shopId: shopId,
            invoiceNumber: invoiceNum,
            amount: "$20.00 USD",
            planName: "PRO Plan (30 Days) - Stripe Mock",
            status: "paid",
            cardBrand: "Visa (Mock Sandbox)",
            cardLast4: "4242",
            createdAt: new Date().toISOString()
          });

          // Update Shop's active Plan to "pro"
          const shopDocRef = clientDoc(dbClient, "shops", shopId as string);
          await clientSetDoc(shopDocRef, {
            plan: "pro",
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }, { merge: true });

          console.log(`[Stripe Mock Sandbox] Upgraded Shop ${shopId} to PRO. Invoice ${invoiceNum} generated successfully.`);

          return res.status(200).json({
            success: true,
            plan: "pro",
            invoiceNumber: invoiceNum,
            message: "Shop upgraded to PRO (Mock Sandbox) successfully!"
          });
        } catch (dbErr: any) {
          console.warn("Error updating database during mock verification:", dbErr.message);
          return res.status(500).json({ error: "Failed to update subscription in database." });
        }
      } else {
        return res.status(400).json({ 
          error: "stripe_not_configured",
          message: "Stripe secret key is missing. Please set STRIPE_SECRET_KEY in settings." 
        });
      }
    }

    try {
      const stripe = getStripeInstance();
      const session = await stripe.checkout.sessions.retrieve(sessionId as string);

      if (session.payment_status === "paid" || session.status === "complete") {
        const dbClient = getClientDb();
        
        // Ensure this transaction belongs to this shop
        if (session.metadata?.shopId !== shopId) {
          return res.status(400).json({ error: "Session metadata shopId mismatch." });
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

        // Save Invoice into Firestore
        const invoiceDocRef = clientDoc(dbClient, "shops", shopId as string, "invoices", invoiceId);
        await clientSetDoc(invoiceDocRef, {
          id: invoiceId,
          shopId: shopId,
          invoiceNumber: invoiceNum,
          amount: "$20.00 USD",
          planName: "PRO Plan (30 Days) - Stripe Checkout",
          status: "paid",
          cardBrand: cardBrand,
          cardLast4: cardLast4,
          createdAt: new Date().toISOString()
        });

        // Update Shop's active Plan to "pro"
        const shopDocRef = clientDoc(dbClient, "shops", shopId as string);
        await clientSetDoc(shopDocRef, {
          plan: "pro",
          planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, { merge: true });

        console.log(`[Stripe Upgrade] Shop ${shopId} successfully upgraded to PRO. Invoice ${invoiceNum} generated.`);

        return res.status(200).json({
          success: true,
          plan: "pro",
          invoiceNumber: invoiceNum,
          message: "Shop upgraded to PRO successfully!"
        });
      } else {
        return res.status(400).json({ error: "Session has not been paid yet." });
      }
    } catch (err: any) {
      console.warn("Stripe verify session warning:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Manual/Triggered Cleanup Endpoint
  app.post("/api/cron/cleanup", async (req, res) => {
    console.log("[API Route] Manual cleanup trigger received.");
    const result = await runCleanupJob();
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();