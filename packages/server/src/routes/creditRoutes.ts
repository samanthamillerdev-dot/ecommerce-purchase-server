import { Router } from "express";
import type { Db } from "../db";
import { deductCredit, getBalance, grantCredit, listLedger } from "../domain/creditService";
import { fetchCustomerOrThrow } from "../domain/customerLookup";
import { ValidationError } from "../domain/errors";
import { asyncHandler } from "../middleware/errorHandler";

export interface AdjustCreditRequest {
  amount: number;
  reason: string;
}

export interface CreditBalanceResponse {
  customerId: string;
  balance: number;
}

export function creditRoutes(db: Db): Router {
  const router = Router();

  router.get(
    "/customers/:customerId/credit",
    asyncHandler(async (req, res) => {
      await fetchCustomerOrThrow(req.params.customerId);
      const response: CreditBalanceResponse = {
        customerId: req.params.customerId,
        balance: getBalance(db, req.params.customerId)
      };
      res.status(200).json(response);
    })
  );

  router.get(
    "/customers/:customerId/credit/history",
    asyncHandler(async (req, res) => {
      await fetchCustomerOrThrow(req.params.customerId);
      res.status(200).json(listLedger(db, req.params.customerId));
    })
  );

  router.post(
    "/customers/:customerId/credit/grant",
    asyncHandler(async (req, res) => {
      const body = req.body as Partial<AdjustCreditRequest>;
      if (typeof body.amount !== "number" || typeof body.reason !== "string" || !body.reason) {
        throw new ValidationError("amount (number) and reason (string) are required");
      }
      await fetchCustomerOrThrow(req.params.customerId);
      const entry = grantCredit(db, req.params.customerId, body.amount, body.reason);
      res.status(200).json(entry);
    })
  );

  router.post(
    "/customers/:customerId/credit/deduct",
    asyncHandler(async (req, res) => {
      const body = req.body as Partial<AdjustCreditRequest>;
      if (typeof body.amount !== "number" || typeof body.reason !== "string" || !body.reason) {
        throw new ValidationError("amount (number) and reason (string) are required");
      }
      await fetchCustomerOrThrow(req.params.customerId);
      const entry = deductCredit(db, req.params.customerId, body.amount, body.reason);
      res.status(200).json(entry);
    })
  );

  return router;
}
