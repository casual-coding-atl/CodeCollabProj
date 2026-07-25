import { describe, it, expect } from 'vitest';
import { isStrongPassword, passwordSchema } from './passwordPolicy';

describe('isStrongPassword', () => {
  it('accepts a password with all four character classes and length 8', () => {
    expect(isStrongPassword('E2e-pass')).toBe(true);
    expect(isStrongPassword('Str0ng!Passphrase')).toBe(true);
  });

  it('rejects anything shorter than the server minimum of 8', () => {
    expect(isStrongPassword('E2e-pas')).toBe(false);
  });

  it('rejects a password missing a character class', () => {
    expect(isStrongPassword('lowercase1!')).toBe(false); // no upper
    expect(isStrongPassword('UPPERCASE1!')).toBe(false); // no lower
    expect(isStrongPassword('NoDigits!!')).toBe(false); // no digit
    expect(isStrongPassword('NoSymbols1')).toBe(false); // no symbol
  });
});

describe('passwordSchema', () => {
  it('reports an empty password as missing, not as weak', () => {
    const result = passwordSchema('New password is required').safeParse('');
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toBe(
      'New password is required'
    );
  });

  it('explains what a password needs when it is too weak', () => {
    const result = passwordSchema().safeParse('weak');
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toMatch(
      /at least 8 characters/
    );
  });
});
