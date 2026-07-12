import { createFileRoute, Outlet } from '@tanstack/react-router';
import AdminRoute from '../components/routing/AdminRoute';
import AdminLayout from '../components/admin/AdminLayout';

export const Route = createFileRoute('/admin')({ component: AdminRouteLayout });

function AdminRouteLayout() {
  return (
    <AdminRoute requireRole={['admin']}>
      <AdminLayout />
    </AdminRoute>
  );
}
