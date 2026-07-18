/**
 * Pure, shared notification helpers — no I/O, no DOM. The server uses
 * `commentRecipients` to fan a comment out to the right people; the client uses
 * `describeNotification` to render each notification to language + a link.
 */

export type NotificationType =
  | 'join_requested'
  | 'join_accepted'
  | 'join_rejected'
  | 'collaborator_added'
  | 'collaborator_removed'
  | 'comment_posted';

export interface NotificationActor {
  _id: string;
  username?: string;
  profileImage?: string;
}
export interface NotificationProjectRef {
  _id: string;
  title?: string;
}

/** The populated notification shape the feed API returns and the UI renders. */
export interface NotificationView {
  _id: string;
  type: NotificationType;
  actor?: NotificationActor | null;
  projectId?: NotificationProjectRef | null;
  commentId?: string | null;
  readAt?: string | null;
  createdAt?: string;
}

/** Turn a notification into human-facing text and a link target. Total over every type. */
export function describeNotification(n: NotificationView): { text: string; href: string } {
  const actor = n.actor?.username ?? 'Someone';
  const title = n.projectId?.title ?? 'a project';
  const projectHref = n.projectId?._id ? `/projects/${n.projectId._id}` : '/notifications';

  switch (n.type) {
    case 'join_requested':
      return { text: `${actor} requested to join ${title}`, href: projectHref };
    case 'join_accepted':
      return { text: `Your request to join ${title} was accepted`, href: projectHref };
    case 'join_rejected':
      return { text: `Your request to join ${title} was declined`, href: projectHref };
    case 'collaborator_added':
      return { text: `${actor} joined ${title}`, href: projectHref };
    case 'collaborator_removed':
      return { text: `You were removed from ${title}`, href: projectHref };
    case 'comment_posted':
      return {
        text: `${actor} commented on ${title}`,
        href: n.projectId?._id && n.commentId ? `${projectHref}#${n.commentId}` : projectHref,
      };
    default:
      return { text: 'You have a new notification', href: projectHref };
  }
}

// Ids may arrive as a raw string, a populated ref ({ _id }), or a Mongoose
// ObjectId — so accept `unknown` and normalize at runtime.
interface RecipientProject {
  owner?: unknown;
  collaborators?: Array<{ userId?: unknown; status?: string }>;
}

function idOf(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const ref = v as { _id?: unknown };
    if (ref._id != null) return String(ref._id); // populated ref
    return String(v); // ObjectId (or anything with a hex toString)
  }
  return String(v);
}

/**
 * Who should be notified about a comment: the project owner plus every accepted
 * collaborator, minus the author (no self-notification), deduped.
 */
export function commentRecipients(project: RecipientProject, authorId: string): string[] {
  const ids = new Set<string>();
  const owner = idOf(project.owner);
  if (owner) ids.add(owner);
  for (const c of project.collaborators ?? []) {
    if (c.status !== 'accepted') continue;
    const id = idOf(c.userId);
    if (id) ids.add(id);
  }
  ids.delete(authorId);
  return [...ids];
}
