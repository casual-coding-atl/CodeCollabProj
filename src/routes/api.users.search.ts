import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser, query } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * GET /api/users/search  →  userController.searchUsers  (auth)
 *
 * Free-text `query` (regex-escaped, matched against firstName/lastName/username/bio)
 * plus optional `skills` (comma list → $in), `experience`, `availability`, and
 * `location` (regex) filters. Always scoped to public profiles. Sensitive fields
 * + `email` stripped. Sorted newest-first. Response: `User[]`.
 * (The client maps its `search` box to the `query` param.)
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

// Escape regex metacharacters so the term matches literally (prevents ReDoS).
function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const Route = createFileRoute('/api/users/search')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        await requireUser(request);
        await connectDB();

        const q = query(request);
        const term = q.get('query');
        const skills = q.get('skills');
        const experience = q.get('experience');
        const availability = q.get('availability');
        const location = q.get('location');

        const searchCriteria: Record<string, unknown> = { isProfilePublic: true };

        if (term) {
          const safeQuery = escapeRegExp(term);
          searchCriteria.$or = [
            { firstName: { $regex: safeQuery, $options: 'i' } },
            { lastName: { $regex: safeQuery, $options: 'i' } },
            { username: { $regex: safeQuery, $options: 'i' } },
            { bio: { $regex: safeQuery, $options: 'i' } },
          ];
        }

        if (skills) {
          const skillsArray = skills.split(',').map((skill) => skill.trim());
          searchCriteria.skills = { $in: skillsArray };
        }

        if (experience) searchCriteria.experience = experience;
        if (availability) searchCriteria.availability = availability;
        if (location) searchCriteria.location = { $regex: location, $options: 'i' };

        const users = await User.find(searchCriteria)
          .select(`${SENSITIVE_FIELDS} -email`)
          .sort({ createdAt: -1 })
          .exec();

        return json(users);
      }),
    },
  },
});
