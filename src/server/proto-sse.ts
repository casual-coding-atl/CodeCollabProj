/**
 * ⚠️ PROTOTYPE — throwaway. Delete or absorb into src/server/notifications.ts.
 *
 * Question: can a TanStack Start in-process API route hold a long-lived SSE
 * connection through the Nitro/unenv runtime, and can a separate request
 * `emit()` a payload that gets pushed to that live connection?
 *
 * This is the in-memory subscriber registry the real design depends on. No DB,
 * no auth, no Notification model — keyed by a plain ?user= string so the only
 * thing under test is the SSE plumbing.
 */
type Send = (chunk: string) => void;

const subscribers = new Map<string, Set<Send>>();

export function subscribe(user: string, send: Send): () => void {
  let set = subscribers.get(user);
  if (!set) {
    set = new Set();
    subscribers.set(user, set);
  }
  set.add(send);
  return () => {
    set!.delete(send);
    if (set!.size === 0) subscribers.delete(user);
  };
}

/** Push a JSON payload to every live connection for `user`. Returns how many got it. */
export function emit(user: string, data: unknown): number {
  const set = subscribers.get(user);
  if (!set) return 0;
  const frame = `data: ${JSON.stringify(data)}\n\n`;
  for (const send of set) send(frame);
  return set.size;
}

export function stats(): { users: number; connections: number } {
  let connections = 0;
  for (const set of subscribers.values()) connections += set.size;
  return { users: subscribers.size, connections };
}
