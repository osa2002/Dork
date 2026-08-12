import { Request, Response, NextFunction } from "express";
import { getDatabaseProvider } from "../lib/DatabaseProvider";
import { NotFoundError, ForbiddenError, ValidationError, AppError } from "../errors/CustomErrors";
import { AuditLogService } from "../services/AuditLogService";

/**
 * Mobile Shop Discovery Contract
 * GET /api/v1/mobile/shops/:identifier
 */
export async function getShopByIdentifier(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier } = req.params;
    const dbProvider = await getDatabaseProvider();
    const rawDb = (dbProvider as any).getRawDb();

    let shopData: any = null;
    let shopId = identifier;

    // First try fetching directly by shop ID
    if (rawDb) {
      const shopDoc = await rawDb.collection("shops").doc(identifier).get();
      if (shopDoc.exists) {
        shopData = { id: shopDoc.id, ...shopDoc.data() };
      } else {
        // Fallback: search by shop slug
        const slugQuery = await rawDb.collection("shops").where("slug", "==", identifier).limit(1).get();
        if (!slugQuery.empty) {
          const doc = slugQuery.docs[0];
          shopData = { id: doc.id, ...doc.data() };
          shopId = doc.id;
        }
      }
    } else {
      shopData = await dbProvider.getShop(identifier);
    }

    if (!shopData) {
      throw new NotFoundError("Shop not found.");
    }

    // Fetch active services for the shop
    let services: any[] = [];
    if (rawDb) {
      const servicesSnap = await rawDb.collection("services").where("shopId", "==", shopId).get();
      services = servicesSnap.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "",
          description: data.description || "",
          avgDurationMinutes: data.avgDurationMinutes || data.avgDuration || 15,
          price: data.price || 0,
          isActive: data.isActive !== false
        };
      }).filter((s: any) => s.isActive);
    }

    // Return sanitized mobile-safe payload
    const sanitizedShop = {
      id: shopData.id || shopId,
      name: shopData.name || "Dork Shop",
      slug: shopData.slug || "",
      logoUrl: shopData.logoUrl || shopData.logo || "",
      bannerUrl: shopData.bannerUrl || "",
      address: shopData.address || "",
      phone: shopData.phone || "",
      isOpen: shopData.isOpen !== false,
      workingHours: shopData.workingHours || "",
      timezone: shopData.timezone || "Asia/Riyadh",
      displayTheme: shopData.displayBgTheme || "dark",
      services
    };

    return res.status(200).json({
      success: true,
      shop: sanitizedShop
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Mobile Customer Ticket History Contract
 * GET /api/v1/mobile/tickets/history
 */
export async function getCustomerTicketHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user || !user.uid) {
      throw new ForbiddenError("Authenticated user token required.");
    }

    const uid = user.uid;
    const phone = user.phone_number || "";
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const dbProvider = await getDatabaseProvider();
    const rawDb = (dbProvider as any).getRawDb();

    let tickets: any[] = [];

    if (rawDb) {
      // Query tickets matching customerUid
      const uidSnap = await rawDb.collection("tickets").where("customerUid", "==", uid).get();
      uidSnap.docs.forEach((doc: any) => {
        tickets.push({ id: doc.id, ...doc.data() });
      });

      // If customer has a verified phone number, also retrieve matching phone records
      if (phone) {
        const phoneSnap = await rawDb.collection("tickets").where("customerPhone", "==", phone).get();
        phoneSnap.docs.forEach((doc: any) => {
          if (!tickets.some(t => t.id === doc.id)) {
            tickets.push({ id: doc.id, ...doc.data() });
          }
        });
      }
    }

    // Sort descending by creation time
    tickets.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const total = tickets.length;
    const startIndex = (page - 1) * limit;
    const paginatedTickets = tickets.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      tickets: paginatedTickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Mobile Ticket Cancellation Contract
 * POST /api/v1/mobile/tickets/cancel
 */
export async function cancelTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user || !user.uid) {
      throw new ForbiddenError("Authenticated user token required.");
    }

    const { ticketId, reason } = req.body;
    const uid = user.uid;
    const phone = user.phone_number || "";

    const dbProvider = await getDatabaseProvider();
    const rawDb = (dbProvider as any).getRawDb();

    if (!rawDb) {
      throw new AppError(500, "Database Error", "Database unavailable.");
    }

    const ticketRef = rawDb.collection("tickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      throw new NotFoundError("Ticket not found.");
    }

    const ticketData = ticketSnap.data();

    // Verify ownership: customerUid OR customerPhone OR user owns shop
    const isCustomerOwner = (ticketData.customerUid && ticketData.customerUid === uid) ||
                            (phone && ticketData.customerPhone === phone) ||
                            (ticketData.shopId === uid);

    if (!isCustomerOwner) {
      throw new ForbiddenError("You are not authorized to cancel this ticket.");
    }

    // Verify state transition: can only cancel 'waiting' or 'scheduled'
    if (ticketData.status !== "waiting" && ticketData.status !== "scheduled") {
      throw new ValidationError(`Cannot cancel ticket in '${ticketData.status}' status.`);
    }

    const cancellationTimestamp = new Date().toISOString();
    const updatePayload = {
      status: "cancelled",
      cancelledAt: cancellationTimestamp,
      cancellationReason: reason || "Cancelled by customer via mobile app"
    };

    await ticketRef.update(updatePayload);

    const updatedTicket = { ...ticketData, ...updatePayload };

    AuditLogService.log({
      userId: uid,
      shopId: ticketData.shopId,
      actor: user.name || user.email || uid,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "mobile-client",
      operation: "TICKET_CANCEL",
      entity: "Ticket",
      newValue: updatedTicket,
      result: "SUCCESS",
      duration: 0,
      severity: "INFO"
    });

    return res.status(200).json({
      success: true,
      ticket: updatedTicket
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Mobile FCM Registration Contract
 * POST /api/v1/mobile/messaging/register-token
 */
export async function registerFcmToken(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const uid = user?.uid || "anonymous";
    const { token, platform, deviceId } = req.body;

    const dbProvider = await getDatabaseProvider();
    const rawDb = (dbProvider as any).getRawDb();

    if (rawDb) {
      const tokenRef = rawDb.collection("fcm_tokens").doc(token);
      await tokenRef.set({
        token,
        uid,
        platform: platform || "android",
        deviceId: deviceId || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    return res.status(200).json({
      success: true,
      message: "FCM token registered successfully."
    });
  } catch (err) {
    next(err);
  }
}
