export type LedgerEntryType = "GRANT" | "DEDUCT" | "PURCHASE" | "REFUND";

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  reason: string;
  relatedPurchaseId: string | null;
  createdAt: number;
}

export type PurchaseStatus = "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED";

export interface Purchase {
  id: string;
  customerId: string;
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  promoCode: string | null;
  shipmentId: string;
  status: PurchaseStatus;
  createdAt: number;
}

export interface Refund {
  id: string;
  purchaseId: string;
  quantity: number;
  amount: number;
  reason: string | null;
  createdAt: number;
}

export interface PurchaseWithRefunds extends Purchase {
  refunds: Refund[];
  refundedQuantity: number;
  refundedAmount: number;
}
