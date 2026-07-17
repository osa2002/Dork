import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateFirebaseUser } from "./authMiddleware";
import { UnauthorizedError } from "../errors/CustomErrors";

// Mock firebase-admin/auth
vi.mock("firebase-admin/auth", () => {
  const mockVerifyIdToken = vi.fn();
  const mockGetAuth = vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  }));
  return {
    getAuth: mockGetAuth,
  };
});

import { getAuth } from "firebase-admin/auth";

describe("authenticateFirebaseUser (Express Middleware)", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {};
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("should fail next() with UnauthorizedError if Authorization header is missing", async () => {
    await authenticateFirebaseUser(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toBe("Missing or invalid Authorization header.");
  });

  it("should fail next() with UnauthorizedError if Authorization header does not start with Bearer", async () => {
    req.headers.authorization = "Basic xyz";
    await authenticateFirebaseUser(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it("should support and authenticate mock demo_ tokens in non-production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    
    req.headers.authorization = "Bearer demo_shop_123";
    await authenticateFirebaseUser(req, res, next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments implies success
    expect(req.user).toEqual({
      uid: "shop_123",
      email: "demo@dorkq.com",
      isDemo: true,
    });
    expect(req.shopId).toBe("shop_123");

    process.env.NODE_ENV = originalEnv;
  });

  it("should call getAuth().verifyIdToken with token and set request context on success", async () => {
    req.headers.authorization = "Bearer valid_token_abc";
    const decodedToken = { uid: "real_user_uid", email: "user@test.com" };
    
    const verifyIdTokenMock = getAuth().verifyIdToken as any;
    verifyIdTokenMock.mockResolvedValueOnce(decodedToken);

    await authenticateFirebaseUser(req, res, next);

    expect(verifyIdTokenMock).toHaveBeenCalledWith("valid_token_abc");
    expect(req.user).toBe(decodedToken);
    expect(req.shopId).toBe("real_user_uid");
    expect(next).toHaveBeenCalledWith();
  });

  it("should fail next() with UnauthorizedError if verification throws an error", async () => {
    req.headers.authorization = "Bearer invalid_token_abc";
    
    const verifyIdTokenMock = getAuth().verifyIdToken as any;
    verifyIdTokenMock.mockRejectedValueOnce(new Error("Token expired"));

    await authenticateFirebaseUser(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toBe("Invalid or expired authentication token.");
  });
});
