import { FC } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableRow, TableCell } from '@/components/ui/table';

// Skeleton for project cards
export const ProjectCardSkeleton: FC = () => (
  <Card>
    <CardContent>
      <div className="mb-4 flex items-start justify-between">
        <Skeleton className="h-8 w-3/5" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-4 h-4 w-4/5" />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-6 w-[60px] rounded-md" />
        <Skeleton className="h-6 w-[70px] rounded-md" />
        <Skeleton className="h-6 w-[50px] rounded-md" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-20" />
      </div>
    </CardContent>
    <CardFooter className="gap-2">
      <Skeleton className="h-[30px] w-[90px] rounded-md" />
      <Skeleton className="h-[30px] w-[50px] rounded-md" />
    </CardFooter>
  </Card>
);

// Skeleton for stat cards on dashboard
export const StatCardSkeleton: FC = () => (
  <Card>
    <CardContent>
      <Skeleton className="mb-2 h-5 w-[70%]" />
      <Skeleton className="h-10 w-2/5" />
    </CardContent>
  </Card>
);

// Skeleton for member table rows
export const MemberRowSkeleton: FC = () => (
  <TableRow>
    <TableCell>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-[150px]" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-20" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-[100px]" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-[120px]" />
    </TableCell>
    <TableCell className="text-center">
      <Skeleton className="mx-auto h-[30px] w-20 rounded-md" />
    </TableCell>
  </TableRow>
);

interface ProjectListSkeletonProps {
  count?: number;
}

// Grid of project card skeletons
export const ProjectListSkeleton: FC<ProjectListSkeletonProps> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
    {Array.from({ length: count }).map((_, index) => (
      <ProjectCardSkeleton key={index} />
    ))}
  </div>
);

// Dashboard skeleton
export const DashboardSkeleton: FC = () => (
  <div>
    {/* Welcome section */}
    <div className="mb-8">
      <Skeleton className="h-10 w-[300px]" />
      <Skeleton className="mt-2 h-6 w-[400px]" />
    </div>

    {/* Stats cards */}
    <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>

    {/* Projects header */}
    <div className="mb-6 flex items-center justify-between">
      <Skeleton className="h-8 w-[150px]" />
      <Skeleton className="h-9 w-40 rounded-md" />
    </div>

    {/* Project cards */}
    <ProjectListSkeleton count={3} />
  </div>
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
