import { logger } from "../utils/logger.js";

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 60) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  invalidate(pattern) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
    logger.info({ pattern }, "Cache invalidated for pattern");
  }

  flush() {
    this.store.clear();
  }
}

export const cache = new MemoryCache();
export default cache;
