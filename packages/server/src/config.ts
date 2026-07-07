export interface Config {
  port: number;
  dbPath: string;
  customersApiBaseUrl: string;
  productsApiBaseUrl: string;
  shipmentsApiBaseUrl: string;
  externalApiCacheTtlMs: number;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./data/app.sqlite",
  customersApiBaseUrl: process.env.CUSTOMERS_API_BASE_URL ?? "http://localhost:4001",
  productsApiBaseUrl: process.env.PRODUCTS_API_BASE_URL ?? "http://localhost:4001",
  shipmentsApiBaseUrl: process.env.SHIPMENTS_API_BASE_URL ?? "http://localhost:4001",
  externalApiCacheTtlMs: Number(process.env.EXTERNAL_API_CACHE_TTL_MS ?? 30_000)
};
