import React, { memo, FC, ReactNode } from 'react';
import { Box } from '@mui/material';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

const Layout: FC<LayoutProps> = memo(({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <Header />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 3,
          px: 2,
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        {children}
      </Box>
      <Footer />
    </Box>
  );
});

Layout.displayName = 'Layout';

export default Layout;
