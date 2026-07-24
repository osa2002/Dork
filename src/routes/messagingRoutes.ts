import { Router } from "express";
import { validateRequest } from "../middlewares/validationMiddleware";
import { sendEmailSchema, sendFcmSchema } from "../schemas/apiSchemas";
import { sendEmail, sendSmsWhatsapp, sendFcmAlert } from "../controllers/messagingController";

const router = Router();

// API Route to send email
router.post("/api/send-email", validateRequest(sendEmailSchema), sendEmail);

// Unified Omnichannel API endpoint
router.post("/api/send-sms-whatsapp", sendSmsWhatsapp);

// Send FCM instant notification when 1 person is left
router.post("/api/send-fcm-alert", validateRequest(sendFcmSchema), sendFcmAlert);

export default router;
