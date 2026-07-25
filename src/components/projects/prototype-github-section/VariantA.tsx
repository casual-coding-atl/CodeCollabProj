// PROTOTYPE variant A — "Cards + merged feed": a grid of repo cards up top,
// one merged timeline below. The classic layout.
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Star, CircleDot, ExternalLink, GitCommit, GitPullRequest, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PROTO_REPOS, mergedEvents, type ProtoEventType } from './fixtures';

const EVENT_ICON: Record<ProtoEventType, React.ReactNode> = {
  push: <GitCommit className="size-4 text-muted-foreground" />,
  'pr-opened': <GitPullRequest className="size-4 text-brand-amber" />,
  'pr-merged': <GitPullRequest className="size-4 text-primary" />,
  release: <Rocket className="size-4 text-primary" />,
};

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

const VariantA: React.FC = () => (
  <div className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {PROTO_REPOS.map((repo) => (
        <Card key={repo.repoId} className="transition-colors hover:border-primary/40">
          <CardContent className="grid gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <a
                href={`https://github.com/${repo.owner}/${repo.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-semibold text-primary hover:underline"
              >
                {repo.name}
              </a>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{repo.description}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
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
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              pushed {ago(repo.pushedAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card>
      <CardContent className="grid gap-3 p-4">
        <h3 className="text-base font-semibold">Recent activity</h3>
        <ul className="grid gap-3">
          {mergedEvents().map((e, i) => (
            <React.Fragment key={e.id}>
              {i > 0 && <Separator />}
              <li className="flex items-center gap-3">
                {EVENT_ICON[e.type]}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.actor} · {ago(e.at)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {e.repo.replace('codecollab-', '')}
                </Badge>
              </li>
            </React.Fragment>
          ))}
        </ul>
      </CardContent>
    </Card>
  </div>
);

export default VariantA;
