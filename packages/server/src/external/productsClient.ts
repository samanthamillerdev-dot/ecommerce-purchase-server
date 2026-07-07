import { config } from "../config";
import { TtlCache } from "./cache";
import { ExternalApiError, Product } from "./types";

const cache = new TtlCache<Product>(config.externalApiCacheTtlMs);

export async function getProduct(productId: string): Promise<Product> {
  const cached = cache.get(productId);
  if (cached) return cached;

  const res = await fetch(`${config.productsApiBaseUrl}/products/${encodeURIComponent(productId)}`);
  if (!res.ok) {
    throw new ExternalApiError(`Failed to fetch product ${productId} (status ${res.status})`, res.status);
  }
  const product = (await res.json()) as Product;
  cache.set(productId, product);
  return product;
}
