import React, { FC } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Skeleton,
  Grid,
  TableRow,
  TableCell,
} from '@mui/material';

// Skeleton for project cards
export const ProjectCardSkeleton: FC = () => (
  <Card>
    <CardContent>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}
      >
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rounded" width={80} height={24} />
      </Box>
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={70} height={24} />
        <Skeleton variant="rounded" width={50} height={24} />
      </Box>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="text" width={40} />
        <Skeleton variant="text" width={80} />
      </Box>
    </CardContent>
    <CardActions>
      <Skeleton variant="rounded" width={90} height={30} />
      <Skeleton variant="rounded" width={50} height={30} />
    </CardActions>
  </Card>
);

// Skeleton for stat cards on dashboard
export const StatCardSkeleton: FC = () => (
  <Card>
    <CardContent>
      <Skeleton variant="text" width="70%" height={20} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="40%" height={40} />
    </CardContent>
  </Card>
);

// Skeleton for member table rows
export const MemberRowSkeleton: FC = () => (
  <TableRow>
    <TableCell>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="text" width={100} />
      </Box>
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={150} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={80} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={100} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={120} />
    </TableCell>
    <TableCell align="center">
      <Skeleton variant="rounded" width={80} height={30} sx={{ mx: 'auto' }} />
    </TableCell>
  </TableRow>
);

interface ProjectListSkeletonProps {
  count?: number;
}

// Grid of project card skeletons
export const ProjectListSkeleton: FC<ProjectListSkeletonProps> = ({ count = 6 }) => (
  <Grid container spacing={3}>
    {Array.from({ length: count }).map((_, index) => (
      <Grid item xs={12} sm={6} md={4} key={index}>
        <ProjectCardSkeleton />
      </Grid>
    ))}
  </Grid>
);

// Dashboard skeleton
export const DashboardSkeleton: FC = () => (
  <Box>
    {/* Welcome section */}
    <Box sx={{ mb: 4 }}>
      <Skeleton variant="text" width={300} height={40} />
      <Skeleton variant="text" width={400} height={24} />
    </Box>

    {/* Stats cards */}
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {[1, 2, 3].map((i) => (
        <Grid item xs={12} sm={4} key={i}>
          <StatCardSkeleton />
        </Grid>
      ))}
    </Grid>

    {/* Projects header */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
      <Skeleton variant="text" width={150} height={32} />
      <Skeleton variant="rounded" width={160} height={36} />
    </Box>

    {/* Project cards */}
    <ProjectListSkeleton count={3} />
  </Box>
);

interface MembersTableSkeletonProps {
  count?: number;
}

// Members table skeleton
export const MembersTableSkeleton: FC<MembersTableSkeletonProps> = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <MemberRowSkeleton key={index} />
    ))}
  </>
);
