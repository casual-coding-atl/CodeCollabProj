import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { HydratedDocument } from 'mongoose';
import { connectDB } from './db';
import { Session, User, type UserDoc } from './models';

/** Auth helpers return hydrated docs (so .get()/.toObject()/.save() are typed). */
export type UserHydrated = HydratedDocument<UserDoc>;

/**
 * Shared helpers for the in-process /api/* server routes (src/routes/api/**),
 * which replace the legacy Express API. Same MongoDB, same JSON response shapes,
 * same httpOnly cookie auth — just served by TanStack Start, so there is no
 * separate backend to run.
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

// ── cookies ──────────────────────────────────────────────────────────────────
export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';
const SESSION_DAYS = 7;
const ACCESS_TTL = process.env.WEB_ACCESS_TOKEN_TTL || '7d';

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

function cookieAttrs(maxAgeSec: number): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${maxAgeSec}`];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}
export function setAuthCookies(accessToken: string, refreshToken?: string): Record<string, string> {
  // multiple Set-Cookie via a single header list isn't possible in a plain
  // object; callers append the access cookie and (optionally) refresh cookie.
  const cookies = [`${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; ${cookieAttrs(SESSION_DAYS * 86400)}`];
  if (refreshToken) cookies.push(`${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; ${cookieAttrs(SESSION_DAYS * 86400)}`);
  return { 'set-cookie': cookies.join(', ') };
}
export function clearAuthCookies(): Record<string, string> {
  const expire = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  return { 'set-cookie': `${ACCESS_COOKIE}=; ${expire}, ${REFRESH_COOKIE}=; ${expire}` };
}

// ── session issuing (shared by login/register) ───────────────────────────────
export async function issueSession(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign(
    { userId: String(userId), type: 'access', jti: crypto.randomUUID() },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TTL } as jwt.SignOptions,
  );
  const refreshToken = crypto.randomBytes(64).toString('hex');
  await Session.create({
    userId,
    token: accessToken,
    refreshToken,
    isActive: true,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400 * 1000),
    lastActivity: new Date(),
  });
  return { accessToken, refreshToken };
}

// ── auth from request ────────────────────────────────────────────────────────
export function isCurrentlySuspended(u: UserDoc): boolean {
  if (!u.isSuspended) return false;
  if (!u.suspendedUntil) return true;
  return new Date() < new Date(u.suspendedUntil);
}

/** Returns the authenticated user for a request, or null. Validates JWT + active session record. */
export async function getAuthUser(request: Request): Promise<UserHydrated | null> {
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token) return null;
  let decoded: { userId?: string };
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId?: string };
  } catch {
    return null;
  }
  if (!decoded.userId) return null;
  await connectDB();
  const session = await Session.findOne({
    token,
    userId: decoded.userId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  })
    .populate<{ userId: UserDoc }>('userId')
    .exec();
  if (!session || !session.userId) return null;
  const user = session.userId as unknown as UserHydrated;
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
