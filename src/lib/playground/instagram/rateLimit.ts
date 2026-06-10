// PM2 단일 프로세스 전제의 in-memory sliding window (IP당 10분 5회 용도)
type Options = { limit: number; windowMs: number };

export function createRateLimiter({ limit, windowMs }: Options) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number = Date.now()): boolean {
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      hits.set(key, arr);
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        const live = v.filter((t) => now - t < windowMs);
        if (live.length === 0) hits.delete(k);
        else hits.set(k, live);
      }
    }
    return true;
  };
}
