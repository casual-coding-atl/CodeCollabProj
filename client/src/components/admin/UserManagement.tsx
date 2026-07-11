import React, { useState, ChangeEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as UnblockIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
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

const UserRow: React.FC<UserRowProps> = ({
  user,
  onEdit,
  onView,
  onSuspend,
  onUnsuspend,
  onDelete,
}) => {
  const getRoleColor = (role: UserRole): 'error' | 'warning' | 'primary' => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'moderator':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const getStatusColor = (user: AdminUser): 'error' | 'default' | 'success' => {
    if (user.isSuspended) return 'error';
    if (!user.isActive) return 'default';
    return 'success';
  };

  const getStatusLabel = (user: AdminUser): string => {
    if (user.isSuspended) return 'Suspended';
    if (!user.isActive) return 'Inactive';
    return 'Active';
  };

  return (
    <TableRow hover>
      <TableCell>
        <Box>
          <Typography variant="body2" fontWeight="bold">
            {user.username}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {user.email}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          label={user.role}
          color={getRoleColor(user.role)}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      </TableCell>
      <TableCell>
        <Chip label={getStatusLabel(user)} color={getStatusColor(user)} size="small" />
      </TableCell>
      <TableCell>
        <Typography variant="body2">{new Date(user.createdAt).toLocaleDateString()}</Typography>
      </TableCell>
      <TableCell>
        <Box display="flex" gap={1}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => onView(user)}>
              <ViewIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Edit Role">
            <IconButton size="small" onClick={() => onEdit(user)}>
              <EditIcon />
            </IconButton>
          </Tooltip>

          {user.isSuspended ? (
            <Tooltip title="Unsuspend">
              <IconButton size="small" color="success" onClick={() => onUnsuspend(user._id)}>
                <UnblockIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Suspend">
              <IconButton size="small" color="warning" onClick={() => onSuspend(user)}>
                <BlockIcon />
              </IconButton>
            </Tooltip>
          )}

          {user.role !== 'admin' && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => onDelete(user)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User Role</DialogTitle>
      <DialogContent>
        <Box py={2}>
          <Typography variant="body2" gutterBottom>
            User:{' '}
            <strong>
              {user?.username} ({user?.email})
            </strong>
          </Typography>

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(e: SelectChangeEvent) => setRole(e.target.value as UserRole)}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="moderator">Moderator</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Suspend User</DialogTitle>
      <DialogContent>
        <Box py={2}>
          <Typography variant="body2" gutterBottom>
            User:{' '}
            <strong>
              {user?.username} ({user?.email})
            </strong>
          </Typography>

          <TextField
            label="Suspension Reason"
            fullWidth
            multiline
            rows={3}
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            sx={{ mt: 2 }}
            required
          />

          <TextField
            label="Duration (days)"
            type="number"
            fullWidth
            value={duration}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)}
            sx={{ mt: 2 }}
            helperText="Leave empty for indefinite suspension"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="warning"
          disabled={loading || !reason.trim()}
        >
          {loading ? <CircularProgress size={20} /> : 'Suspend User'}
        </Button>
      </DialogActions>
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
  const [statusFilter, setStatusFilter] = useState('');

  const [editDialog, setEditDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });

  const params: AdminUserQueryParams = {
    page: page + 1,
    limit: rowsPerPage,
    ...(search && { search }),
    ...(roleFilter !== 'all' && { role: roleFilter as UserRole }),
    ...(statusFilter && { status: statusFilter }),
  };

  const { data, isLoading, error } = useAdminUsers(params);
  const { updateUserRole, suspendUser, unsuspendUser, deleteUser } = useAdminUserMutations();

  const typedData = data as unknown as AdminUsersResponse | undefined;

  const handleChangePage = (_event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

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

  const handleDelete = async (user: AdminUser): Promise<void> => {
    if (window.confirm(`Are you sure you want to deactivate ${user.username}?`)) {
      await deleteUser.mutateAsync({ userId: user._id, permanent: false });
    }
  };

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load users: {(error as Error)?.message || 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        User Management
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Search users"
            variant="outlined"
            size="small"
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e: SelectChangeEvent) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="moderator">Moderator</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress />
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
        </TableContainer>

        {typedData && (
          <TablePagination
            component="div"
            count={typedData.total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </Paper>

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
    </Box>
  );
};

export default UserManagement;
