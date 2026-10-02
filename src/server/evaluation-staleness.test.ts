import { describe, it, expect } from 'vitest';
import { isEvaluationAbandoned, ABANDONED_THRESHOLD_MS } from './evaluation-staleness';

describe('isEvaluationAbandoned', () => {
  const THRESHOLD = ABANDONED_THRESHOLD_MS;

  it('returns false for a pending evaluation that is well within the threshold', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const requestedAt = new Date(now.getTime() - 30_000); // 30 seconds ago
    expect(isEvaluationAbandoned(requestedAt, now)).toBe(false);
  });

  it('returns false when requestedAt is exactly one millisecond before the threshold', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const requestedAt = new Date(now.getTime() - THRESHOLD + 1);
    expect(isEvaluationAbandoned(requestedAt, now)).toBe(false);
  });

  it('returns false when requestedAt is exactly at the threshold boundary', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const requestedAt = new Date(now.getTime() - THRESHOLD);
    // > not >= : exactly at the boundary is NOT yet abandoned
    expect(isEvaluationAbandoned(requestedAt, now)).toBe(false);
  });

  it('returns true when requestedAt is one millisecond past the threshold', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const requestedAt = new Date(now.getTime() - THRESHOLD - 1);
    expect(isEvaluationAbandoned(requestedAt, now)).toBe(true);
  });

  it('returns true for a pending evaluation well past the threshold', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const requestedAt = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
    expect(isEvaluationAbandoned(requestedAt, now)).toBe(true);
  });

  it('accepts an ISO string for requestedAt', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const staleIso = new Date(now.getTime() - THRESHOLD - 1).toISOString();
    expect(isEvaluationAbandoned(staleIso, now)).toBe(true);
  });

  it('treats a malformed requestedAt as abandoned rather than blocking forever', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    expect(isEvaluationAbandoned('not-a-date', now)).toBe(true);
    expect(isEvaluationAbandoned('', now)).toBe(true);
  });

  it('uses the current time when now is not supplied', () => {
    // A doc created in the distant past must always be abandoned regardless of
    // when the test runs — we don't inject `now` here on purpose.
    const ancientDate = new Date(0); // 1970-01-01
    expect(isEvaluationAbandoned(ancientDate)).toBe(true);
  });

  it('the threshold constant is 2 minutes', () => {
    expect(ABANDONED_THRESHOLD_MS).toBe(120_000);
  });
});
