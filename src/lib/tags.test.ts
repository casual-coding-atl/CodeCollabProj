import { describe, it, expect } from 'vitest';
import { addTag, removeTag } from './tags';

describe('addTag', () => {
  it('appends a trimmed value', () => {
    expect(addTag(['React'], '  Vue  ')).toEqual(['React', 'Vue']);
  });

  it('ignores empty / whitespace-only values, returning the original list', () => {
    const list = ['React'];
    expect(addTag(list, '')).toBe(list);
    expect(addTag(list, '   ')).toBe(list);
  });

  it('ignores duplicates, returning the original list', () => {
    const list = ['React', 'Vue'];
    expect(addTag(list, 'React')).toBe(list);
    // trims before the dupe check
    expect(addTag(list, '  Vue  ')).toBe(list);
  });

  it('does not mutate the input list', () => {
    const list = ['React'];
    const next = addTag(list, 'Vue');
    expect(list).toEqual(['React']);
    expect(next).not.toBe(list);
  });

  it('is case-sensitive for duplicate detection', () => {
    expect(addTag(['react'], 'React')).toEqual(['react', 'React']);
  });
});

describe('removeTag', () => {
  it('removes every occurrence of the value', () => {
    expect(removeTag(['a', 'b', 'a'], 'a')).toEqual(['b']);
  });

  it('returns an equivalent list when the value is absent', () => {
    expect(removeTag(['a', 'b'], 'c')).toEqual(['a', 'b']);
  });
});
