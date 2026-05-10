export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = "SERVER_ERROR", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error", details?: unknown) {
    super(message, 400, "VALIDATION", details);
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthenticated", code = "AUTH_001") {
    super(message, 401, code);
  }
}

export class PaymentError extends AppError {
  constructor(message = "Payment error", code = "PAYMENT_001") {
    super(message, 422, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}
