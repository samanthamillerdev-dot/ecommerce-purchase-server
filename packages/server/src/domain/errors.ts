export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class InsufficientCreditError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ShipmentFailedError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}
