// Real integration tests for registration user-enumeration handling (#19/#35): a
// duplicate email and a duplicate username must produce identical responses so the
// endpoint can't be used as an account-existence oracle.
import request from 'supertest';
import { startDb, stopDb, clearDb, buildAuthApp } from './helpers';

const app = buildAuthApp();

const GENERIC = 'An account with this email or username already exists';

async function register(email: string, username: string) {
  return request(app).post('/api/auth/register').send({ email, username, password: 'Password123!' });
}

describe('registration enumeration handling (#35)', () => {
  beforeAll(startDb, 60000);
  afterAll(stopDb);
  afterEach(clearDb);

  it('creates a new account for a fresh email/username', async () => {
    const res = await register('new@example.com', 'freshuser');
    expect(res.status).toBe(201);
  });

  it('rejects a duplicate email with the generic message', async () => {
    await register('dup@example.com', 'first');
    const res = await register('dup@example.com', 'second');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC);
  });

  it('rejects a duplicate username with the same generic message', async () => {
    await register('one@example.com', 'sameuser');
    const res = await register('two@example.com', 'sameuser');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(GENERIC);
  });

  it('edge: duplicate-email and duplicate-username responses are byte-identical (no oracle)', async () => {
    await register('carol@example.com', 'carol');
    const dupEmail = await register('carol@example.com', 'nottaken');
    const dupUsername = await register('nottaken@example.com', 'carol');

    // If these differed in status or body, an attacker could tell which field
    // matched and thus enumerate registered emails.
    expect(dupEmail.status).toBe(dupUsername.status);
    expect(dupEmail.body).toEqual(dupUsername.body);
  });
});
