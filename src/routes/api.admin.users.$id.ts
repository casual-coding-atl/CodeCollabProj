import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireRole, query } from '../server/http';
import { connectDB } from '../server/db';
import { User, Session } from '../server/models';

/**
 * DELETE /api/admin/users/$id
 * Replicates adminController.deleteUser: blocks self-delete and deleting admins;
 * `?permanent=true` hard-deletes the user + all sessions, otherwise soft-deletes
 * (isActive:false) and revokes active sessions.
 */
export const Route = createFileRoute('/api/admin/users/$id')({
  server: {
    handlers: {
      DELETE: handler(async ({ request, params }) => {
        const authUser = await requireRole(request, ['admin']);
        await connectDB();

        const userId = params.id;
        const permanent = query(request).get('permanent');

        const user = await User.findById(userId);
        if (!user) {
          return error(404, 'User not found');
        }

        // Prevent self-deletion.
        if (user._id.toString() === authUser._id.toString()) {
          return error(400, 'Cannot delete your own account');
        }

        // Prevent deleting other admins.
        if (user.get('role') === 'admin') {
          return error(403, 'Cannot delete administrator accounts');
        }

        if (permanent === 'true') {
          // Permanent deletion.
          await User.findByIdAndDelete(userId);
          await Session.deleteMany({ userId });

          return json({ message: 'User permanently deleted' });
        }

        // Soft delete (deactivate) + revoke all active sessions.
        user.set('isActive', false);
        await user.save();

        await Session.updateMany(
          { userId, isActive: true },
          {
            isActive: false,
            revokedAt: new Date(),
            revokedReason: 'account_deactivated',
          }
        );

        return json({ message: 'User account deactivated' });
      }),
    },
  },
});
