import React from 'react';
import { Container, Typography, Box, Button, Grid, Card, CardContent } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 8 }}>
        <Typography variant="h2" component="h1" gutterBottom align="center">
          Welcome to CodeCollabProj
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom align="center" color="text.secondary">
          Collaborate on code projects with ease. Share, learn, and build together.
        </Typography>
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/projects"
            sx={{ mr: 2 }}
          >
            Browse Projects
          </Button>
          <Button variant="outlined" size="large" component={RouterLink} to="/register">
            Get Started
          </Button>
        </Box>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h3" gutterBottom>
                Collaborate
              </Typography>
              <Typography variant="body1">
                Work together with other developers on shared projects. Real-time collaboration made
                easy.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h3" gutterBottom>
                Learn
              </Typography>
              <Typography variant="body1">
                Discover new technologies and best practices from the community. Share knowledge and
                grow together.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h3" gutterBottom>
                Build
              </Typography>
              <Typography variant="body1">
                Create amazing projects with the help of the community. Turn your ideas into
                reality.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Home;
