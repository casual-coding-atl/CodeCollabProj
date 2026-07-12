import { describe, it, expect } from 'vitest';
import { toProjectQuery, sortProjects, type ProjectFilterState } from './projectFilters';

describe('toProjectQuery', () => {
  it('is empty for empty/default state', () => {
    expect(toProjectQuery({})).toEqual({});
    expect(toProjectQuery({ status: 'all', technology: 'all', search: '' })).toEqual({});
  });

  it('maps set filters to API query params, omitting sentinels/empties', () => {
    expect(toProjectQuery({ search: 'robot' })).toEqual({ search: 'robot' });
    expect(toProjectQuery({ status: 'in-progress' })).toEqual({ status: 'in-progress' });
    expect(toProjectQuery({ technology: 'React' })).toEqual({ technologies: 'React' });
    expect(toProjectQuery({ featured: true })).toEqual({ featured: 'true' });
  });

  it('trims search and drops it when blank', () => {
    expect(toProjectQuery({ search: '  spaced  ' })).toEqual({ search: 'spaced' });
    expect(toProjectQuery({ search: '   ' })).toEqual({});
  });

  it('combines multiple filters', () => {
    expect(toProjectQuery({ search: 'x', status: 'completed', technology: 'Go', featured: true })).toEqual({
      search: 'x',
      status: 'completed',
      technologies: 'Go',
      featured: 'true',
    });
  });
});

describe('sortProjects', () => {
  const p = (id: string, created: string, collabs: number) => ({
    id,
    createdAt: created,
    collaboratorCount: collabs,
  });
  const list = [p('a', '2026-01-01', 1), p('b', '2026-03-01', 5), p('c', '2026-02-01', 0)];

  it('newest first by createdAt', () => {
    expect(sortProjects(list, 'newest').map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('oldest first', () => {
    expect(sortProjects(list, 'oldest').map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });
  it('by collaborator count desc', () => {
    expect(sortProjects(list, 'collaborators').map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
  it('does not mutate the input', () => {
    const copy = [...list];
    sortProjects(list, 'newest');
    expect(list).toEqual(copy);
  });
});

// type is exported for the UI
const _typecheck: ProjectFilterState = { search: 'x', status: 'all', technology: 'all', featured: false, sort: 'newest' };
void _typecheck;
