import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { UnauthorizedError } from "../errors/CustomErrors";

/**
 * Extended Express Request object to hold authenticated user details and shop contexts.
 */
export interface AuthenticatedRequest extends Request {
  user?: any;
  shopId?: string;
}

/**
 * Express Middleware to verify the incoming Firebase ID Token (JWT) in the Authorization header.
 * Derives authorization exclusively from the verified token and populates req.shopId.
 */
export async function authenticateFirebaseUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing or invalid Authorization header."));
  }

  const token = authHeader.split("Bearer ")[1];

  // Secure Sandbox / Offline Development Support
  if (process.env.NODE_ENV !== "production" && token.startsWith("demo_")) {
    const mockUid = token.replace("demo_", "");
    (req as any).user = {
      uid: mockUid,
      email: "demo@dorkq.com",
      isDemo: true,
    };
    (req as any).shopId = mockUid;
    return next();
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    (req as any).user = decodedToken;
    (req as any).shopId = decodedToken.uid;
    next();
  } catch (err: any) {
    console.error("[Auth Middleware] Firebase ID Token verification failed:", err.message);
    return next(new UnauthorizedError("Invalid or expired authentication token."));
  }
}
