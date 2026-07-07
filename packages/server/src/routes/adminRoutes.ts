import type { Db } from "../db";
import { Router } from "express";
import { getBalance, listLedger } from "../domain/creditService";
import { listPurchases } from "../domain/purchaseService";
import { getCustomer } from "../external/customersClient";
import { Customer } from "../external/types";
import { asyncHandler } from "../middleware/errorHandler";

// Internal-only endpoints backing the customer service admin UI. Not part of
// the public purchase API - kept in their own router so that boundary stays
// visible.

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

// We only ever hear about a customer once they have a purchase or a credit
// event recorded locally - the external Customers API has no "list all"
// endpoint, so this is the closest thing to a directory we can offer.
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
      const summaries: AdminCustomerSummary[] = await Promise.all(
        ids.map(async (customerId) => {
          const customer = await getCustomer(customerId);
          return {
            customerId,
            name: customer.name,
            email: customer.email,
            balance: getBalance(db, customerId)
          };
        })
      );
      res.status(200).json(summaries);
    })
  );

  router.get(
    "/admin/customers/:customerId",
    asyncHandler(async (req, res) => {
      const customerId = req.params.customerId;
      const customer = await getCustomer(customerId);
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
