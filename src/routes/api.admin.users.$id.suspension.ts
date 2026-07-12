import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireRole } from '../server/http';
import { connectDB } from '../server/db';
import { User, Session } from '../server/models';

/**
 * PUT /api/admin/users/$id/suspension
 * Replicates adminController.toggleUserSuspension: validates the payload, blocks
 * self-suspension and suspending other admins, applies suspend/unsuspend, revokes
 * the target's active sessions on suspend, and returns the suspension summary.
 */
export const Route = createFileRoute('/api/admin/users/$id/suspension')({
  server: {
    handlers: {
      PUT: handler(async ({ request, params }) => {
        const authUser = await requireRole(request, ['admin']);
        await connectDB();

        const userId = params.id;
        const body = (await request.json().catch(() => ({}))) as {
          suspend?: unknown;
          reason?: string;
          duration?: number;
        };
        const { suspend, reason, duration } = body;

        // Validation (mirrors express-validator rules on the legacy route).
        const errors: Array<{ msg: string; param: string }> = [];
        if (typeof suspend !== 'boolean') {
          errors.push({ msg: 'Suspend field must be boolean', param: 'suspend' });
        }
        if (suspend === true) {
          if (!reason) {
            errors.push({ msg: 'Reason is required when suspending a user', param: 'reason' });
          } else if (reason.length > 500) {
            errors.push({ msg: 'Reason must not exceed 500 characters', param: 'reason' });
          }
        }
        if (
          duration !== undefined &&
          (!Number.isInteger(duration) || (duration as number) < 1)
        ) {
          errors.push({
            msg: 'Duration must be a positive number (in milliseconds)',
            param: 'duration',
          });
        }
        if (errors.length > 0) {
          return json({ errors }, 400);
        }

        const user = await User.findById(userId);
        if (!user) {
          return error(404, 'User not found');
        }

        // Prevent self-suspension.
        if (user._id.toString() === authUser._id.toString()) {
          return error(400, 'Cannot suspend your own account');
        }

        // Prevent suspending other admins (unless you're a super admin).
        if (user.get('role') === 'admin' && String(authUser.get('role')) !== 'super_admin') {
          return error(403, 'Cannot suspend other administrators');
        }

        if (suspend) {
          // suspend(reason, duration)
          user.set('isSuspended', true);
          user.set('suspensionReason', reason);
          if (duration) {
            user.set('suspendedUntil', new Date(Date.now() + (duration as number)));
          }

          // Revoke all active user sessions.
          await Session.updateMany(
            { userId, isActive: true },
            {
              isActive: false,
              revokedAt: new Date(),
              revokedReason: 'admin_suspend',
            }
          );
        } else {
          // unsuspend()
          user.set('isSuspended', false);
          user.set('suspendedUntil', undefined);
          user.set('suspensionReason', undefined);
        }

        await user.save();

        return json({
          message: `User ${suspend ? 'suspended' : 'unsuspended'} successfully`,
          user: {
            id: user._id,
            email: user.get('email'),
            username: user.get('username'),
            isSuspended: user.get('isSuspended'),
            suspensionReason: user.get('suspensionReason'),
            suspendedUntil: user.get('suspendedUntil'),
          },
        });
      }),
    },
  },
});
