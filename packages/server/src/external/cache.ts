interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Small in-memory TTL cache used in front of the read-only Customers/Products
// GET calls. Entries expire after `ttlMs` so a change made on the external
// team's side (address update, price change, ...) is picked up within that
// window rather than being cached forever - trading a bounded staleness
// window for fewer round trips.
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}
