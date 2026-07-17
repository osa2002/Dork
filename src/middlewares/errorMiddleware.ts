import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/CustomErrors";
import { ServerLogger, logContextStorage } from "../lib/serverLogger";

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = logContextStorage.getStore()?.correlationId || (res.getHeader("X-Correlation-ID") as string);

  // Log the full structured error internally on the server
  ServerLogger.error(`[API Error] ${req.method} ${req.originalUrl}`, err, {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.setHeader("Content-Type", "application/problem+json");

  if (err instanceof AppError) {
    const responseBody: any = {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: req.originalUrl,
      correlationId,
    };

    if (err.invalidParams) {
      responseBody.invalidParams = err.invalidParams;
    }

    res.status(err.status).json(responseBody);
    return;
  }

  // Handle standard unhandled exceptions securely
  const genericErrorResponse = {
    type: "https://api.dorkqueue.com/errors/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail: err.message || "An unexpected error occurred. Please try again later or contact support.",
    instance: req.originalUrl,
    correlationId,
  };

  res.status(500).json(genericErrorResponse);
}

