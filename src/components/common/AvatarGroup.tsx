import { type FC } from 'react';
import Avatar from './Avatar';
import { cn } from '@/lib/utils';

interface Member {
  _id?: string;
  username?: string;
  profileImage?: string;
}

interface AvatarGroupProps {
  members: Member[];
  max?: number;
  className?: string;
}

/** Overlapping avatars with a "+N" overflow chip. Presentational. */
export const AvatarGroup: FC<AvatarGroupProps> = ({ members, max = 5, className }) => {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {shown.map((m, i) => (
        <div key={m._id ?? i} className="rounded-full ring-2 ring-background" title={m.username}>
          <Avatar user={m} size="sm" />
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex size-8 items-center justify-center rounded-full bg-muted ring-2 ring-background">
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
};

export default AvatarGroup;
