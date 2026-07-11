// Real integration tests for the suspension/deactivation enforcement (#19) and its
// review fix: the auth middleware must block suspended/deactivated accounts on
// normal routes but still let them hit the logout endpoints.
import request from 'supertest';
import { startDb, stopDb, clearDb, buildAuthApp } from './helpers';

const User = require('../../models/User');
const sessionService = require('../../services/sessionService');

const app = buildAuthApp();

let counter = 0;
async function userWithSession(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const user = await User.create({
    email: `user${counter}@example.com`,
    username: `user${counter}`,
    password: 'Password123!',
    isEmailVerified: true,
    ...overrides,
  });
  const session = await sessionService.createSession(user._id, {
    userAgent: 'jest',
    ip: '127.0.0.1',
  });
  return { user, token: session.accessToken as string };
}

describe('account suspension/deactivation enforcement (#19)', () => {
  beforeAll(startDb, 60000);
  afterAll(stopDb);
  afterEach(clearDb);

  it('lets an active user reach a protected route', async () => {
    const { token } = await userWithSession();
    const res = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('user1@example.com');
  });

  it('blocks a suspended user on protected routes but still allows logout', async () => {
    const { user, token } = await userWithSession();
    await User.updateOne(
      { _id: user._id },
      { isSuspended: true, suspendedUntil: new Date(Date.now() + 3600_000) }
    );

    const me = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${token}`);
    expect(me.status).toBe(403);

    const logout = await request(app).post('/api/auth/logout').set('Cookie', `accessToken=${token}`);
    expect(logout.status).toBe(200);

    // The session must actually be revoked by logout, so reuse now fails auth.
    const after = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${token}`);
    expect(after.status).toBe(401);
  });

  it('blocks a deactivated user but still allows logout-all', async () => {
    const { user, token } = await userWithSession();
    await User.updateOne({ _id: user._id }, { isActive: false });

    const me = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${token}`);
    expect(me.status).toBe(403);

    const logoutAll = await request(app)
      .post('/api/auth/logout-all')
      .set('Cookie', `accessToken=${token}`);
    expect(logoutAll.status).toBe(200);
  });

  it('edge: a suspension whose suspendedUntil has already passed is not enforced', async () => {
    const { user, token } = await userWithSession();
    await User.updateOne(
      { _id: user._id },
      { isSuspended: true, suspendedUntil: new Date(Date.now() - 1000) }
    );

    const me = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${token}`);
    expect(me.status).toBe(200);
  });

  it('edge: an indefinite suspension (no suspendedUntil) is enforced', async () => {
    const { user, token } = await userWithSession();
    await User.updateOne({ _id: user._id }, { isSuspended: true, $unset: { suspendedUntil: '' } });

    const me = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${token}`);
    expect(me.status).toBe(403);
  });
});
