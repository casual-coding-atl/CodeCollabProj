// PROTOTYPE — throwaway TUI shell over auth-core.mjs. Run: npm run proto:auth
import 'dotenv/config';
import readline from 'node:readline';
import { MongoClient } from 'mongodb';
import { createAuth, seedLegacyUser, migrateLegacyUsers, guardSession } from './auth-core.mjs';

const PROTO_DB = 'proto_better_auth_WIPEME';
// Same trick as playwright.config: reuse the configured cluster, force our own
// scratch db name so we can never touch dev/prod data.
function deriveUri(base) {
  if (!base) return `mongodb://localhost:27017/${PROTO_DB}`;
  const u = new URL(base);
  u.pathname = `/${PROTO_DB}`;
  return u.toString();
}
const URI = process.env.PROTO_MONGODB_URI || deriveUri(process.env.MONGODB_URI);
const EMAIL = 'legacy@example.com';
const PASSWORD = 'password123';

const B = (s) => `\x1b[1m${s}\x1b[0m`;
const D = (s) => `\x1b[2m${s}\x1b[0m`;
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;

const client = new MongoClient(URI);
try {
  await client.connect();
} catch {
  console.error(R(`Cannot reach MongoDB at ${URI} — start mongod (or set PROTO_MONGODB_URI).`));
  process.exit(1);
}
const db = client.db();
if (db.databaseName !== PROTO_DB) {
  console.error(R(`Refusing to run against db "${db.databaseName}" — expected ${PROTO_DB}.`));
  process.exit(1);
}
const auth = createAuth(db);

let cookie = null;
let log = ['ready — press a key'];

function note(line, ok = true) {
  log = [...log.slice(-4), ok ? G('✔ ') + line : R('✘ ') + line];
}

function cookieFromResponse(res) {
  const setCookies = res.headers.getSetCookie();
  if (!setCookies.length) return null;
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

async function render() {
  const users = await db.collection('users').find().toArray();
  const accounts = await db.collection('account').find().toArray();
  const sessions = await db.collection('session').countDocuments();

  console.clear();
  console.log(B('PROTOTYPE: Better Auth migration feasibility') + D(`  db=${db.databaseName}`));
  console.log();
  console.log(B('users'));
  if (!users.length) console.log(D('  (empty)'));
  for (const u of users) {
    console.log(
      `  ${u.email}  ${D('username=')}${u.username ?? '—'}  ${D('name=')}${u.name ?? '—'}  ` +
        `${D('emailVerified=')}${u.emailVerified ?? '—'}  ${D('role=')}${u.role ?? '—'}  ` +
        `${D('suspended=')}${u.isSuspended ?? '—'}  ` +
        (u.password ? R('legacy-password-present') : G('no-legacy-password')),
    );
  }
  console.log(B('account rows'));
  if (!accounts.length) console.log(D('  (empty)'));
  for (const a of accounts) {
    console.log(
      `  ${D('provider=')}${a.providerId}  ${D('userId=')}${a.userId}  ` +
        (a.password ? G('has-hash') : D('no-hash')),
    );
  }
  console.log(`${B('sessions')} ${sessions}   ${B('cookie')} ${cookie ? G('set') : D('none')}`);
  console.log();
  for (const l of log) console.log(l);
  console.log();
  console.log(
    [
      `${B('[s]')}${D(' seed legacy user')}`,
      `${B('[m]')}${D(' migrate')}`,
      `${B('[l]')}${D(' sign in')}`,
      `${B('[x]')}${D(' sign in wrong pw')}`,
      `${B('[g]')}${D(' guard/getSession')}`,
      `${B('[u]')}${D(' toggle suspended')}`,
      `${B('[r]')}${D(' register via BA')}`,
      `${B('[w]')}${D(' wipe db')}`,
      `${B('[q]')}${D(' quit')}`,
    ].join('  '),
  );
}

const actions = {
  async s() {
    const id = await seedLegacyUser(db, { username: 'legacyuser', email: EMAIL, password: PASSWORD });
    note(`seeded legacy-shaped user ${EMAIL} (${id}) — bcrypt cost 12, no name/emailVerified`);
  },
  async m() {
    const migrated = await migrateLegacyUsers(db);
    note(migrated.length ? `migrated: ${migrated.join(', ')}` : 'nothing to migrate (idempotent)');
  },
  async l() {
    const res = await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      asResponse: true,
    });
    if (res.ok) {
      cookie = cookieFromResponse(res);
      note(`signed in with ORIGINAL password via Better Auth (status ${res.status})`);
    } else {
      note(`sign-in failed: ${res.status} ${await res.text()}`, false);
    }
  },
  async x() {
    const res = await auth.api.signInEmail({
      body: { email: EMAIL, password: 'wrong-password' },
      asResponse: true,
    });
    note(
      res.ok ? 'wrong password ACCEPTED — bug!' : `wrong password correctly rejected (${res.status})`,
      !res.ok,
    );
  },
  async g() {
    if (!cookie) return note('no cookie — sign in first', false);
    const verdict = await guardSession(auth, db, cookie);
    note(`guard: allowed=${verdict.allowed} (${verdict.reason})`, verdict.allowed || verdict.reason === 'suspended');
  },
  async u() {
    const u = await db.collection('users').findOne({ email: EMAIL });
    if (!u) return note('seed first', false);
    await db.collection('users').updateOne({ _id: u._id }, { $set: { isSuspended: !u.isSuspended } });
    note(`isSuspended -> ${!u.isSuspended} (now press [g] to see the guard react)`);
  },
  async r() {
    const res = await auth.api.signUpEmail({
      body: { email: 'new@example.com', password: PASSWORD, name: 'newuser' },
      asResponse: true,
    });
    note(
      res.ok
        ? 'registered new user through Better Auth — check the users row it wrote'
        : `register failed: ${res.status} ${await res.text()}`,
      res.ok,
    );
  },
  async w() {
    await db.dropDatabase();
    cookie = null;
    note('database wiped');
  },
};

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', async (_str, key) => {
  if (!key) return;
  if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
    await client.close();
    process.exit(0);
  }
  const action = actions[key.name];
  if (action) {
    try {
      await action();
    } catch (e) {
      note(`${e?.message ?? e}`, false);
    }
    await render();
  }
});

await render();
