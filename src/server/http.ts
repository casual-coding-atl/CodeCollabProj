import 'dotenv/config';
import type { HydratedDocument } from 'mongoose';
import { getAuth } from './auth';
import { connectDB } from './db';
import { User, type UserDoc } from './models';

/** Auth helpers return hydrated docs (so .get()/.toObject()/.save() are typed). */
export type UserHydrated = HydratedDocument<UserDoc>;

/**
 * Shared helpers for the in-process /api/* server routes (src/routes/api.*.ts),
 * which replace the legacy Express API. Same MongoDB, same JSON response shapes
 * — just served by TanStack Start, so there is no separate backend to run.
 *
 * Sessions and cookies belong to Better Auth (see ./auth and
 * src/routes/api.auth.$.ts). What stays ours is authorization: roles,
 * deactivation and suspension, enforced below on the Mongoose user doc.
 */

// ── response helpers ─────────────────────────────────────────────────────────
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
export function error(status: number, message: string) {
  return json({ message }, status);
}

// ── auth from request ────────────────────────────────────────────────────────
export function isCurrentlySuspended(u: UserDoc): boolean {
  if (!u.isSuspended) return false;
  if (!u.suspendedUntil) return true;
  return new Date() < new Date(u.suspendedUntil);
}

/**
 * The authenticated member for a request, or null. Better Auth validates the
 * session cookie; we then load the user doc and apply the app's own rules, so a
 * member deactivated or suspended mid-session is denied on their next request
 * without anyone having to revoke sessions.
 */
export async function getAuthUser(request: Request): Promise<UserHydrated | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return null;
  await connectDB();
  const user = (await User.findById(userId).exec()) as UserHydrated | null;
  if (!user) return null;
  if (user.isActive === false) return null;
  if (isCurrentlySuspended(user)) return null;
  return user;
}

/** Throws a Response (401/403) if not authenticated; otherwise returns the user. */
export async function requireUser(request: Request): Promise<UserHydrated> {
  const user = await getAuthUser(request);
  if (!user) throw error(401, 'Not authenticated');
  return user;
}

export async function requireRole(request: Request, roles: string[]): Promise<UserHydrated> {
  const user = await requireUser(request);
  if (!roles.includes((user.role as string) ?? 'user')) throw error(403, 'Forbidden');
  return user;
}

/** Wrap a handler so a thrown Response becomes the response (mirrors Express next(err)). */
export function handler(fn: (ctx: { request: Request; params: Record<string, string> }) => Promise<Response>) {
  return async (ctx: { request: Request; params: Record<string, string> }) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof Response) return e;
      // eslint-disable-next-line no-console
      console.error('[api] unhandled', e);
      return error(500, e instanceof Error ? e.message : 'Internal error');
    }
  };
}

export function query(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
