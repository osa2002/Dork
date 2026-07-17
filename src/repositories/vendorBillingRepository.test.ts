import { describe, it, expect, vi, beforeEach } from "vitest";
import { vendorBillingRepository } from "./vendorBillingRepository";
import { collection, doc, query, onSnapshot, setDoc } from "firebase/firestore";

describe("Vendor Billing Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should subscribe to invoices for a specific shop using query and onSnapshot", () => {
    const mockQuery = { id: "invoices-query" };
    const mockCollection = { id: "invoices-col" };
    
    vi.mocked(collection).mockReturnValue(mockCollection as any);
    vi.mocked(query).mockReturnValue(mockQuery as any);

    const onUpdate = vi.fn();
    const onError = vi.fn();

    const unsub = vendorBillingRepository.subscribeToInvoices("shop-xyz", onUpdate, onError);

    expect(collection).toHaveBeenCalledWith(expect.any(Object), "shops", "shop-xyz", "invoices");
    expect(query).toHaveBeenCalledWith(mockCollection);
    expect(onSnapshot).toHaveBeenCalledWith(mockQuery, expect.any(Function), onError);
    expect(unsub).toBeDefined();
  });

  it("should update shop plan and create a paid invoice record during mockUpgradeShop", async () => {
    const mockShopDocRef = { id: "shop-xyz" };
    const mockInvoiceDocRef = { id: "invoice-xyz" };

    vi.mocked(doc).mockImplementation((...args: any[]) => {
      if (args[1] === "shops") return mockShopDocRef as any;
      return mockInvoiceDocRef as any;
    });

    const invoice = await vendorBillingRepository.mockUpgradeShop("shop-xyz", "4242");

    expect(doc).toHaveBeenCalledWith(expect.any(Object), "shops", "shop-xyz");
    expect(setDoc).toHaveBeenCalledWith(
      mockShopDocRef,
      expect.objectContaining({
        plan: "pro",
        planExpiresAt: expect.any(String),
      }),
      { merge: true }
    );
    expect(setDoc).toHaveBeenCalledWith(
      mockInvoiceDocRef,
      expect.objectContaining({
        shopId: "shop-xyz",
        amount: "$19.00",
        planName: "Pro Plan (Monthly)",
        status: "paid",
        cardLast4: "4242",
      })
    );
    expect(invoice.shopId).toBe("shop-xyz");
    expect(invoice.cardLast4).toBe("4242");
    expect(invoice.status).toBe("paid");
  });

  it("should call checkout API and return result during createCheckoutSession", async () => {
    const mockResponse = { url: "https://stripe.com/checkout/session_abc" };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const result = await vendorBillingRepository.createCheckoutSession({
      shopId: "shop-xyz",
      plan: "pro",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/checkout-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          shopId: "shop-xyz",
          plan: "pro",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it("should call verify-checkout API and return result during verifyCheckout", async () => {
    const mockResponse = { success: true };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const result = await vendorBillingRepository.verifyCheckout("sess_123");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/verify-checkout?session_id=sess_123",
      expect.any(Object)
    );
    expect(result).toEqual(mockResponse);
  });
});
