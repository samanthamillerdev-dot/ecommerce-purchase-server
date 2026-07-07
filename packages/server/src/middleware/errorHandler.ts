import { NextFunction, Request, Response } from "express";
import { AppError } from "../domain/errors";
import { ExternalApiError } from "../external/types";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err instanceof ExternalApiError) {
    res.status(502).json({ message: `Upstream API error: ${err.message}` });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}

export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void> | void
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
