import { describe, it, expect, vi, beforeEach } from "vitest";
import { vendorQueueRepository } from "./vendorQueueRepository";
import { collection, doc, onSnapshot, query, where, updateDoc, runTransaction } from "firebase/firestore";

describe("Vendor Queue Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should subscribe to tickets for a specific shop using query and onSnapshot", () => {
    const mockQuery = { id: "mock-query" };
    const mockCollection = { id: "tickets" };
    const mockWhere = { id: "where-clause" };
    
    vi.mocked(collection).mockReturnValue(mockCollection as any);
    vi.mocked(where).mockReturnValue(mockWhere as any);
    vi.mocked(query).mockReturnValue(mockQuery as any);

    const onUpdate = vi.fn();
    const onError = vi.fn();

    const unsub = vendorQueueRepository.subscribeToTickets("shop-123", "Asia/Riyadh", onUpdate, onError);

    expect(collection).toHaveBeenCalledWith(expect.any(Object), "tickets");
    expect(where).toHaveBeenCalledWith("shopId", "==", "shop-123");
    expect(where).toHaveBeenCalledWith("createdAt", ">=", expect.any(String));
    expect(query).toHaveBeenCalledWith(mockCollection, mockWhere, mockWhere);
    expect(onSnapshot).toHaveBeenCalledWith(mockQuery, expect.any(Function), onError);
    expect(unsub).toBeDefined();
  });

  it("should update ticket details in Firestore using updateDoc", async () => {
    const mockDocRef = { id: "ticket-1" };
    vi.mocked(doc).mockReturnValue(mockDocRef as any);

    await vendorQueueRepository.updateTicket("ticket-1", { status: "calling", calledAt: "2026-07-16T12:00:00Z" });

    expect(doc).toHaveBeenCalledWith(expect.any(Object), "tickets", "ticket-1");
    expect(updateDoc).toHaveBeenCalledWith(mockDocRef, { status: "calling", calledAt: "2026-07-16T12:00:00Z" });
  });

  it("should atomically mark email as notified inside a Firestore transaction", async () => {
    const mockDocRef = { id: "ticket-trans-1" };
    vi.mocked(doc).mockReturnValue(mockDocRef as any);

    const mockSnapshot = {
      exists: () => true,
      data: () => ({
        id: "ticket-trans-1",
        emailNotify: true,
        emailNotified: false,
      }),
    };

    const mockTransaction = {
      get: vi.fn().mockResolvedValue(mockSnapshot),
      update: vi.fn(),
    };

    // Mock runTransaction to execute the callback immediately with our mock transaction object
    vi.mocked(runTransaction).mockImplementation(async (dbInstance, updateFunction) => {
      return updateFunction(mockTransaction as any);
    });

    const result = await vendorQueueRepository.markEmailAsNotifiedInTransaction("ticket-trans-1");

    expect(doc).toHaveBeenCalledWith(expect.any(Object), "tickets", "ticket-trans-1");
    expect(mockTransaction.get).toHaveBeenCalledWith(mockDocRef);
    expect(mockTransaction.update).toHaveBeenCalledWith(mockDocRef, { emailNotified: true });
    expect(result).toBe(true);
  });

  it("should skip updating inside transaction if ticket is already notified", async () => {
    const mockDocRef = { id: "ticket-trans-2" };
    vi.mocked(doc).mockReturnValue(mockDocRef as any);

    const mockSnapshot = {
      exists: () => true,
      data: () => ({
        id: "ticket-trans-2",
        emailNotify: true,
        emailNotified: true, // Already notified!
      }),
    };

    const mockTransaction = {
      get: vi.fn().mockResolvedValue(mockSnapshot),
      update: vi.fn(),
    };

    vi.mocked(runTransaction).mockImplementation(async (dbInstance, updateFunction) => {
      return updateFunction(mockTransaction as any);
    });

    const result = await vendorQueueRepository.markEmailAsNotifiedInTransaction("ticket-trans-2");

    expect(mockTransaction.get).toHaveBeenCalledWith(mockDocRef);
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
