export type ProjectSort = 'newest' | 'oldest' | 'collaborators';

export interface ProjectFilterState {
  search?: string;
  status?: string; // 'all' | actual status
  technology?: string; // 'all' | actual technology
  featured?: boolean;
  sort?: ProjectSort;
}

/** API query params the projects endpoint understands. */
export interface ProjectQuery {
  search?: string;
  status?: string;
  technologies?: string;
  featured?: string;
}

const isSet = (v?: string) => !!v && v !== 'all';

/** Map UI filter state to the API query object, omitting sentinels and blanks. Pure. */
export function toProjectQuery(state: ProjectFilterState): ProjectQuery {
  const query: ProjectQuery = {};
  const search = state.search?.trim();
  if (search) query.search = search;
  if (isSet(state.status)) query.status = state.status;
  if (isSet(state.technology)) query.technologies = state.technology;
  if (state.featured) query.featured = 'true';
  return query;
}

interface SortableProject {
  createdAt?: string | null;
  collaboratorCount?: number;
}

/** Client-side sort (the API only sorts by createdAt desc). Returns a new array. Pure. */
export function sortProjects<T extends SortableProject>(list: T[], sort: ProjectSort): T[] {
  const copy = [...list];
  const time = (p: T) => (p.createdAt ? new Date(p.createdAt).getTime() : 0);
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => time(a) - time(b));
    case 'collaborators':
      return copy.sort((a, b) => (b.collaboratorCount ?? 0) - (a.collaboratorCount ?? 0));
    case 'newest':
    default:
      return copy.sort((a, b) => time(b) - time(a));
  }
}
