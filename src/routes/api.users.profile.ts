import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * PUT /api/users/profile  →  userController.updateProfile  (auth + profileUpdateValidator)
 *
 * Updates only the whitelisted, defined fields on the current user. Mirrors the
 * express-validator `profileUpdateValidator` (returns `400 { errors: [...] }` in
 * the express-validator error shape). Sensitive fields stripped from the returned
 * user. Response: the updated `User`.
 *
 * NOTE: there is NO `GET /api/users/profile` in the Express router (own-profile
 * reads go through `GET /api/users/profile/me`), so only PUT is implemented here.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

type FieldError = { type: string; msg: string; path: string; location: string };
const fieldError = (path: string, msg: string): FieldError => ({
  type: 'field',
  msg,
  path,
  location: 'body',
});

const isHttpUrl = (value: string): boolean => /^https?:\/\/.+/.test(value);

/**
 * Replicate profileUpdateValidator. Returns the express-validator-style error
 * list plus the sanitized (trimmed) values to persist, matching the fact that
 * express-validator's `.trim()` mutates req.body before the controller reads it.
 */
function validateProfileUpdate(body: Record<string, unknown>): {
  errors: FieldError[];
  sanitized: Record<string, unknown>;
} {
  const errors: FieldError[] = [];
  const sanitized: Record<string, unknown> = {};

  const trimString = (v: unknown): string => String(v ?? '').trim();

  if (body.firstName !== undefined) {
    const v = trimString(body.firstName);
    sanitized.firstName = v;
    if (v.length < 2) errors.push(fieldError('firstName', 'First name must be at least 2 characters long'));
  }
  if (body.lastName !== undefined) {
    const v = trimString(body.lastName);
    sanitized.lastName = v;
    if (v.length < 2) errors.push(fieldError('lastName', 'Last name must be at least 2 characters long'));
  }
  if (body.bio !== undefined) {
    const v = trimString(body.bio);
    sanitized.bio = v;
    if (v.length > 500) errors.push(fieldError('bio', 'Bio must not exceed 500 characters'));
  }
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills)) {
      errors.push(fieldError('skills', 'Skills must be an array'));
    } else {
      body.skills.forEach((skill) => {
        if (typeof skill !== 'string' || skill.trim() === '') {
          errors.push(fieldError('skills.*', 'Skill cannot be empty'));
        }
      });
    }
    sanitized.skills = body.skills;
  }
  if (body.experience !== undefined) {
    sanitized.experience = body.experience;
    if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(body.experience as string)) {
      errors.push(fieldError('experience', 'Invalid experience level'));
    }
  }
  if (body.location !== undefined) {
    const v = trimString(body.location);
    sanitized.location = v;
    if (v.length > 100) errors.push(fieldError('location', 'Location must not exceed 100 characters'));
  }
  if (body.timezone !== undefined) {
    const v = trimString(body.timezone);
    sanitized.timezone = v;
    if (v.length > 50) errors.push(fieldError('timezone', 'Timezone must not exceed 50 characters'));
  }
  if (body.availability !== undefined) {
    sanitized.availability = body.availability;
    if (!['full-time', 'part-time', 'weekends', 'evenings', 'flexible'].includes(body.availability as string)) {
      errors.push(fieldError('availability', 'Invalid availability'));
    }
  }
  if (body.portfolioLinks !== undefined) {
    if (!Array.isArray(body.portfolioLinks)) {
      errors.push(fieldError('portfolioLinks', 'Portfolio links must be an array'));
    } else {
      body.portfolioLinks.forEach((link) => {
        const l = (link ?? {}) as Record<string, unknown>;
        if (l.name !== undefined && String(l.name).trim() === '') {
          errors.push(fieldError('portfolioLinks.*.name', 'Portfolio link name is required'));
        }
        if (l.url !== undefined) {
          const url = String(l.url).trim();
          if (url !== '' && !isHttpUrl(url)) {
            errors.push(fieldError('portfolioLinks.*.url', 'Portfolio link must be a valid URL'));
          }
        }
      });
    }
    sanitized.portfolioLinks = body.portfolioLinks;
  }
  if (body.socialLinks !== undefined) {
    const social = (body.socialLinks ?? {}) as Record<string, unknown>;
    const urlChecks: Array<[string, string]> = [
      ['github', 'GitHub URL must be a valid URL'],
      ['linkedin', 'LinkedIn URL must be a valid URL'],
      ['twitter', 'Twitter URL must be a valid URL'],
      ['website', 'Website URL must be a valid URL'],
    ];
    for (const [key, msg] of urlChecks) {
      if (social[key] !== undefined) {
        const url = String(social[key]).trim();
        if (url !== '' && !isHttpUrl(url)) errors.push(fieldError(`socialLinks.${key}`, msg));
      }
    }
    sanitized.socialLinks = body.socialLinks;
  }
  if (body.isProfilePublic !== undefined) {
    sanitized.isProfilePublic = body.isProfilePublic;
    if (typeof body.isProfilePublic !== 'boolean') {
      errors.push(fieldError('isProfilePublic', 'Profile visibility must be a boolean'));
    }
  }

  return { errors, sanitized };
}

export const Route = createFileRoute('/api/users/profile')({
  server: {
    handlers: {
      PUT: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        const { errors, sanitized } = validateProfileUpdate(body);
        if (errors.length > 0) return json({ errors }, 400);

        // Only $set the whitelisted fields that were provided (mirrors controller).
        const allowed = [
          'firstName',
          'lastName',
          'bio',
          'skills',
          'experience',
          'location',
          'timezone',
          'availability',
          'portfolioLinks',
          'socialLinks',
          'isProfilePublic',
        ];
        const updateFields: Record<string, unknown> = {};
        for (const key of allowed) {
          if (sanitized[key] !== undefined) updateFields[key] = sanitized[key];
        }

        const user = await User.findByIdAndUpdate(me._id, { $set: updateFields }, { new: true })
          .select(SENSITIVE_FIELDS)
          .exec();

        if (!user) return error(404, 'User not found');

        return json(user);
      }),
    },
  },
});
