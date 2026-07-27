import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Star, CircleDot, ExternalLink, Archive, CloudOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRepoCards, type RepoCardQuery } from '../../hooks/projects';
import type { LinkedRepo } from '../../types';

/**
 * A project's Linked Repositories, as GitHub currently describes them (PRD #88).
 *
 * Up to three cards, one per linked repository, fed by the proxy in
 * `/api/github/repos/*` — the browser never talks to GitHub. Each card is
 * independent on purpose: one repository being deleted, private or momentarily
 * beyond a rate limit turns *that card* into an "unavailable" state and leaves
 * the rest of the page alone. A project with no linked repositories renders
 * nothing at all, not an empty section.
 *
 * The layout is the approved prototype (variant A of the throwaway
 * `prototype-github-section`, now deleted) with real data behind it.
 */

/**
 * Enough of GitHub's language palette to cover what members here actually
 * write, with a neutral dot for everything else. A full colour table would be
 * hundreds of entries maintained forever to tint a 8px circle.
 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Java: '#b07219',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  Go: '#00add8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4f5d95',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Dart: '#00b4ab',
  Vue: '#41b883',
  HCL: '#844fba',
  Dockerfile: '#384d54',
};
const NEUTRAL_LANGUAGE_COLOR = '#8b949e';

const ago = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? 'recently' : formatDistanceToNow(at, { addSuffix: true });
};

const LoadingCard: React.FC = () => (
  <Card data-testid="repo-card-loading">
    <CardContent className="grid gap-2 p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="mt-1 h-3 w-1/2" />
    </CardContent>
  </Card>
);

const RepoCard: React.FC<{ repo: LinkedRepo; query: RepoCardQuery }> = ({ repo, query }) => {
  // The stored owner/name is a cached label, so it is what a card falls back to
  // when GitHub cannot be asked — the card always has a title and a link.
  const fallbackUrl = `https://github.com/${repo.owner}/${repo.name}`;

  if (query.isPending) return <LoadingCard />;

  const card = query.data;

  if (!card || card.state !== 'ok') {
    const permanent = card?.state === 'unavailable';
    return (
      <Card className="border-dashed" data-testid="repo-card-unavailable">
        <CardContent className="grid gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-semibold text-muted-foreground hover:underline"
            >
              {repo.name}
            </a>
            <CloudOff className="size-3.5 shrink-0 text-muted-foreground" />
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {permanent
              ? 'This repository is unavailable on GitHub — it may have been deleted, renamed or made private.'
              : 'GitHub details are temporarily unavailable.'}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            unavailable
          </p>
        </CardContent>
      </Card>
    );
  }

  const { repo: details, stale } = card;
  const language = details.language;

  return (
    <Card className="transition-colors hover:border-primary/40" data-testid="repo-card">
      <CardContent className="grid gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <a
            href={details.htmlUrl || fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-semibold text-primary hover:underline"
          >
            {details.name}
          </a>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">
          {details.description || 'No description.'}
        </p>

        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {language && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: LANGUAGE_COLORS[language] ?? NEUTRAL_LANGUAGE_COLOR }}
              />
              {language}
            </span>
          )}
          <span className="flex items-center gap-1" data-testid="repo-card-stars">
            <Star className="size-3.5" />
            {details.stars}
          </span>
          <span className="flex items-center gap-1">
            <CircleDot className="size-3.5" />
            {details.openIssues}
          </span>
          {details.archived && (
            <Badge variant="outline" className="gap-1 font-mono text-[10px]">
              <Archive className="size-3" />
              archived
            </Badge>
          )}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {details.pushedAt ? `pushed ${ago(details.pushedAt)}` : 'no pushes yet'}
          {stale && ' · cached'}
        </p>
      </CardContent>
    </Card>
  );
};

const LinkedRepoCards: React.FC<{ repos?: LinkedRepo[] }> = ({ repos }) => {
  const linked = repos ?? [];
  const queries = useRepoCards(linked);

  if (linked.length === 0) return null;

  return (
    <div data-testid="linked-repos">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="text-brand-amber">//</span> github
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {linked.map((repo, index) => (
          <RepoCard key={repo.repoId ?? `${repo.owner}/${repo.name}`} repo={repo} query={queries[index]} />
        ))}
      </div>
    </div>
  );
};

export default LinkedRepoCards;
