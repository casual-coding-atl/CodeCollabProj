import React, { useState, ChangeEvent } from 'react';
import { Eye, Pencil, Ban, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAdminUsers, useAdminUserMutations } from '../../hooks/admin';
import type { AdminUserQueryParams } from '../../services/adminService';
import type { UserRole } from '../../types';

interface AdminUser {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
}

interface UserRowProps {
  user: AdminUser;
  onEdit: (user: AdminUser) => void;
  onView: (user: AdminUser) => void;
  onSuspend: (user: AdminUser) => void;
  onUnsuspend: (userId: string) => void;
  onDelete: (user: AdminUser) => void;
}

const roleBadgeClass = (role: UserRole): string => {
  switch (role) {
    case 'admin':
      return 'bg-destructive text-white hover:bg-destructive/90';
    case 'moderator':
      return 'bg-brand-amber text-brand-amber-foreground hover:bg-brand-amber/90';
    default:
      return 'bg-primary text-primary-foreground hover:bg-primary/90';
  }
};

const UserRow: React.FC<UserRowProps> = ({
  user,
  onEdit,
  onView,
  onSuspend,
  onUnsuspend,
  onDelete,
}) => {
  const statusBadge = (user: AdminUser): React.ReactNode => {
    if (user.isSuspended) {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    if (!user.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return (
      <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">Active</Badge>
    );
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{user.username}</span>
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn('capitalize', roleBadgeClass(user.role))}>{user.role}</Badge>
      </TableCell>
      <TableCell>{statusBadge(user)}</TableCell>
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      </TableCell>
      <TableCell>
        <TooltipProvider>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="View Details"
                onClick={() => onView(user)}
              >
                <Eye className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View Details</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit Role"
                onClick={() => onEdit(user)}
              >
                <Pencil className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Role</TooltipContent>
          </Tooltip>

          {user.isSuspended ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Unsuspend"
                  className="text-primary hover:text-primary"
                  onClick={() => onUnsuspend(user._id)}
                >
                  <CheckCircle2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Unsuspend</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Suspend"
                  className="text-brand-amber hover:text-brand-amber"
                  onClick={() => onSuspend(user)}
                >
                  <Ban className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Suspend</TooltipContent>
            </Tooltip>
          )}

          {user.role !== 'admin' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(user)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          )}
        </div>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
};

interface EditRoleDialogProps {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSave: (userId: string, data: { role: UserRole }) => Promise<void>;
}

const EditRoleDialog: React.FC<EditRoleDialogProps> = ({ open, user, onClose, onSave }) => {
  const [role, setRole] = useState<UserRole>(user?.role || 'user');
  const [loading, setLoading] = useState(false);

  const handleSave = async (): Promise<void> => {
    if (!user) return;
    setLoading(true);
    try {
      await onSave(user._id, { role });
      onClose();
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Role</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm">
            User:{' '}
            <strong>
              {user?.username} ({user?.email})
            </strong>
          </p>

          <div className="mt-4 space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="edit-role" className="w-full">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface SuspendDialogProps {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSave: (userId: string, data: { reason: string; duration?: number }) => Promise<void>;
}

const SuspendDialog: React.FC<SuspendDialogProps> = ({ open, user, onClose, onSave }) => {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async (): Promise<void> => {
    if (!reason.trim() || !user) return;

    setLoading(true);
    try {
      const suspensionData: { reason: string; duration?: number } = { reason };
      if (duration) {
        suspensionData.duration = parseInt(duration) * 24 * 60 * 60 * 1000; // Convert days to ms
      }
      await onSave(user._id, suspensionData);
      onClose();
      setReason('');
      setDuration('');
    } catch (error) {
      console.error('Failed to suspend user:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suspend User</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm">
            User:{' '}
            <strong>
              {user?.username} ({user?.email})
            </strong>
          </p>

          <div className="mt-4 space-y-2">
            <Label htmlFor="suspend-reason">Suspension Reason</Label>
            <Textarea
              id="suspend-reason"
              rows={3}
              value={reason}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="suspend-duration">Duration (days)</Label>
            <Input
              id="suspend-duration"
              type="number"
              value={duration}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for indefinite suspension
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !reason.trim()}
            className="bg-brand-amber text-brand-amber-foreground hover:bg-brand-amber/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Suspend User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface DeleteDialogProps {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (user: AdminUser) => Promise<void>;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ open, user, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    if (!user) return;
    setLoading(true);
    try {
      await onConfirm(user);
      onClose();
    } catch (error) {
      console.error('Failed to deactivate user:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate User</DialogTitle>
        </DialogHeader>
        <p className="py-2 text-sm text-muted-foreground">
          Are you sure you want to deactivate <strong>{user?.username}</strong>?
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Response type for paginated users with AdminUser format
interface AdminUsersResponse {
  users?: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const UserManagement: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [editDialog, setEditDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });

  const params: AdminUserQueryParams = {
    page: page + 1,
    limit: rowsPerPage,
    ...(search && { search }),
    ...(roleFilter !== 'all' && { role: roleFilter as UserRole }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
  };

  const { data, isLoading, error } = useAdminUsers(params);
  const { updateUserRole, suspendUser, unsuspendUser, deleteUser } = useAdminUserMutations();

  const typedData = data as unknown as AdminUsersResponse | undefined;

  const totalPages = typedData ? Math.max(1, Math.ceil(typedData.total / rowsPerPage)) : 1;

  const handleEditRole = (user: AdminUser): void => {
    setEditDialog({ open: true, user });
  };

  const handleSuspendUser = (user: AdminUser): void => {
    setSuspendDialog({ open: true, user });
  };

  const handleUpdateRole = async (userId: string, roleData: { role: UserRole }): Promise<void> => {
    await updateUserRole.mutateAsync({ userId, roleData });
  };

  const handleSuspend = async (
    userId: string,
    suspensionData: { reason: string; duration?: number }
  ): Promise<void> => {
    await suspendUser.mutateAsync({ userId, suspensionData });
  };

  const handleUnsuspend = async (userId: string): Promise<void> => {
    await unsuspendUser.mutateAsync(userId);
  };

  const handleDelete = (user: AdminUser): void => {
    setDeleteDialog({ open: true, user });
  };

  const handleConfirmDelete = async (user: AdminUser): Promise<void> => {
    await deleteUser.mutateAsync({ userId: user._id, permanent: false });
  };

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load users: {(error as Error)?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">User Management</h1>

      {/* Filters */}
      <Card className="mb-6 py-4">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] space-y-2">
            <Label htmlFor="user-search">Search users</Label>
            <Input
              id="user-search"
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </div>

          <div className="min-w-[120px] space-y-2">
            <Label htmlFor="role-filter">Role</Label>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
              <SelectTrigger id="role-filter" className="w-full">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[120px] space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger id="status-filter" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : (
              typedData?.users?.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  onEdit={handleEditRole}
                  onView={(user) => console.log('View user:', user)} // TODO: Implement user details view
                  onSuspend={handleSuspendUser}
                  onUnsuspend={handleUnsuspend}
                  onDelete={handleDelete}
                />
              ))
            )}
          </TableBody>
        </Table>

        {typedData && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">Rows per page</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(value) => {
                  setRowsPerPage(parseInt(value, 10));
                  setPage(0);
                }}
              >
                <SelectTrigger size="sm" className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · {typedData.total} total
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 0}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <EditRoleDialog
        key={editDialog.user?._id}
        open={editDialog.open}
        user={editDialog.user}
        // Keep the user set on close so the key stays stable and the dialog plays its
        // exit animation; it's replaced when a different user's dialog is opened.
        onClose={() => setEditDialog((prev) => ({ ...prev, open: false }))}
        onSave={handleUpdateRole}
      />

      <SuspendDialog
        open={suspendDialog.open}
        user={suspendDialog.user}
        onClose={() => setSuspendDialog({ open: false, user: null })}
        onSave={handleSuspend}
      />

      <DeleteDialog
        open={deleteDialog.open}
        user={deleteDialog.user}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default UserManagement;
