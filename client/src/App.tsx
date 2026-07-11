import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Typography, Button, Box } from '@mui/material';
import queryClient from './config/queryClient';
import ErrorBoundary from './components/common/ErrorBoundary';
import logger from './utils/logger';
import Layout from './components/layout/Layout';
import PrivateRoute from './components/routing/PrivateRoute';
import AdminRoute from './components/routing/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import NotFound from './pages/NotFound';
import Home from './pages/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import ProjectList from './pages/ProjectList';
// ProjectForm handles both creation and editing
import ProjectForm from './components/projects/ProjectForm';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
// MemberSearch available but not currently routed
import Members from './pages/Members';
import Messages from './pages/Messages';
import ProjectDetail from './pages/ProjectDetail';
import EmailVerification from './pages/EmailVerification';

// React Query DevTools - lazy loaded and conditionally rendered in development only
// Temporarily disabled to avoid chunk loading issues
// const ReactQueryDevtools = React.lazy(() =>
//   import('@tanstack/react-query-devtools').then((d) => ({
//     default: d.ReactQueryDevtools,
//   }))
// );

function About(): React.ReactElement {
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom>
          About Page
        </Typography>
        <Button variant="contained" component={Link} to="/">
          Go to Home
        </Button>
      </Box>
    </Container>
  );
}

function App(): React.ReactElement {
  // Memoize theme to prevent unnecessary re-renders
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          primary: { main: '#1976d2' },
          secondary: { main: '#dc004e' },
        },
        // Add performance optimizations
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              // Optimize CSS rendering
              '*': {
                boxSizing: 'border-box',
              },
              html: {
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
              },
            },
          },
        },
      }),
    []
  );

  // TanStack Query will automatically handle authentication checks
  // when components mount and use the useAuth hook
  useEffect(() => {
    // Only log in development
    if (import.meta.env.DEV) {
      const token = localStorage.getItem('token');
      logger.debug('🔐 App startup - Token exists:', !!token);
      logger.debug('🔐 QueryClient initialized:', !!queryClient);

      if (token) {
        logger.debug('✅ Token found - TanStack Query will handle auth state');
      } else {
        logger.debug('❌ No token found - user not authenticated');
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              {/* Admin Routes - Outside Layout to avoid duplicate navigation */}
              <Route
                path="/admin/*"
                element={
                  <AdminRoute requireRole={['admin']}>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="logs" element={<div>System Logs (Coming Soon)</div>} />
                <Route path="analytics" element={<div>Analytics (Coming Soon)</div>} />
                <Route path="settings" element={<div>Settings (Coming Soon)</div>} />
              </Route>

              {/* Main App Routes - Inside Layout */}
              <Route
                path="/*"
                element={
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/verify-email/:token" element={<EmailVerification />} />
                      <Route path="/verify-email" element={<EmailVerification />} />
                      <Route path="/projects" element={<ProjectList />} />
                      <Route
                        path="/projects/create"
                        element={
                          <PrivateRoute>
                            <ProjectForm />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <PrivateRoute>
                            <Dashboard />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <PrivateRoute>
                            <Profile />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/members"
                        element={
                          <PrivateRoute>
                            <Members />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/messages"
                        element={
                          <PrivateRoute>
                            <Messages />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/projects/:projectId"
                        element={
                          <PrivateRoute>
                            <ProjectDetail />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/projects/:projectId/edit"
                        element={
                          <PrivateRoute>
                            <ProjectForm />
                          </PrivateRoute>
                        }
                      />
                      <Route path="/about" element={<About />} />
                      {/* Catch-all: render NotFound for unknown URLs instead of a blank page */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                }
              />
            </Routes>
          </Router>
        </ThemeProvider>
        {/* React Query DevTools - temporarily disabled to avoid chunk loading issues */}
        {/* {import.meta.env.DEV && (
          <React.Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </React.Suspense>
        )} */}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
