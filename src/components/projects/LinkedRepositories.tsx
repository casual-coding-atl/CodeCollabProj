import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  repoErrorMessage,
  useLinkRepo,
  useLinkedRepos,
  useUnlinkRepo,
} from '../../hooks/projects';
import GithubMark from '../icons/GithubMark';
import type { LinkedRepo } from '../../types';

/**
 * The Linked Repositories of a project, on its edit page.
 *
 * Only the owner sees this (the edit page is theirs alone) and only the server
 * decides: it parses the pasted link, checks with GitHub that the repository
 * exists and is public, and enforces the three-repo cap. Every rejection
 * therefore arrives as a written message, which is shown verbatim rather than
 * being second-guessed here.
 *
 * Live cards for these repositories come later (PRD #88, phase 2 continued);
 * this is the place they are attached and removed.
 */

const MAX_LINKED_REPOS = 3;

function linkedWhen(value: string | undefined): string {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return `${formatDistanceToNow(date)} ago`;
}

interface LinkedRepositoriesProps {
  projectId: string;
}

const LinkedRepositories: React.FC<LinkedRepositoriesProps> = ({ projectId }) => {
  const { data: repos, isLoading, isError, refetch } = useLinkedRepos(projectId);
  const linkRepo = useLinkRepo(projectId);
  const unlinkRepo = useUnlinkRepo(projectId);
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const linked = repos ?? [];
  const isFull = linked.length >= MAX_LINKED_REPOS;

  const handleLink = (): void => {
    const value = url.trim();
    if (!value) {
      setMessage('Paste a repository link, for example https://github.com/owner/repo.');
      return;
    }
    setMessage(null);
    linkRepo.mutate(value, {
      onSuccess: (data) => {
        setUrl('');
        const repo = data.repo;
        toast.success(repo ? `Linked ${repo.owner}/${repo.name}` : 'Repository linked');
      },
      onError: (error) => {
        const text = repoErrorMessage(error, 'Could not link that repository');
        setMessage(text);
        toast.error(text);
      },
    });
  };

  const handleUnlink = (repo: LinkedRepo): void => {
    setMessage(null);
    unlinkRepo.mutate(repo.repoId, {
      onSuccess: () => toast.success(`Unlinked ${repo.owner}/${repo.name}`),
      onError: (error) => {
        const text = repoErrorMessage(error, 'Could not unlink that repository');
        setMessage(text);
        toast.error(text);
      },
    });
  };

  return (
    <Card className="mt-6" data-testid="linked-repositories">
      <CardHeader>
        <CardTitle>Linked repositories</CardTitle>
        <CardDescription>
          Attach up to {MAX_LINKED_REPOS} public GitHub repositories so collaborators can read the
          code. Private repositories cannot be linked.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="linked-repo-url">Repository URL</Label>
            <Input
              id="linked-repo-url"
              data-testid="linked-repo-url"
              placeholder="https://github.com/owner/repo"
              value={url}
              disabled={isFull}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!isFull) handleLink();
                }
              }}
            />
          </div>
          <Button
            type="button"
            data-testid="link-repo"
            onClick={handleLink}
            disabled={linkRepo.isPending || isFull}
          >
            {linkRepo.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Link repository
          </Button>
        </div>

        {isFull && (
          <p className="text-sm text-muted-foreground">
            This project has its {MAX_LINKED_REPOS} repositories. Remove one to link another.
          </p>
        )}

        {message && (
          <Alert variant="destructive" data-testid="linked-repo-error">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {isLoading && <Skeleton className="h-14 w-full" />}

        {!isLoading && isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span>Could not load the linked repositories.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && linked.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No repositories linked yet.
          </p>
        )}

        <div className="space-y-2">
          {linked.map((repo) => (
            <div
              key={repo.repoId}
              data-testid="linked-repo-row"
              className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <GithubMark className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <a
                    href={`https://github.com/${repo.owner}/${repo.name}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 truncate font-medium hover:underline"
                  >
                    {repo.owner}/{repo.name}
                    <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  </a>
                  <p className="text-xs text-muted-foreground">Linked {linkedWhen(repo.linkedAt)}</p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Unlink ${repo.owner}/${repo.name}`}
                    data-testid="unlink-repo"
                    disabled={unlinkRepo.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlink this repository?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <strong>
                        {repo.owner}/{repo.name}
                      </strong>{' '}
                      will no longer appear on the project page. Nothing on GitHub changes, and you
                      can link it again later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleUnlink(repo)}>Unlink</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LinkedRepositories;
