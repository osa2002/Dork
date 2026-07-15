import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/CustomErrors";

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the full error internally on the server for admin troubleshooting
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  res.setHeader("Content-Type", "application/problem+json");

  if (err instanceof AppError) {
    const responseBody: any = {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: req.originalUrl,
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
    detail: "An unexpected error occurred. Please try again later or contact support.",
    instance: req.originalUrl,
  };

  res.status(500).json(genericErrorResponse);
}
