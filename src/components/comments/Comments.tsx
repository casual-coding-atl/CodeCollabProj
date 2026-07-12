import React, { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Send, Loader2 } from 'lucide-react';
import { useConfirm } from '@/components/common/confirm';
import { useAuth } from '../../hooks/auth';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from '../../hooks/comments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { Comment } from '../../types';

interface CommentsProps {
  projectId: string;
}

interface CommentApiResponse extends Omit<Comment, 'id' | 'userId'> {
  _id: string;
  author: { _id: string; name: string; avatar?: string };
  content: string;
  createdAt: string;
}

const Comments: React.FC<CommentsProps> = ({ projectId }) => {
  const { user } = useAuth();
  const {
    data: comments = [],
    isLoading: loading,
    error,
    refetch: refetchComments,
  } = useComments(projectId) as unknown as {
    data: CommentApiResponse[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };

  const confirm = useConfirm();
  const createCommentMutation = useCreateComment();
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();

  const [newComment, setNewComment] = useState<string>('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');

  const handleAddComment = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (newComment.trim()) {
      createCommentMutation.mutate(
        { projectId, content: newComment },
        {
          onSuccess: () => {
            setNewComment('');
            toast.success('Comment posted');
          },
          onError: () => toast.error('Couldn’t post comment'),
        }
      );
    }
  };

  const handleUpdateComment = (commentId: string): void => {
    if (editContent.trim()) {
      updateCommentMutation.mutate(
        { commentId, commentData: { projectId, content: editContent } },
        {
          onSuccess: (data) => {
            console.log('✅ Comment updated successfully:', data);
            setEditingComment(null);
            setEditContent('');
          },
          onError: (error) => console.error('❌ Failed to update comment:', error),
        }
      );
    }
  };

  const handleDeleteComment = async (commentId: string): Promise<void> => {
    const ok = await confirm({
      title: 'Delete comment?',
      description: 'This permanently removes the comment. This can’t be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteCommentMutation.mutate(
      { projectId, commentId },
      {
        onSuccess: () => toast.success('Comment deleted'),
        onError: () => toast.error('Couldn’t delete comment'),
      }
    );
  };

  const startEditing = (comment: CommentApiResponse): void => {
    setEditingComment(comment._id);
    setEditContent(comment.content);
  };

  const cancelEditing = (): void => {
    setEditingComment(null);
    setEditContent('');
  };

  const getCurrentUserId = (): string | undefined => {
    if (!user) return undefined;
    return user.id || (user as unknown as { _id?: string })._id;
  };

  const heading = (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-lg font-semibold tracking-tight">Comments</h2>
      {!loading && !error && (
        <span className="font-mono text-xs text-muted-foreground">{comments.length}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <section className="mt-8">
        {heading}
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (error) {
    const errorObj = error as Error & { response?: { data?: { message?: string } } };
    return (
      <section className="mt-8">
        {heading}
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>Error loading comments</AlertTitle>
          <AlertDescription>
            {errorObj?.response?.data?.message || errorObj?.message || 'Failed to load comments'}
          </AlertDescription>
        </Alert>
        <Button onClick={refetchComments}>Try again</Button>
      </section>
    );
  }

  const currentUserId = getCurrentUserId();

  return (
    <section className="mt-8">
      {heading}

      {/* Add comment */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <form onSubmit={handleAddComment} className="space-y-3">
            <Textarea
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
            />
            <Button
              type="submit"
              disabled={!newComment.trim() || createCommentMutation.isPending}
              className="gap-1.5"
            >
              {createCommentMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {createCommentMutation.isPending ? 'Posting…' : 'Post comment'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-4">
        {comments.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Start the conversation.
          </p>
        )}
        {comments.map((comment, i) => (
          <React.Fragment key={comment._id}>
            <div className="flex gap-3">
              <Avatar className="size-9">
                <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
                <AvatarFallback>{comment.author.name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{comment.author.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                  {user && currentUserId === comment.author._id && (
                    <div className="ml-auto flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Edit comment"
                        onClick={() => startEditing(comment)}
                        disabled={
                          editingComment === comment._id || updateCommentMutation.isPending
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        aria-label="Delete comment"
                        onClick={() => handleDeleteComment(comment._id)}
                        disabled={deleteCommentMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {editingComment === comment._id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateComment(comment._id)}
                        disabled={!editContent.trim() || updateCommentMutation.isPending}
                      >
                        {updateCommentMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                    {comment.content}
                  </p>
                )}
              </div>
            </div>
            {i < comments.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

export default Comments;
