import { describe, it, expect, beforeEach, vi } from 'vitest';

// The session guard: Better Auth answers "whose session is this?", then we
// enforce the app's own isActive / isSuspended / suspendedUntil rules. Both
// outbound edges (Better Auth's getSession, the Mongo user lookup) are stubbed;
// everything asserted here is what a route handler observes.

const getSession = vi.fn();
const findById = vi.fn();

vi.mock('./auth', () => ({
  getAuth: async () => ({ api: { getSession } }),
}));
vi.mock('./db', () => ({ connectDB: async () => undefined }));
vi.mock('./models', () => ({ User: { findById } }));

const { getAuthUser, requireUser, requireRole } = await import('./http');

type UserStub = Record<string, unknown>;

/** A valid Better Auth session whose user doc resolves to `user` (null = doc gone). */
function signedInAs(user: UserStub | null, sessionUserId = 'user-1') {
  getSession.mockResolvedValue({ user: { id: sessionUserId } });
  findById.mockReturnValue({ exec: async () => user });
}
function signedOut() {
  getSession.mockResolvedValue(null);
  findById.mockReturnValue({ exec: async () => null });
}

const req = () => new Request('http://localhost:3000/api/projects');

const active: UserStub = { _id: 'user-1', email: 'a@b.c', role: 'user', isActive: true, isSuspended: false };

beforeEach(() => {
  getSession.mockReset();
  findById.mockReset();
});

describe('getAuthUser', () => {
  it('returns the user doc for an active member with a valid session', async () => {
    signedInAs(active);
    await expect(getAuthUser(req())).resolves.toBe(active);
  });

  it('returns null when there is no Better Auth session', async () => {
    signedOut();
    await expect(getAuthUser(req())).resolves.toBeNull();
  });

  it('returns null when the session points at a user doc that no longer exists', async () => {
    signedInAs(null);
    await expect(getAuthUser(req())).resolves.toBeNull();
  });

  it('denies a deactivated member even though the session is valid', async () => {
    signedInAs({ ...active, isActive: false });
    await expect(getAuthUser(req())).resolves.toBeNull();
  });

  it('denies a member suspended until a future date', async () => {
    signedInAs({ ...active, isSuspended: true, suspendedUntil: new Date(Date.now() + 86_400_000) });
    await expect(getAuthUser(req())).resolves.toBeNull();
  });

  it('denies a member suspended indefinitely (no end date)', async () => {
    signedInAs({ ...active, isSuspended: true });
    await expect(getAuthUser(req())).resolves.toBeNull();
  });

  it('allows a member whose suspension has expired', async () => {
    const expired = { ...active, isSuspended: true, suspendedUntil: new Date(Date.now() - 86_400_000) };
    signedInAs(expired);
    await expect(getAuthUser(req())).resolves.toBe(expired);
  });

  it('looks the user up by the id Better Auth reports', async () => {
    signedInAs(active, 'abc123');
    await getAuthUser(req());
    expect(findById).toHaveBeenCalledWith('abc123');
  });
});

describe('requireUser', () => {
  it('returns the user when the guard allows', async () => {
    signedInAs(active);
    await expect(requireUser(req())).resolves.toBe(active);
  });

  it('throws a 401 response when the guard denies', async () => {
    signedOut();
    const thrown = await requireUser(req()).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it('throws a 401 response for a suspended member', async () => {
    signedInAs({ ...active, isSuspended: true });
    const thrown = await requireUser(req()).catch((e: unknown) => e);
    expect((thrown as Response).status).toBe(401);
  });
});

describe('requireRole', () => {
  it('returns the user when their role is allowed', async () => {
    const admin = { ...active, role: 'admin' };
    signedInAs(admin);
    await expect(requireRole(req(), ['admin'])).resolves.toBe(admin);
  });

  it('throws a 403 response when the role is not allowed', async () => {
    signedInAs(active);
    const thrown = await requireRole(req(), ['admin']).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it('treats a user doc with no role as a plain user', async () => {
    const roleless = { _id: 'user-1', isActive: true };
    signedInAs(roleless);
    await expect(requireRole(req(), ['user'])).resolves.toBe(roleless);
    signedInAs(roleless);
    const thrown = await requireRole(req(), ['admin']).catch((e: unknown) => e);
    expect((thrown as Response).status).toBe(403);
  });
});
