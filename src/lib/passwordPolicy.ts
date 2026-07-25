import { z } from 'zod';

/**
 * One password rule, in one place.
 *
 * Register, change-password and reset-password all set a password, so all three
 * have to agree on what a good one is — and they didn't: the reset form accepted
 * six characters, below the server's own eight-character minimum, so a member
 * following a reset link could type a password Better Auth would then refuse.
 * The rule below is the strictest of the three (what the register form already
 * asked for), and every form imports it rather than restating it.
 */

/** At least 8 characters, with lower case, upper case, a digit and a symbol. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character';

/** Zod field for "choose a new password", with the message members see. */
export function passwordSchema(requiredMessage = 'Password is required'): z.ZodString {
  return z.string().min(1, requiredMessage).regex(PASSWORD_RULE, PASSWORD_REQUIREMENTS);
}

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULE.test(password);
}
