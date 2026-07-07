CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('GRANT', 'DEDUCT', 'PURCHASE', 'REFUND')),
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  reason TEXT NOT NULL,
  related_purchase_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_customer ON credit_ledger (customer_id, created_at);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL,
  promo_code TEXT,
  shipment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_customer ON purchases (customer_id, created_at);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases (id),
  quantity INTEGER NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refunds_purchase ON refunds (purchase_id);

CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  discount_percent REAL,
  discount_amount REAL,
  max_uses INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);
