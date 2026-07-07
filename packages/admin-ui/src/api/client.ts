const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  billingAddress: Address;
  shippingAddress: Address;
  createdAt: number;
  lastModifiedAt: number;
}

export interface Refund {
  id: string;
  purchaseId: string;
  quantity: number;
  amount: number;
  reason: string | null;
  createdAt: number;
}

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
  status: "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  createdAt: number;
  refunds: Refund[];
  refundedQuantity: number;
  refundedAmount: number;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: "GRANT" | "DEDUCT" | "PURCHASE" | "REFUND";
  amount: number;
  balanceAfter: number;
  reason: string;
  relatedPurchaseId: string | null;
  createdAt: number;
}

export interface AdminCustomerSummary {
  customerId: string;
  name: string;
  email: string;
  balance: number;
}

export interface AdminCustomerDetail {
  customer: Customer;
  balance: number;
  purchases: Purchase[];
  ledger: LedgerEntry[];
}

class ApiError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(body.message ?? `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listCustomers(): Promise<AdminCustomerSummary[]> {
  return request("/admin/customers");
}

export function getCustomerDetail(customerId: string): Promise<AdminCustomerDetail> {
  return request(`/admin/customers/${encodeURIComponent(customerId)}`);
}

export function grantCredit(customerId: string, amount: number, reason: string): Promise<LedgerEntry> {
  return request(`/customers/${encodeURIComponent(customerId)}/credit/grant`, {
    method: "POST",
    body: JSON.stringify({ amount, reason })
  });
}

export function deductCredit(customerId: string, amount: number, reason: string): Promise<LedgerEntry> {
  return request(`/customers/${encodeURIComponent(customerId)}/credit/deduct`, {
    method: "POST",
    body: JSON.stringify({ amount, reason })
  });
}

export function refundPurchase(
  purchaseId: string,
  params: { quantity?: number; amount?: number; reason?: string }
): Promise<Purchase> {
  return request(`/purchases/${encodeURIComponent(purchaseId)}/refund`, {
    method: "POST",
    body: JSON.stringify(params)
  });
}
