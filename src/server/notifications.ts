/**
 * Notifications: the in-memory SSE subscriber registry + `createNotification`,
 * the single choke point every emit site calls. Writing a notification persists
 * it (source of truth) and pushes it to any live connection for the recipient.
 *
 * The registry is per-process: v1 assumes a single server instance. The client
 * refetches on focus/reconnect, so a missed push self-heals — see PRD #85.
 */
import { connectDB } from './db';
import { Notification } from './models';
import type { NotificationType } from '../lib/notifications';

type Send = (chunk: string) => void;

const subscribers = new Map<string, Set<Send>>();

/** Register a live connection for `userId`. Returns an unsubscribe fn (call on disconnect). */
export function subscribe(userId: string, send: Send): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(send);
  return () => {
    const s = subscribers.get(userId);
    if (!s) return;
    s.delete(send);
    if (s.size === 0) subscribers.delete(userId);
  };
}

/** Push a payload to every live connection for `userId`, as an SSE `data:` frame. Returns # delivered. */
export function emit(userId: string, data: unknown): number {
  const set = subscribers.get(userId);
  if (!set) return 0;
  const frame = `data: ${JSON.stringify(data)}\n\n`;
  for (const send of set) {
    try {
      send(frame);
    } catch {
      // a dead connection will be cleaned up by its own cancel(); ignore here.
    }
  }
  return set.size;
}

export interface CreateNotificationInput {
  userId: string; // recipient
  type: NotificationType;
  actor: string; // who caused it
  projectId?: string;
  commentId?: string;
}

/**
 * Persist a notification and push it to the recipient's live connection(s).
 * Never notifies the actor about their own action. Best-effort: a failure here
 * must never break the triggering action (join/comment/etc.), so it's swallowed.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!input.userId || String(input.userId) === String(input.actor)) return;
  try {
    await connectDB();
    const doc = await Notification.create({
      userId: input.userId,
      type: input.type,
      actor: input.actor,
      projectId: input.projectId,
      commentId: input.commentId,
    });
    await doc.populate('actor', '_id username profileImage');
    await doc.populate('projectId', '_id title');
    emit(String(input.userId), { type: 'notification', notification: doc.toObject() });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[notifications] createNotification failed', e);
  }
}

/** Fan a single event out to many recipients (e.g. a comment to owner + collaborators). */
export async function notifyMany(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>,
): Promise<void> {
  await Promise.all(userIds.map((userId) => createNotification({ ...input, userId })));
}
