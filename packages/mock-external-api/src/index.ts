import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { customers, products } from "./data";

export const app = express();
app.use(express.json());

// Artificial network delay so the server's error handling / timeouts get exercised realistically.
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 20);
app.use((_req, _res, next) => setTimeout(next, LATENCY_MS));

app.get("/health", (_req: Request, res: Response) => res.status(200).json({ status: "ok" }));

app.get("/customers/:customerId", (req: Request, res: Response) => {
  const customer = customers[req.params.customerId];
  if (!customer) {
    res.status(404).json({ Message: `Customer ${req.params.customerId} not found` });
    return;
  }
  res.status(200).json(customer);
});

app.get("/products/:productId", (req: Request, res: Response) => {
  const product = products[req.params.productId];
  if (!product) {
    res.status(404).json({ Message: `Product ${req.params.productId} not found` });
    return;
  }
  res.status(200).json(product);
});

interface CreateShipmentBody {
  shippingAddress?: unknown;
  products?: Array<{ sku: string; quantity: number }>;
}

// Every SKU in `products` is shipped except OUT-OF-STOCK-003, which is reserved
// for exercising the "shipment fails -> purchase must not be saved" path in tests.
app.post("/shipments", (req: Request<unknown, unknown, CreateShipmentBody>, res: Response) => {
  const body = req.body ?? {};
  if (!body.shippingAddress || !Array.isArray(body.products) || body.products.length === 0) {
    res.status(400).json({ Message: "shippingAddress and at least one product are required" });
    return;
  }
  const hasUnshippableSku = body.products.some((p) => p.sku === "OUT-OF-STOCK-003");
  if (hasUnshippableSku || req.header("x-force-shipment-failure") === "true") {
    res.status(422).json({ Message: "Carrier rejected shipment: item unavailable" });
    return;
  }
  res.status(200).json({ id: randomUUID() });
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 4001);
  app.listen(port, () => {
    console.log(`mock-external-api listening on :${port}`);
  });
}
