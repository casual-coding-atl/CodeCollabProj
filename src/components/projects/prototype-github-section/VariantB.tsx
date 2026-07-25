// PROTOTYPE variant B — "Per-repo panels": each repo is its own column with
// its own mini activity feed. Repo-grouped hierarchy, no merged stream.
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Star, CircleDot, GitCommit, GitPullRequest, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PROTO_REPOS, eventsForRepo, type ProtoEventType } from './fixtures';

const EVENT_ICON: Record<ProtoEventType, React.ReactNode> = {
  push: <GitCommit className="size-3.5 text-muted-foreground" />,
  'pr-opened': <GitPullRequest className="size-3.5 text-brand-amber" />,
  'pr-merged': <GitPullRequest className="size-3.5 text-primary" />,
  release: <Rocket className="size-3.5 text-primary" />,
};

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

const VariantB: React.FC = () => (
  <div className="grid items-start gap-3 md:grid-cols-3">
    {PROTO_REPOS.map((repo) => (
      <Card key={repo.repoId} className="h-full">
        <CardContent className="grid gap-3 p-4">
          <div>
            <a
              href={`https://github.com/${repo.owner}/${repo.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:underline"
            >
              {repo.name}
            </a>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: repo.langColor }}
                />
                {repo.language}
              </span>
              <span className="flex items-center gap-1">
                <Star className="size-3.5" />
                {repo.stars}
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="size-3.5" />
                {repo.openIssues}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-2.5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              activity
            </p>
            <ul className="grid gap-2">
              {eventsForRepo(repo.name)
                .slice(0, 4)
                .map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <span className="mt-0.5">{EVENT_ICON[e.type]}</span>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-xs text-foreground">{e.title}</p>
                      <p className="text-[11px] text-muted-foreground">{ago(e.at)}</p>
                    </div>
                  </li>
                ))}
              {eventsForRepo(repo.name).length === 0 && (
                <li className="text-xs text-muted-foreground">No recent activity</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default VariantB;
