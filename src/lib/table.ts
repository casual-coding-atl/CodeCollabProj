export type SortDir = 'asc' | 'desc';

/**
 * Sort a list by a key (case-insensitive for strings). Nullish values always
 * sort last regardless of direction. Returns a new array. Pure.
 */
export function sortByKey<T>(list: T[], key: keyof T, dir: SortDir = 'asc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aNull = av == null;
    const bNull = bv == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1; // nullish last
    if (bNull) return -1;
    if (typeof av === 'string' && typeof bv === 'string') {
      return factor * av.localeCompare(bv, undefined, { sensitivity: 'base' });
    }
    if (av === bv) return 0;
    return factor * (av > bv ? 1 : -1);
  });
}

/** Return the 1-indexed page slice of `perPage` items. Pure. */
export function paginate<T>(list: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return list.slice(start, start + perPage);
}

/** Total number of pages (minimum 1). Pure. */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
