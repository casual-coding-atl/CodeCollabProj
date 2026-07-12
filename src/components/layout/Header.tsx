import React, { FC, useState, MouseEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
} from '@mui/material';
import { Menu as MenuIcon, Message as MessageIcon } from '@mui/icons-material';
import { useAuth, useLogout } from '../../hooks/auth';
import { useMessages } from '../../hooks/users/useMessaging';
import { useMyProfile } from '../../hooks/users';
import Avatar from '../common/Avatar';
import logger from '../../utils/logger';

const Header: FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const logoutMutation = useLogout();

  // Get user profile for avatar (only fetch if authenticated)
  const { data: profile } = useMyProfile({
    enabled: isAuthenticated,
  });

  // Get unread message count
  const { data: inboxMessages = [] } = useMessages('inbox', {
    enabled: isAuthenticated, // Only fetch if authenticated
  });
  const unreadCount = inboxMessages.filter((msg) => !msg.isRead).length;

  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Header isAuthenticated (TanStack Query):', isAuthenticated, 'user:', user);
  }
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleMenu = (event: MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate('/login');
        handleClose();
      },
    });
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="Open navigation menu"
          aria-expanded="false"
          aria-controls="mobile-menu"
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Box
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <img
            src="/CC-Logo-ColorBg.png"
            alt="Casual Coding Meetup Group Logo"
            style={{
              height: '40px',
              width: 'auto',
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              CodeCollabProj
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.7rem',
                lineHeight: 1,
                opacity: 0.9,
              }}
            >
              Casual Coding Meetup Group
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isAuthenticated ? (
            <>
              <Button color="inherit" component={RouterLink} to="/projects">
                Projects
              </Button>
              <Button color="inherit" component={RouterLink} to="/members">
                Members
              </Button>
              <IconButton
                color="inherit"
                component={RouterLink}
                to="/messages"
                aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                title={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              >
                <Badge badgeContent={unreadCount} color="error" aria-hidden="true">
                  <MessageIcon />
                </Badge>
              </IconButton>
              <Button color="inherit" component={RouterLink} to="/dashboard">
                Dashboard
              </Button>
              {/* Admin Panel Link - only show for admins and moderators */}
              {(user?.role === 'admin' || user?.role === 'moderator') && (
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/admin"
                  sx={{
                    bgcolor: 'error.main',
                    '&:hover': { bgcolor: 'error.dark' },
                    borderRadius: 1,
                    px: 2,
                  }}
                >
                  Admin
                </Button>
              )}
              <Tooltip title={profile?.username || user?.username || 'Account'}>
                <IconButton
                  size="large"
                  aria-label={`Account menu for ${user?.username || 'user'}`}
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  aria-expanded={Boolean(anchorEl)}
                  onClick={handleMenu}
                  color="inherit"
                  sx={{ p: 0.5 }}
                >
                  <Avatar user={profile || user} size="sm" />
                </IconButton>
              </Tooltip>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                aria-labelledby="account-menu-button"
              >
                <MenuItem component={RouterLink} to="/profile" onClick={handleClose}>
                  Profile
                </MenuItem>
                <MenuItem onClick={handleLogout} data-testid="logout-button">Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/projects">
                Projects
              </Button>
              <Button color="inherit" component={RouterLink} to="/login">
                Login
              </Button>
              <Button color="inherit" component={RouterLink} to="/register">
                Register
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
