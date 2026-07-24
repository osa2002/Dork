import path from "path";
import fs from "fs";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { TelemetryService } from "./TelemetryService";
import { MetricsService } from "./MetricsService";
import { RuntimeDependencyGraph } from "../../server/chaos/intelligence/RuntimeDependencyGraph";

// ---------------------------------------------------------------------------
// Server-Side Notification Services & Helpers
// ---------------------------------------------------------------------------

let firebaseAdminApp: any = null;
let firestoreDatabaseId: string | undefined = undefined;

export function initializeFirebaseAdmin() {
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
    // Check if app is already initialized to avoid duplicate initialization error
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseAdminApp = existingApps[0];
      console.log("[Firebase Admin] Using already initialized Firebase Admin App");
    } else {
      // Attempt standard initialization using environment variables or applicationDefault
      firebaseAdminApp = initializeApp({
        projectId: projectId,
        credential: applicationDefault()
      });
      console.log("[Firebase Admin] Initialized successfully with Application Default Credentials");
    }
  } catch (err: any) {
    console.warn("[Firebase Admin] Failed to initialize with applicationDefault(), attempting fallback:", err.message);
    try {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        firebaseAdminApp = existingApps[0];
      } else {
        firebaseAdminApp = initializeApp({
          projectId: projectId
        });
      }
      console.log("[Firebase Admin] Initialized successfully with fallback config (project ID only)");
    } catch (fallbackErr: any) {
      console.error("[Firebase Admin] Critical: Failed to initialize Firebase Admin fallback:", fallbackErr.message);
    }
  }
}

// Phone number normalization helper
export function normalizePhoneNumber(phone: string): string {
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
export function getNotificationMessage(type: "welcome" | "approaching", params: {
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
export async function triggerTwilioSendDirect(phone: string, bodyText: string, isWhatsapp: boolean) {
  const start = Date.now();
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
    RuntimeDependencyGraph.recordCall("ExpressServer", "TwilioSMS", 15, true);
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
    RuntimeDependencyGraph.recordCall("ExpressServer", "TwilioSMS", 10, true);
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
    RuntimeDependencyGraph.recordCall("ExpressServer", "TwilioSMS", Date.now() - start, true);
    return { success: true, sid: data.sid, recipient: toPhone };
  } catch (err: any) {
    console.error(`[Twilio Direct Send Error] Failed to send message directly:`, err.message);
    twilioSpan.setAttribute("error", true);
    twilioSpan.setAttribute("error.message", err.message);
    twilioSpan.end();
    MetricsService.recordNotificationOutcome(false);
    RuntimeDependencyGraph.recordCall("ExpressServer", "TwilioSMS", Date.now() - start, false);
    return { simulated: true, recipient: toPhone, body: bodyText, warning: err.message };
  }
}

// Auto-send welcome notifications on ticket booking
export async function sendWelcomeNotificationsOnServer(ticket: any, shopName: string, shopSlug: string, origin: string, lang: string) {
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
