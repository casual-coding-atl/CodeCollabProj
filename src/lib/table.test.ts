import { describe, it, expect } from 'vitest';
import { sortByKey, paginate, pageCount } from './table';

describe('sortByKey', () => {
  const rows = [
    { name: 'Charlie', age: 30 },
    { name: 'alice', age: 25 },
    { name: 'Bob', age: 40 },
  ];

  it('sorts strings case-insensitively ascending', () => {
    expect(sortByKey(rows, 'name', 'asc').map((r) => r.name)).toEqual(['alice', 'Bob', 'Charlie']);
  });
  it('sorts descending', () => {
    expect(sortByKey(rows, 'name', 'desc').map((r) => r.name)).toEqual(['Charlie', 'Bob', 'alice']);
  });
  it('sorts numbers', () => {
    expect(sortByKey(rows, 'age', 'asc').map((r) => r.age)).toEqual([25, 30, 40]);
  });
  it('does not mutate input', () => {
    const copy = [...rows];
    sortByKey(rows, 'age', 'desc');
    expect(rows).toEqual(copy);
  });
});

describe('paginate', () => {
  const list = Array.from({ length: 25 }, (_, i) => i + 1);
  it('returns the requested page slice (1-indexed)', () => {
    expect(paginate(list, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginate(list, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(paginate(list, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });
  it('clamps out-of-range pages to empty', () => {
    expect(paginate(list, 4, 10)).toEqual([]);
  });
});

describe('pageCount', () => {
  it('computes total pages', () => {
    expect(pageCount(25, 10)).toBe(3);
    expect(pageCount(20, 10)).toBe(2);
    expect(pageCount(0, 10)).toBe(1);
  });
});
