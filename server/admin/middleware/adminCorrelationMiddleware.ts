/**
 * Enterprise Platform Administration - Correlation ID & Context Middleware
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Propagates correlation ID and request tracking context down the execution stack.
 */

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { adminLogContextStorage, IAdminLogContext, AdminStructuredLogger } from "../services/AdminStructuredLogger";

export interface AdminRequestWithContext extends Request {
  correlationId?: string;
  adminContext?: IAdminLogContext;
}

export function adminCorrelationMiddleware(
  req: AdminRequestWithContext,
  res: Response,
  next: NextFunction
): void {
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    `admin-cid-${uuidv4()}`;

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  const context: IAdminLogContext = {
    correlationId,
    ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "unknown",
    traceId: req.headers["x-cloud-trace-context"] as string
  };

  req.adminContext = context;

  adminLogContextStorage.run(context, () => {
    AdminStructuredLogger.debug(`[ADMIN API INGRESS] ${req.method} ${req.originalUrl}`);
    next();
  });
}
