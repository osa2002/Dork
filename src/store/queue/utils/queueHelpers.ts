import { Ticket, Shop } from "../../../types";
import { queueRepository } from "../../../repositories/queueRepository";

/**
 * Validates basic required fields for joining a queue.
 */
export function validateJoinRequest(customerName: string, serviceId: string): boolean {
  return !!customerName.trim() && !!serviceId;
}

/**
 * Prepares the structural payload for offline/temporary tickets.
 */
export function prepareOfflinePayload(params: {
  shopId: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  emailNotify: boolean;
  smsNotify: boolean;
  whatsappNotify: boolean;
  isScheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
  nextTicketNumber: number;
  tempId: string;
}): Ticket {
  return {
    id: params.tempId,
    shopId: params.shopId,
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    customerName: params.customerName.trim(),
    customerPhone: params.customerPhone.trim() || "",
    customerEmail: params.customerEmail.trim() || "",
    emailNotify: params.emailNotify,
    emailNotified: false,
    smsNotify: params.smsNotify,
    smsNotified: false,
    whatsappNotify: params.whatsappNotify,
    whatsappNotified: false,
    ticketNumber: params.nextTicketNumber,
    status: params.isScheduled ? "scheduled" : "waiting",
    isScheduled: params.isScheduled,
    scheduledDate: params.isScheduled ? params.scheduledDate : "",
    scheduledTime: params.isScheduled ? params.scheduledTime : "",
    createdAt: new Date().toISOString()
  };
}

/**
 * Dispatches a queue join call directly to the server-side API handler.
 */
export async function executeBackendJoin(params: {
  shopId: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  emailNotify: boolean;
  smsNotify: boolean;
  whatsappNotify: boolean;
  isRtl: boolean;
}): Promise<Ticket> {
  const response = await fetch("/api/tickets/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shopId: params.shopId,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.trim() || "",
      customerEmail: params.customerEmail.trim() || "",
      emailNotify: params.emailNotify,
      smsNotify: params.smsNotify,
      whatsappNotify: params.whatsappNotify,
      lang: params.isRtl ? "ar" : "en"
    })
  });

  if (!response.ok) {
    const error = new Error("BACKEND_ERROR") as any;
    error.status = response.status;
    try {
      const errData = await response.json();
      error.message = errData.message || errData.error;
    } catch {
      error.message = "Server error";
    }
    throw error;
  }

  const resData = await response.json();
  return resData.ticket;
}

/**
 * Calculates local numbers and issues a transactional write for offline fallbacks
 * and local connection drop scenarios.
 */
export async function executeFirestoreFallback(params: {
  shop: Shop;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  emailNotify: boolean;
  smsNotify: boolean;
  whatsappNotify: boolean;
  isScheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
}): Promise<Ticket> {
  return queueRepository.executeFirestoreFallbackJoin(params);
}

/**
 * Inserts pending tickets securely into IndexedDB for persistent caching.
 */
export async function persistOfflineTicket(tempId: string, newTicket: Ticket): Promise<void> {
  await queueRepository.persistOfflineTicket(tempId, newTicket);
}
