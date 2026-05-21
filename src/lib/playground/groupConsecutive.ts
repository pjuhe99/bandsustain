export type ConsecutiveGroup<T, K> = { key: K; items: T[] };

export function groupConsecutiveBy<T, K>(
  items: readonly T[],
  key: (t: T) => K,
): ConsecutiveGroup<T, K>[] {
  if (items.length === 0) return [];
  const groups: ConsecutiveGroup<T, K>[] = [];
  let currentKey = key(items[0]);
  let currentItems: T[] = [items[0]];
  for (let i = 1; i < items.length; i++) {
    const k = key(items[i]);
    if (k === currentKey) {
      currentItems.push(items[i]);
    } else {
      groups.push({ key: currentKey, items: currentItems });
      currentKey = k;
      currentItems = [items[i]];
    }
  }
  groups.push({ key: currentKey, items: currentItems });
  return groups;
}
