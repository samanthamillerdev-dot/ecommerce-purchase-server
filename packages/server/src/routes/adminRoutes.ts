import type { Db } from "../db";
import { Router } from "express";
import { getBalance, listLedger } from "../domain/creditService";
import { fetchCustomerOrThrow } from "../domain/customerLookup";
import { listPurchases } from "../domain/purchaseService";
import { Customer } from "../external/types";
import { asyncHandler } from "../middleware/errorHandler";

export interface AdminCustomerSummary {
  customerId: string;
  name: string;
  email: string;
  balance: number;
}

export interface AdminCustomerDetail {
  customer: Customer;
  balance: number;
  purchases: ReturnType<typeof listPurchases>;
  ledger: ReturnType<typeof listLedger>;
}

function knownCustomerIds(db: Db): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT customer_id AS customerId FROM (
         SELECT customer_id FROM purchases
         UNION
         SELECT customer_id FROM credit_ledger
       )`
    )
    .all() as Array<{ customerId: string }>;
  return rows.map((r) => r.customerId);
}

export function adminRoutes(db: Db): Router {
  const router = Router();

  router.get(
    "/admin/customers",
    asyncHandler(async (_req, res) => {
      const ids = knownCustomerIds(db);
      // A single stale local ID (the external record was somehow removed
      // upstream) shouldn't take down the whole list - skip it and keep going.
      const summaries = await Promise.all(
        ids.map(async (customerId): Promise<AdminCustomerSummary | null> => {
          try {
            const customer = await fetchCustomerOrThrow(customerId);
            return {
              customerId,
              name: customer.name,
              email: customer.email,
              balance: getBalance(db, customerId)
            };
          } catch {
            return null;
          }
        })
      );
      res.status(200).json(summaries.filter((s): s is AdminCustomerSummary => s !== null));
    })
  );

  router.get(
    "/admin/customers/:customerId",
    asyncHandler(async (req, res) => {
      const customerId = req.params.customerId;
      const customer = await fetchCustomerOrThrow(customerId);
      const detail: AdminCustomerDetail = {
        customer,
        balance: getBalance(db, customerId),
        purchases: listPurchases(db, customerId),
        ledger: listLedger(db, customerId)
      };
      res.status(200).json(detail);
    })
  );

  return router;
}
