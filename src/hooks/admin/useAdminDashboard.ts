import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { adminService, DashboardStats } from '../../services/adminService';

/**
 * Hook for fetching admin dashboard statistics
 * @returns UseQueryResult containing dashboard stats data
 */
export const useAdminDashboard = (): UseQueryResult<DashboardStats, Error> => {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminService.getDashboardStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

export default useAdminDashboard;
