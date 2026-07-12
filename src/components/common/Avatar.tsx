import { FC, MouseEvent, CSSProperties } from 'react';
import {
  Avatar as UiAvatar,
  AvatarImage,
  AvatarFallback,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Type for user object (partial, for avatar purposes)
interface AvatarUser {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
}

// Size presets
type AvatarSizePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type AvatarSize = AvatarSizePreset | number;

interface AvatarProps {
  user?: AvatarUser | null;
  size?: AvatarSize;
  showOnlineStatus?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  className?: string;
  /** Inline style overrides (kept for backwards compatibility with callers). */
  sx?: CSSProperties;
}

// Generate a consistent color from a string (username/email)
const stringToColor = (string: string | undefined | null): string => {
  if (!string) return '#1976d2';

  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a hue between 0-360
  const hue = Math.abs(hash % 360);
  // Use consistent saturation and lightness for pleasant colors
  return `hsl(${hue}, 65%, 45%)`;
};

// Get initials from user object
const getInitials = (user: AvatarUser | undefined | null): string => {
  if (!user) return '?';

  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const username = user.username || '';

  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  if (firstName) {
    return firstName[0].toUpperCase();
  }

  if (username) {
    return username[0].toUpperCase();
  }

  return '?';
};

// Size presets map
const sizeMap: Record<AvatarSizePreset, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  xxl: 120,
};

const Avatar: FC<AvatarProps> = ({
  user,
  size = 'md',
  showOnlineStatus = false,
  onClick,
  className,
  sx,
}) => {
  const dimension = typeof size === 'number' ? size : sizeMap[size] || sizeMap.md;
  const fontSize = dimension * 0.4;

  const initials = getInitials(user);
  const bgColor = stringToColor(user?.username || user?.email || '');

  // Construct the full image URL
  const getImageUrl = (): string | null => {
    if (!user?.profileImage) return null;

    // If it's already a full URL, use it directly
    if (user.profileImage.startsWith('http')) {
      return user.profileImage;
    }

    // Get the API base URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

    // Check if profileImage is a GridFS ObjectId (24 hex characters)
    // or an old-style file path (starts with /uploads/)
    if (/^[0-9a-fA-F]{24}$/.test(user.profileImage)) {
      // GridFS: use the avatar endpoint
      return `${apiUrl}/users/avatar/${user.profileImage}`;
    }

    // Legacy: old file path format (e.g., /uploads/avatar-xxx.png)
    // Extract base URL by removing /api suffix if present
    let baseUrl = apiUrl;
    if (apiUrl.endsWith('/api')) {
      baseUrl = apiUrl.substring(0, apiUrl.length - 4);
    }
    return `${baseUrl}${user.profileImage}`;
  };

  const imageUrl = getImageUrl();

  return (
    <div
      className={cn('relative inline-flex', onClick && 'cursor-pointer', className)}
      style={sx}
      onClick={onClick}
    >
      <UiAvatar
        data-testid="avatar"
        style={{ width: dimension, height: dimension }}
        className={cn(onClick && 'transition-transform hover:scale-105 hover:shadow-md')}
      >
        {imageUrl && <AvatarImage src={imageUrl} alt={user?.username || 'User'} />}
        <AvatarFallback
          className="font-medium text-white"
          style={{ backgroundColor: bgColor, fontSize }}
        >
          {initials}
        </AvatarFallback>
      </UiAvatar>

      {showOnlineStatus && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-background bg-green-500"
          style={{ width: dimension * 0.25, height: dimension * 0.25 }}
        />
      )}
    </div>
  );
};

export default Avatar;
