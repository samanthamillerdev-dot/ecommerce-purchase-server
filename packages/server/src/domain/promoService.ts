import type { Db } from "../db";
import { ValidationError } from "./errors";

interface PromoCodeRow {
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  max_uses: number | null;
  times_used: number;
  expires_at: number | null;
  active: number;
}

export function calculateDiscount(db: Db, code: string, subtotal: number): number {
  const row = db.prepare(`SELECT * FROM promo_codes WHERE code = ?`).get(code) as PromoCodeRow | undefined;
  if (!row || !row.active) {
    throw new ValidationError(`Promo code "${code}" is not valid`);
  }
  if (row.expires_at !== null && row.expires_at < Date.now()) {
    throw new ValidationError(`Promo code "${code}" has expired`);
  }
  if (row.max_uses !== null && row.times_used >= row.max_uses) {
    throw new ValidationError(`Promo code "${code}" has reached its usage limit`);
  }

  const discount = row.discount_percent !== null ? subtotal * (row.discount_percent / 100) : (row.discount_amount ?? 0);
  return Math.min(discount, subtotal);
}

export function recordUsage(db: Db, code: string): void {
  db.prepare(`UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ?`).run(code);
}
