import { Router } from "express";
import { authenticateFirebaseUser } from "../middlewares/authMiddleware";
import { validateRequest } from "../middlewares/validationMiddleware";
import {
  mobileShopIdentifierSchema,
  mobileTicketCancelSchema,
  mobileTicketHistorySchema,
  mobileFcmRegisterSchema
} from "../schemas/apiSchemas";
import {
  getShopByIdentifier,
  getCustomerTicketHistory,
  cancelTicket,
  registerFcmToken
} from "../controllers/mobileController";

export const mobileRouter = Router();

// Mobile Shop Discovery API
mobileRouter.get(
  "/shops/:identifier",
  validateRequest(mobileShopIdentifierSchema),
  getShopByIdentifier
);

// Mobile Customer Ticket History API (Authenticated)
mobileRouter.get(
  "/tickets/history",
  authenticateFirebaseUser,
  validateRequest(mobileTicketHistorySchema),
  getCustomerTicketHistory
);

// Mobile Ticket Cancellation API (Authenticated)
mobileRouter.post(
  "/tickets/cancel",
  authenticateFirebaseUser,
  validateRequest(mobileTicketCancelSchema),
  cancelTicket
);

// Mobile FCM Push Token Registration API (Authenticated)
mobileRouter.post(
  "/messaging/register-token",
  authenticateFirebaseUser,
  validateRequest(mobileFcmRegisterSchema),
  registerFcmToken
);
