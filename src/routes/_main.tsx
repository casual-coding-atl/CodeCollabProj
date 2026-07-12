import { createFileRoute, Outlet } from '@tanstack/react-router';
import Layout from '../components/layout/Layout';

export const Route = createFileRoute('/_main')({ component: MainLayout });

function MainLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
