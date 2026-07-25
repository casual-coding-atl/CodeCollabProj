// PROTOTYPE — canned GitHub data for the GitHub-section UI variants.
// Three variants of the project page's GitHub section, switchable via
// `?ghproto=`, mounted on the existing /projects/$projectId route.
// Throwaway: delete this directory once a variant wins.

export interface ProtoRepo {
  repoId: number;
  owner: string;
  name: string;
  description: string;
  stars: number;
  language: string;
  langColor: string;
  openIssues: number;
  pushedAt: string;
}

export type ProtoEventType = 'push' | 'pr-opened' | 'pr-merged' | 'release';

export interface ProtoEvent {
  id: string;
  repo: string; // short repo name
  type: ProtoEventType;
  actor: string;
  title: string;
  at: string;
}

export const PROTO_REPOS: ProtoRepo[] = [
  {
    repoId: 101,
    owner: 'casual-coding-atl',
    name: 'codecollab-web',
    description: 'Web app — TanStack Start, MongoDB, Tailwind',
    stars: 42,
    language: 'TypeScript',
    langColor: '#3178c6',
    openIssues: 7,
    pushedAt: '2026-07-24T15:10:00Z',
  },
  {
    repoId: 102,
    owner: 'casual-coding-atl',
    name: 'codecollab-mobile',
    description: 'Kotlin Multiplatform companion app',
    stars: 18,
    language: 'Kotlin',
    langColor: '#a97bff',
    openIssues: 3,
    pushedAt: '2026-07-23T21:40:00Z',
  },
  {
    repoId: 103,
    owner: 'casual-coding-atl',
    name: 'codecollab-infra',
    description: 'Terraform for Railway + Atlas + DNS',
    stars: 5,
    language: 'HCL',
    langColor: '#844fba',
    openIssues: 1,
    pushedAt: '2026-07-20T09:05:00Z',
  },
];

export const PROTO_EVENTS: ProtoEvent[] = [
  { id: 'e1', repo: 'codecollab-web', type: 'push', actor: 'alexr', title: '3 commits to main — fix SSR hydration of repo cards', at: '2026-07-24T15:10:00Z' },
  { id: 'e2', repo: 'codecollab-web', type: 'pr-merged', actor: 'jchen', title: '#84 Add passkey registration UI', at: '2026-07-24T13:02:00Z' },
  { id: 'e3', repo: 'codecollab-mobile', type: 'pr-opened', actor: 'priyak', title: '#31 Offline cache for project list', at: '2026-07-23T21:40:00Z' },
  { id: 'e4', repo: 'codecollab-web', type: 'release', actor: 'alexr', title: 'v2.4.0 — notifications GA', at: '2026-07-23T18:15:00Z' },
  { id: 'e5', repo: 'codecollab-mobile', type: 'push', actor: 'priyak', title: '1 commit to develop — bump KMP to 2.2', at: '2026-07-23T16:30:00Z' },
  { id: 'e6', repo: 'codecollab-web', type: 'pr-opened', actor: 'msmith', title: '#86 Repo activity feed component', at: '2026-07-22T20:12:00Z' },
  { id: 'e7', repo: 'codecollab-infra', type: 'pr-merged', actor: 'alexr', title: '#12 Railway railpack builder', at: '2026-07-20T09:05:00Z' },
  { id: 'e8', repo: 'codecollab-web', type: 'push', actor: 'jchen', title: '5 commits to main — Better Auth spike', at: '2026-07-19T22:47:00Z' },
  { id: 'e9', repo: 'codecollab-mobile', type: 'release', actor: 'priyak', title: 'v0.9.0-beta — TestFlight build', at: '2026-07-19T11:20:00Z' },
  { id: 'e10', repo: 'codecollab-infra', type: 'push', actor: 'alexr', title: '2 commits to main — Atlas backup policy', at: '2026-07-18T08:55:00Z' },
];

export const mergedEvents = (): ProtoEvent[] =>
  [...PROTO_EVENTS].sort((a, b) => b.at.localeCompare(a.at));

export const eventsForRepo = (name: string): ProtoEvent[] =>
  mergedEvents().filter((e) => e.repo === name);
