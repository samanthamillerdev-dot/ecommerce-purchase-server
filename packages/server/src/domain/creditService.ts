import { randomUUID } from "crypto";
import type { Db } from "../db";
import { InsufficientCreditError, ValidationError } from "./errors";
import { formatMoney } from "./format";
import { LedgerEntry, LedgerEntryType } from "./types";

interface LedgerRow {
  id: string;
  customer_id: string;
  type: LedgerEntryType;
  amount: number;
  balance_after: number;
  reason: string;
  related_purchase_id: string | null;
  created_at: number;
}

function toLedgerEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    reason: row.reason,
    relatedPurchaseId: row.related_purchase_id,
    createdAt: row.created_at
  };
}

export function getBalance(db: Db, customerId: string): number {
  const row = db
    .prepare(`SELECT balance_after FROM credit_ledger WHERE customer_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get(customerId) as { balance_after: number } | undefined;
  return row?.balance_after ?? 0;
}

export function listLedger(db: Db, customerId: string): LedgerEntry[] {
  const rows = db
    .prepare(`SELECT * FROM credit_ledger WHERE customer_id = ? ORDER BY created_at DESC, rowid DESC`)
    .all(customerId) as unknown as LedgerRow[];
  return rows.map(toLedgerEntry);
}

export function appendLedgerEntry(
  db: Db,
  params: {
    customerId: string;
    type: LedgerEntryType;
    amount: number;
    reason: string;
    relatedPurchaseId?: string;
  }
): LedgerEntry {
  const currentBalance = getBalance(db, params.customerId);
  const balanceAfter = currentBalance + params.amount;
  const row: LedgerRow = {
    id: randomUUID(),
    customer_id: params.customerId,
    type: params.type,
    amount: params.amount,
    balance_after: balanceAfter,
    reason: params.reason,
    related_purchase_id: params.relatedPurchaseId ?? null,
    created_at: Date.now()
  };
  db.prepare(
    `INSERT INTO credit_ledger (id, customer_id, type, amount, balance_after, reason, related_purchase_id, created_at)
     VALUES (@id, @customer_id, @type, @amount, @balance_after, @reason, @related_purchase_id, @created_at)`
  ).run(row as unknown as Record<string, string | number | null>);
  return toLedgerEntry(row);
}

export function grantCredit(db: Db, customerId: string, amount: number, reason: string): LedgerEntry {
  if (amount <= 0) throw new ValidationError("Grant amount must be positive");
  return appendLedgerEntry(db, { customerId, type: "GRANT", amount, reason });
}

export function deductCredit(db: Db, customerId: string, amount: number, reason: string): LedgerEntry {
  if (amount <= 0) throw new ValidationError("Deduct amount must be positive");
  const balance = getBalance(db, customerId);
  if (balance < amount) {
    throw new InsufficientCreditError(
      `Insufficient credit: balance is ${formatMoney(balance)}, but ${formatMoney(amount)} was requested`
    );
  }
  return appendLedgerEntry(db, { customerId, type: "DEDUCT", amount: -amount, reason });
}
