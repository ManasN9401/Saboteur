// An in-memory Web Storage plus a minimal `window`, so storage code can run under plain Node.
import { vi } from "vitest";

export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  /** Throw QuotaExceededError once the stored text would pass this many characters. */
  quota = Infinity;
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    const size = [...this.data].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0) + k.length + v.length;
    if (size > this.quota) throw new DOMException("full", "QuotaExceededError");
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
  dump(): Record<string, string> {
    return Object.fromEntries(this.data);
  }
}

export function stubWindow() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: session, addEventListener() {}, removeEventListener() {} });
  return { local, session };
}
