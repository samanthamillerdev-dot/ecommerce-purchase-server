import { existsSync, mkdirSync, readFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "path";
import { config } from "../config";

export type Db = DatabaseSync;

export function openDb(path: string = config.dbPath): Db {
  const dir = dirname(path);
  if (path !== ":memory:" && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  seedPromoCodes(db);
  return db;
}

// node:sqlite has no built-in transaction helper (unlike better-sqlite3), so
// we roll our own around BEGIN/COMMIT/ROLLBACK for the multi-statement writes
// in purchase/refund that must succeed or fail together.
export function runInTransaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// Seed a couple of demo promo codes. In real life these would be managed
// through their own CRUD endpoints; out of scope here since the assignment
// only asks that promo codes be *handled* at purchase time.
function seedPromoCodes(db: Db): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO promo_codes (code, discount_percent, discount_amount, max_uses, expires_at, active)
     VALUES (@code, @discount_percent, @discount_amount, @max_uses, @expires_at, 1)`
  );
  insert.run({
    code: "WELCOME10",
    discount_percent: 10,
    discount_amount: null,
    max_uses: null,
    expires_at: null
  });
  insert.run({
    code: "FIVEOFF",
    discount_percent: null,
    discount_amount: 5,
    max_uses: null,
    expires_at: null
  });
}
