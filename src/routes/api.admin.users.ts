import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireRole, query } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * Sensitive fields that must NEVER be returned in API responses. Matches
 * adminController.SENSITIVE_FIELDS exactly.
 */
const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

/**
 * GET /api/admin/users
 * Replicates adminController.getAllUsers: search ($or over username/email/
 * firstName/lastName), role filter, status switch (active/suspended/inactive),
 * pagination, and the `{ users, pagination }` response shape.
 */
export const Route = createFileRoute('/api/admin/users')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        await requireRole(request, ['admin']);
        await connectDB();

        const q = query(request);
        const page = parseInt(q.get('page') || '', 10) || 1;
        const limit = parseInt(q.get('limit') || '', 10) || 20;
        const skip = (page - 1) * limit;
        const search = q.get('search');
        const role = q.get('role');
        const status = q.get('status');

        // Build filter query
        const filter: Record<string, unknown> = {};

        if (search) {
          filter.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
          ];
        }

        if (role && role !== 'all') {
          filter.role = role;
        }

        if (status) {
          switch (status) {
            case 'active':
              filter.isActive = true;
              filter.isSuspended = false;
              break;
            case 'suspended':
              filter.isSuspended = true;
              break;
            case 'inactive':
              filter.isActive = false;
              break;
          }
        }

        const users = await User.find(filter)
          .select(SENSITIVE_FIELDS)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);

        const total = await User.countDocuments(filter);

        return json({
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      }),
    },
  },
});
