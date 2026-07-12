import { createFileRoute, Link } from '@tanstack/react-router';
import { Container, Typography, Button, Box } from '@mui/material';

export const Route = createFileRoute('/_main/about')({ component: About });

function About() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom>About Page</Typography>
        <Button variant="contained" component={Link} to="/">Go to Home</Button>
      </Box>
    </Container>
  );
}
