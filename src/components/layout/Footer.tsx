import React, { FC } from 'react';
import { Box, Typography, Container } from '@mui/material';

const Footer: FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) => theme.palette.grey[200],
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
            }}
          >
            <img
              src="/CC-Logo-ColorBg.png"
              alt="Casual Coding Meetup Group Logo"
              style={{
                height: '32px',
                width: 'auto',
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="subtitle1"
                color="text.primary"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  fontSize: '1rem',
                }}
              >
                CodeCollabProj
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: '0.65rem',
                  lineHeight: 1,
                }}
              >
                Casual Coding Meetup Group
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} CodeCollabProj. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
