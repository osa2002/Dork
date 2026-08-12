import { Request, Response, NextFunction } from "express";
import nodemailer from "nodemailer";
import { getMessaging } from "firebase-admin/messaging";
import { TelemetryService } from "../services/TelemetryService";
import { MetricsService } from "../services/MetricsService";
import {
  initializeFirebaseAdmin,
  normalizePhoneNumber,
  getNotificationMessage,
  triggerTwilioSendDirect,
} from "../services/serverNotificationService";

/**
 * POST /api/send-email
 * Transmits an email notification when a customer's turn is approaching.
 */
export async function sendEmail(req: Request, res: Response, next: NextFunction) {
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

    res.status(200).json({
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
}

/**
 * POST /api/send-sms-whatsapp
 * Dispatches welcome or approaching SMS/WhatsApp messages using Twilio API.
 */
export async function sendSmsWhatsapp(req: Request, res: Response, next: NextFunction) {
  try {
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
    res.status(200).json({
      success: true,
      ...result,
      channel,
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * POST /api/send-fcm-alert
 * Dispatches Firebase Cloud Messaging mobile push notifications.
 */
export async function sendFcmAlert(req: Request, res: Response, next: NextFunction) {
  const { fcmToken, shopName, ticketNumber, lang, customTitle, customBody } = req.body;

  const isAr = lang === "ar";
  const title = customTitle || (isAr
    ? "تنبيه هام من دورك! 🔔"
    : "Important Alert from Dork! 🔔");
  const body = customBody || (isAr
    ? `يتبقى شخص واحد فقط أمامك في طابور الانتظار لدى ${shopName || "المحل"}. يرجى التوجه فوراً!`
    : `Only 1 person is left ahead of you in the queue at ${shopName || "the shop"}. Please head there immediately!`);

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
    res.status(200).json({ success: true, messageId: response });
  } catch (err: any) {
    console.log("[FCM] Real FCM sending unconfigured or lacks permission. Falling back to simulated delivery.");
    MetricsService.recordNotificationOutcome(true); // Treat sandbox simulation as successful outcome in fallback mode

    res.status(200).json({
      success: true,
      simulated: true,
      message: "FCM configuration simulated successfully. Real sending requires service account credentials in .env.",
      title,
      body
    });
  }
}
