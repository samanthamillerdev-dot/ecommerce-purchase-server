import type { Db } from "./db";
import cors from "cors";
import express, { Express } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { adminRoutes } from "./routes/adminRoutes";
import { creditRoutes } from "./routes/creditRoutes";
import { purchaseRoutes } from "./routes/purchaseRoutes";

export function createApp(db: Db): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use(creditRoutes(db));
  app.use(purchaseRoutes(db));
  app.use(adminRoutes(db));

  app.use(errorHandler);
  return app;
}
