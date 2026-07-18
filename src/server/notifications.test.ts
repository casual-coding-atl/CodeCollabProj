import { describe, it, expect } from 'vitest';
import { subscribe, emit } from './notifications';

// The subscriber registry is the pure, DB-free core of SSE delivery — the shape
// the proto/notifications-sse spike validated by hand. createNotification (which
// writes to Mongo) is covered by the end-to-end seam, not here.
describe('notification subscriber registry', () => {
  it('delivers an emitted payload to a subscribed user as an SSE data frame', () => {
    const got: string[] = [];
    const unsub = subscribe('u1', (chunk) => got.push(chunk));
    const delivered = emit('u1', { hello: 'world' });
    expect(delivered).toBe(1);
    expect(got).toHaveLength(1);
    expect(got[0]).toBe('data: {"hello":"world"}\n\n');
    unsub();
  });

  it('delivers to no one when the user has no live connection', () => {
    expect(emit('ghost', { x: 1 })).toBe(0);
  });

  it('stops delivering after unsubscribe (no leaked connections)', () => {
    const got: string[] = [];
    const unsub = subscribe('u2', (c) => got.push(c));
    unsub();
    expect(emit('u2', { a: 1 })).toBe(0);
    expect(got).toHaveLength(0);
  });

  it('fans out to every live connection for the same user', () => {
    const a: string[] = [];
    const b: string[] = [];
    const ua = subscribe('u3', (c) => a.push(c));
    const ub = subscribe('u3', (c) => b.push(c));
    expect(emit('u3', { n: 1 })).toBe(2);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    ua();
    ub();
    expect(emit('u3', { n: 2 })).toBe(0);
  });

  it('scopes delivery per user', () => {
    const a: string[] = [];
    const unsubA = subscribe('alice', (c) => a.push(c));
    expect(emit('bob', { for: 'bob' })).toBe(0);
    expect(a).toHaveLength(0);
    unsubA();
  });
});
