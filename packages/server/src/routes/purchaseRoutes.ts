import { Router } from "express";
import type { Db } from "../db";
import { fetchCustomerOrThrow } from "../domain/customerLookup";
import { ValidationError } from "../domain/errors";
import { listPurchases, purchaseProduct, refundPurchase } from "../domain/purchaseService";
import { Address } from "../external/types";
import { asyncHandler } from "../middleware/errorHandler";

export interface CreatePurchaseRequest {
  customerId: string;
  productId: string;
  quantity: number;
  promoCode?: string;
  shippingAddress?: Address;
}

export interface RefundPurchaseRequest {
  quantity?: number;
  amount?: number;
  reason?: string;
}

export function purchaseRoutes(db: Db): Router {
  const router = Router();

  router.post(
    "/purchases",
    asyncHandler(async (req, res) => {
      const body = req.body as Partial<CreatePurchaseRequest>;
      if (typeof body.customerId !== "string" || typeof body.productId !== "string" || typeof body.quantity !== "number") {
        throw new ValidationError("customerId (string), productId (string) and quantity (number) are required");
      }
      const purchase = await purchaseProduct(db, {
        customerId: body.customerId,
        productId: body.productId,
        quantity: body.quantity,
        promoCode: body.promoCode,
        shippingAddress: body.shippingAddress
      });
      res.status(201).json(purchase);
    })
  );

  router.get(
    "/customers/:customerId/purchases",
    asyncHandler(async (req, res) => {
      await fetchCustomerOrThrow(req.params.customerId);
      res.status(200).json(listPurchases(db, req.params.customerId));
    })
  );

  router.post(
    "/purchases/:purchaseId/refund",
    asyncHandler((req, res) => {
      const body = req.body as Partial<RefundPurchaseRequest>;
      const purchase = refundPurchase(db, req.params.purchaseId, {
        quantity: body.quantity,
        amount: body.amount,
        reason: body.reason
      });
      res.status(200).json(purchase);
    })
  );

  return router;
}
