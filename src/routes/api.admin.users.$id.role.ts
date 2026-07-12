import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireRole } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * Default permissions per role — mirrors User model's getDefaultPermissionsForRole.
 * Used to replicate setRole() (assigns role + resets permissions to the role default).
 */
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  user: ['projects.read', 'projects.create', 'comments.read', 'comments.create'],
  moderator: [
    'projects.read',
    'projects.create',
    'projects.moderate',
    'comments.read',
    'comments.create',
    'comments.moderate',
    'moderate.content',
    'users.read',
  ],
  admin: [
    'users.read',
    'users.create',
    'users.update',
    'users.delete',
    'projects.read',
    'projects.create',
    'projects.update',
    'projects.delete',
    'projects.moderate',
    'comments.read',
    'comments.create',
    'comments.update',
    'comments.delete',
    'comments.moderate',
    'admin.dashboard',
    'admin.users',
    'admin.analytics',
    'admin.system',
    'moderate.content',
    'moderate.users',
    'moderate.reports',
  ],
};

const VALID_ROLES = ['user', 'moderator', 'admin'];

/**
 * PUT /api/admin/users/$id/role
 * Replicates adminController.updateUserRole: validates role/permissions/
 * customPermissions, blocks self-demotion, applies role (with default permission
 * reset), and returns the trimmed user shape.
 */
export const Route = createFileRoute('/api/admin/users/$id/role')({
  server: {
    handlers: {
      PUT: handler(async ({ request, params }) => {
        const authUser = await requireRole(request, ['admin']);
        await connectDB();

        const userId = params.id;
        const body = (await request.json().catch(() => ({}))) as {
          role?: string;
          permissions?: string[];
          customPermissions?: string[];
        };
        const { role, permissions, customPermissions } = body;

        // Validation (mirrors express-validator rules on the legacy route).
        const errors: Array<{ msg: string; param: string }> = [];
        if (role !== undefined && !VALID_ROLES.includes(role)) {
          errors.push({ msg: 'Invalid role', param: 'role' });
        }
        if (permissions !== undefined && !Array.isArray(permissions)) {
          errors.push({ msg: 'Permissions must be an array', param: 'permissions' });
        }
        if (customPermissions !== undefined && !Array.isArray(customPermissions)) {
          errors.push({ msg: 'Custom permissions must be an array', param: 'customPermissions' });
        }
        if (errors.length > 0) {
          return json({ errors }, 400);
        }

        const user = await User.findById(userId);
        if (!user) {
          return error(404, 'User not found');
        }

        // Prevent self-demotion, but only when a role change is actually requested.
        if (
          user._id.toString() === authUser._id.toString() &&
          role &&
          role !== 'admin'
        ) {
          return error(400, 'Cannot change your own admin role');
        }

        // Update role if provided (setRole: sets role + default permissions).
        if (role) {
          user.set('role', role);
          user.set('permissions', DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user);
        }

        // Update permissions if provided.
        if (permissions && Array.isArray(permissions)) {
          user.set('permissions', permissions);
        } else if (customPermissions && Array.isArray(customPermissions)) {
          const current: string[] = (user.get('permissions') as string[]) || [];
          for (const permission of customPermissions) {
            if (!current.includes(permission)) current.push(permission);
          }
          user.set('permissions', current);
        }

        await user.save();

        return json({
          message: 'User role updated successfully',
          user: {
            id: user._id,
            email: user.get('email'),
            username: user.get('username'),
            role: user.get('role'),
            permissions: user.get('permissions'),
          },
        });
      }),
    },
  },
});
