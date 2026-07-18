/**
 * Pure helpers for editing string[] tag/technology/skill lists.
 *
 * Kept free of any React so the add/remove logic is trivially unit-testable.
 */

/**
 * Returns a new list with `value` appended, after trimming.
 *
 * Empty (or whitespace-only) values and case-sensitive duplicates are ignored,
 * in which case the original list is returned unchanged.
 */
export function addTag(list: string[], value: string): string[] {
  const tag = value.trim();
  if (!tag || list.includes(tag)) {
    return list;
  }
  return [...list, tag];
}

/**
 * Returns a new list with every occurrence of `value` removed.
 */
export function removeTag(list: string[], value: string): string[] {
  return list.filter((tag) => tag !== value);
}
