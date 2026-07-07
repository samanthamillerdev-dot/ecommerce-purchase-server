import { config } from "../config";
import { TtlCache } from "./cache";
import { Customer, ExternalApiError } from "./types";

const cache = new TtlCache<Customer>(config.externalApiCacheTtlMs);

export async function getCustomer(customerId: string): Promise<Customer> {
  const cached = cache.get(customerId);
  if (cached) return cached;

  const res = await fetch(`${config.customersApiBaseUrl}/customers/${encodeURIComponent(customerId)}`);
  if (!res.ok) {
    throw new ExternalApiError(`Failed to fetch customer ${customerId} (status ${res.status})`, res.status);
  }
  const customer = (await res.json()) as Customer;
  cache.set(customerId, customer);
  return customer;
}
