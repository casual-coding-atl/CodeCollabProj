// PROTOTYPE variant C — "Activity-first": the merged feed IS the section,
// grouped by day with prominent rows; repos demoted to compact chips in the
// header. Feed-dominant hierarchy.
import React from 'react';
import { format, formatDistanceToNow, isSameDay, subDays } from 'date-fns';
import { Star, GitCommit, GitPullRequest, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PROTO_REPOS, mergedEvents, type ProtoEvent, type ProtoEventType } from './fixtures';

const EVENT_ICON: Record<ProtoEventType, React.ReactNode> = {
  push: <GitCommit className="size-4 text-muted-foreground" />,
  'pr-opened': <GitPullRequest className="size-4 text-brand-amber" />,
  'pr-merged': <GitPullRequest className="size-4 text-primary" />,
  release: <Rocket className="size-4 text-primary" />,
};

const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, subDays(now, 1))) return 'Yesterday';
  return format(d, 'MMM d');
};

const groupByDay = (events: ProtoEvent[]): Array<[string, ProtoEvent[]]> => {
  const groups: Array<[string, ProtoEvent[]]> = [];
  for (const e of events) {
    const label = dayLabel(e.at);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(e);
    else groups.push([label, [e]]);
  }
  return groups;
};

const VariantC: React.FC = () => (
  <Card>
    <CardContent className="grid gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">What’s happening</h3>
        <div className="flex flex-wrap gap-1.5">
          {PROTO_REPOS.map((repo) => (
            <a
              key={repo.repoId}
              href={`https://github.com/${repo.owner}/${repo.name}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Badge variant="outline" className="gap-1 font-mono text-[10px] hover:border-primary">
                <span
                  className="inline-block size-1.5 rounded-full"
                  style={{ backgroundColor: repo.langColor }}
                />
                {repo.name.replace('codecollab-', '')}
                <Star className="size-2.5" />
                {repo.stars}
              </Badge>
            </a>
          ))}
        </div>
      </div>

      {groupByDay(mergedEvents()).map(([label, events]) => (
        <div key={label} className="grid gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="text-brand-amber">//</span> {label}
          </p>
          <ul className="grid gap-1">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
              >
                {EVENT_ICON[e.type]}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">{e.actor}</span>{' '}
                    <span className="text-muted-foreground">
                      {e.type === 'push'
                        ? 'pushed'
                        : e.type === 'pr-opened'
                          ? 'opened'
                          : e.type === 'pr-merged'
                            ? 'merged'
                            : 'released'}
                    </span>{' '}
                    {e.title}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {e.repo.replace('codecollab-', '')} ·{' '}
                  {formatDistanceToNow(new Date(e.at), { addSuffix: false })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default VariantC;
