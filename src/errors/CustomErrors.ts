export class AppError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly type: string;
  public readonly detail: string;
  public readonly invalidParams?: any;

  constructor(status: number, title: string, detail: string, type: string = "about:blank", invalidParams?: any) {
    super(detail);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.invalidParams = invalidParams;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(detail: string, invalidParams?: any) {
    super(400, "Validation Failed", detail, "https://api.dorkqueue.com/errors/validation-failed", invalidParams);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail: string = "Authentication credentials are required or invalid.") {
    super(401, "Unauthorized", detail, "https://api.dorkqueue.com/errors/unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(detail: string = "You do not have permission to perform this action.") {
    super(403, "Forbidden", detail, "https://api.dorkqueue.com/errors/forbidden");
  }
}

export class NotFoundError extends AppError {
  constructor(detail: string = "The requested resource was not found.") {
    super(404, "Not Found", detail, "https://api.dorkqueue.com/errors/not-found");
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(409, "Conflict", detail, "https://api.dorkqueue.com/errors/conflict");
  }
}

export class RateLimitError extends AppError {
  constructor(detail: string = "Too many requests. Please try again later.") {
    super(429, "Too Many Requests", detail, "https://api.dorkqueue.com/errors/rate-limited");
  }
}
