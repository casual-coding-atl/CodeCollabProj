import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireRole } from '../server/http';
import { connectDB } from '../server/db';
import { User, Project, Comment, Session } from '../server/models';

/**
 * GET /api/admin/dashboard
 * Replicates adminController.getDashboardStats: parallel aggregations for user +
 * project counts, comment count, and active session count. On failure it returns
 * a 200 with zeroed fallback data plus an `error` field (matching the controller,
 * which never fails the request outright).
 */
export const Route = createFileRoute('/api/admin/dashboard')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        await requireRole(request, ['admin']);
        await connectDB();

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        try {
          const [userStats, projectStats, commentCount, sessionCount] = await Promise.all([
            User.aggregate([
              {
                $facet: {
                  total: [{ $count: 'count' }],
                  active: [{ $match: { isActive: true } }, { $count: 'count' }],
                  suspended: [{ $match: { isSuspended: true } }, { $count: 'count' }],
                  admins: [{ $match: { role: 'admin' } }, { $count: 'count' }],
                  moderators: [{ $match: { role: 'moderator' } }, { $count: 'count' }],
                  newThisWeek: [
                    { $match: { createdAt: { $gte: sevenDaysAgo } } },
                    { $count: 'count' },
                  ],
                },
              },
            ]),

            Project.aggregate([
              {
                $facet: {
                  total: [{ $count: 'count' }],
                  // "Active" = projects not yet completed. Mirrors the controller's
                  // exact match on the legacy status enum (ideation/in_progress).
                  active: [
                    { $match: { status: { $in: ['ideation', 'in_progress'] } } },
                    { $count: 'count' },
                  ],
                  newThisWeek: [
                    { $match: { createdAt: { $gte: sevenDaysAgo } } },
                    { $count: 'count' },
                  ],
                },
              },
            ]).catch(() => [
              { total: [{ count: 0 }], active: [{ count: 0 }], newThisWeek: [{ count: 0 }] },
            ]),

            Comment.countDocuments().catch(() => 0),

            Session.countDocuments({ isActive: true }).catch(() => 0),
          ]);

          const users = (userStats[0] as Record<string, Array<{ count: number }>>) || {};
          const projects = (projectStats[0] as Record<string, Array<{ count: number }>>) || {};

          const getUserCount = (field: string) => users[field]?.[0]?.count || 0;
          const getProjectCount = (field: string) => projects[field]?.[0]?.count || 0;

          return json({
            users: {
              total: getUserCount('total'),
              active: getUserCount('active'),
              suspended: getUserCount('suspended'),
              admins: getUserCount('admins'),
              moderators: getUserCount('moderators'),
              newThisWeek: getUserCount('newThisWeek'),
            },
            content: {
              projects: {
                total: getProjectCount('total'),
                active: getProjectCount('active'),
                newThisWeek: getProjectCount('newThisWeek'),
              },
              comments: {
                total: commentCount || 0,
              },
            },
            system: {
              activeSessions: sessionCount || 0,
            },
          });
        } catch {
          // Return fallback data instead of failing completely (matches controller).
          return json({
            users: {
              total: 0,
              active: 0,
              suspended: 0,
              admins: 0,
              moderators: 0,
              newThisWeek: 0,
            },
            content: {
              projects: {
                total: 0,
                active: 0,
                newThisWeek: 0,
              },
              comments: {
                total: 0,
              },
            },
            system: {
              activeSessions: 0,
            },
            error: 'Some statistics may be unavailable',
          });
        }
      }),
    },
  },
});
