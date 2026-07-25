import { describe, it, expect } from 'vitest';
import { AUTH_MIGRATION_NOTICE, migrationNoticeEnabled } from './authNotice';

describe('migrationNoticeEnabled', () => {
  it('is off when the operator has not set the flag', () => {
    expect(migrationNoticeEnabled(undefined)).toBe(false);
    expect(migrationNoticeEnabled(null)).toBe(false);
    expect(migrationNoticeEnabled('')).toBe(false);
  });

  it('is off for the values an unset shell variable tends to become', () => {
    expect(migrationNoticeEnabled('0')).toBe(false);
    expect(migrationNoticeEnabled('false')).toBe(false);
    expect(migrationNoticeEnabled(false)).toBe(false);
  });

  it('is on only when deliberately turned on', () => {
    expect(migrationNoticeEnabled('1')).toBe(true);
    expect(migrationNoticeEnabled('true')).toBe(true);
    expect(migrationNoticeEnabled(true)).toBe(true);
  });
});

describe('AUTH_MIGRATION_NOTICE', () => {
  it('tells a member both things they need: they were signed out, and their password still works', () => {
    expect(AUTH_MIGRATION_NOTICE).toMatch(/signed out/i);
    expect(AUTH_MIGRATION_NOTICE).toMatch(/password still works/i);
  });
});
