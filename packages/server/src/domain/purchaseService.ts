import { randomUUID } from "crypto";
import { Db, runInTransaction } from "../db";
import { getProduct } from "../external/productsClient";
import { createShipment } from "../external/shipmentsClient";
import { Address, ExternalApiError, Product } from "../external/types";
import { appendLedgerEntry, getBalance } from "./creditService";
import { fetchCustomerOrThrow } from "./customerLookup";
import { InsufficientCreditError, NotFoundError, ShipmentFailedError, ValidationError } from "./errors";
import { formatMoney } from "./format";
import { calculateDiscount, recordUsage } from "./promoService";
import { Purchase, PurchaseStatus, PurchaseWithRefunds, Refund } from "./types";

export interface PurchaseParams {
  customerId: string;
  productId: string;
  quantity: number;
  promoCode?: string;
  shippingAddress?: Address;
}

interface PurchaseRow {
  id: string;
  customer_id: string;
  product_id: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  promo_code: string | null;
  shipment_id: string;
  status: PurchaseStatus;
  created_at: number;
}

interface RefundRow {
  id: string;
  purchase_id: string;
  quantity: number;
  amount: number;
  reason: string | null;
  created_at: number;
}

function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    customerId: row.customer_id,
    productId: row.product_id,
    sku: row.sku,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    discountAmount: row.discount_amount,
    totalPrice: row.total_price,
    promoCode: row.promo_code,
    shipmentId: row.shipment_id,
    status: row.status,
    createdAt: row.created_at
  };
}

function toRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    quantity: row.quantity,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.created_at
  };
}

function getRefundsForPurchase(db: Db, purchaseId: string): Refund[] {
  const rows = db.prepare(`SELECT * FROM refunds WHERE purchase_id = ? ORDER BY created_at ASC`).all(purchaseId) as unknown as RefundRow[];
  return rows.map(toRefund);
}

function withRefunds(db: Db, purchase: Purchase): PurchaseWithRefunds {
  const refunds = getRefundsForPurchase(db, purchase.id);
  return {
    ...purchase,
    refunds,
    refundedQuantity: refunds.reduce((sum, r) => sum + r.quantity, 0),
    refundedAmount: refunds.reduce((sum, r) => sum + r.amount, 0)
  };
}

async function fetchProductOrThrow(productId: string): Promise<Product> {
  try {
    return await getProduct(productId);
  } catch (err) {
    if (err instanceof ExternalApiError && err.status === 404) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    throw err;
  }
}

export async function purchaseProduct(db: Db, params: PurchaseParams): Promise<PurchaseWithRefunds> {
  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    throw new ValidationError("quantity must be a positive integer");
  }

  const customer = await fetchCustomerOrThrow(params.customerId);
  const product = await fetchProductOrThrow(params.productId);

  const subtotal = product.price * params.quantity;
  const discountAmount = params.promoCode ? calculateDiscount(db, params.promoCode, subtotal) : 0;
  const totalPrice = subtotal - discountAmount;

  const balance = getBalance(db, params.customerId);
  if (balance < totalPrice) {
    throw new InsufficientCreditError(
      `Insufficient credit: balance is ${formatMoney(balance)}, but this order totals ${formatMoney(totalPrice)}`
    );
  }

  let shipmentId: string;
  try {
    const shipment = await createShipment({
      shippingAddress: params.shippingAddress ?? customer.shippingAddress,
      products: [{ sku: product.sku, quantity: params.quantity }]
    });
    shipmentId = shipment.id;
  } catch (err) {
    const reason = err instanceof ExternalApiError ? err.message : "the shipping carrier could not be reached";
    throw new ShipmentFailedError(`Could not ship this order: ${reason}. The purchase was not saved and no credit was deducted.`);
  }

  const purchaseRow: PurchaseRow = {
    id: randomUUID(),
    customer_id: params.customerId,
    product_id: params.productId,
    sku: product.sku,
    quantity: params.quantity,
    unit_price: product.price,
    discount_amount: discountAmount,
    total_price: totalPrice,
    promo_code: params.promoCode ?? null,
    shipment_id: shipmentId,
    status: "COMPLETED",
    created_at: Date.now()
  };

  runInTransaction(db, () => {
    db.prepare(
      `INSERT INTO purchases (id, customer_id, product_id, sku, quantity, unit_price, discount_amount, total_price, promo_code, shipment_id, status, created_at)
       VALUES (@id, @customer_id, @product_id, @sku, @quantity, @unit_price, @discount_amount, @total_price, @promo_code, @shipment_id, @status, @created_at)`
    ).run(purchaseRow as unknown as Record<string, string | number | null>);

    appendLedgerEntry(db, {
      customerId: params.customerId,
      type: "PURCHASE",
      amount: -totalPrice,
      reason: `Purchase of ${params.quantity}x ${product.sku}`,
      relatedPurchaseId: purchaseRow.id
    });

    if (params.promoCode) {
      recordUsage(db, params.promoCode);
    }
  });

  return withRefunds(db, toPurchase(purchaseRow));
}

export function listPurchases(db: Db, customerId: string): PurchaseWithRefunds[] {
  const rows = db
    .prepare(`SELECT * FROM purchases WHERE customer_id = ? ORDER BY created_at DESC`)
    .all(customerId) as unknown as PurchaseRow[];
  return rows.map((row) => withRefunds(db, toPurchase(row)));
}

export function getPurchase(db: Db, purchaseId: string): PurchaseWithRefunds {
  const row = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchaseId) as unknown as PurchaseRow | undefined;
  if (!row) throw new NotFoundError(`Purchase ${purchaseId} not found`);
  return withRefunds(db, toPurchase(row));
}

export interface RefundParams {
  quantity?: number;
  amount?: number;
  reason?: string;
}

export function refundPurchase(db: Db, purchaseId: string, params: RefundParams): PurchaseWithRefunds {
  const hasQuantity = params.quantity !== undefined;
  const hasAmount = params.amount !== undefined;
  if (hasQuantity === hasAmount) {
    throw new ValidationError("Provide exactly one of quantity or amount to refund");
  }

  const existing = getPurchase(db, purchaseId);
  const remainingQuantity = existing.quantity - existing.refundedQuantity;
  const remainingAmount = existing.totalPrice - existing.refundedAmount;

  let refundQuantity = 0;
  let refundAmount: number;

  if (hasQuantity) {
    refundQuantity = params.quantity as number;
    if (!Number.isInteger(refundQuantity) || refundQuantity <= 0) {
      throw new ValidationError("quantity must be a positive integer");
    }
    if (refundQuantity > remainingQuantity) {
      throw new ValidationError(`Cannot refund ${refundQuantity} items; only ${remainingQuantity} remain unrefunded`);
    }
    const perUnitPrice = existing.totalPrice / existing.quantity;
    refundAmount = Math.min(round2(perUnitPrice * refundQuantity), remainingAmount);
  } else {
    refundAmount = params.amount as number;
    if (!(refundAmount > 0)) {
      throw new ValidationError("amount must be a positive number");
    }
    if (refundAmount > remainingAmount + 0.0001) {
      throw new ValidationError(`Cannot refund ${formatMoney(refundAmount)}; only ${formatMoney(round2(remainingAmount))} remains refundable`);
    }
    refundAmount = round2(refundAmount);
  }

  const newRefundedAmount = existing.refundedAmount + refundAmount;
  const newStatus: PurchaseStatus =
    remainingAmount - refundAmount <= 0.0001 ? "REFUNDED" : newRefundedAmount > 0 ? "PARTIALLY_REFUNDED" : existing.status;

  const refundRow: RefundRow = {
    id: randomUUID(),
    purchase_id: purchaseId,
    quantity: refundQuantity,
    amount: refundAmount,
    reason: params.reason ?? null,
    created_at: Date.now()
  };

  runInTransaction(db, () => {
    db.prepare(
      `INSERT INTO refunds (id, purchase_id, quantity, amount, reason, created_at)
       VALUES (@id, @purchase_id, @quantity, @amount, @reason, @created_at)`
    ).run(refundRow as unknown as Record<string, string | number | null>);

    db.prepare(`UPDATE purchases SET status = ? WHERE id = ?`).run(newStatus, purchaseId);

    appendLedgerEntry(db, {
      customerId: existing.customerId,
      type: "REFUND",
      amount: refundAmount,
      reason: params.reason ? `Refund: ${params.reason}` : `Refund for purchase ${purchaseId}`,
      relatedPurchaseId: purchaseId
    });
  });

  return getPurchase(db, purchaseId);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
