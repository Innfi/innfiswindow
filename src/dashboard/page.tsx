import { Container, Grid, Typography } from '@mui/material';

export function DashboardPage() {
  return (
    <Container sx={{ mt: 4, mb: 4, ml: 10 }}>
      <Grid container spacing={2}>
        <Grid item>
          <Typography variant="h6" component="h6" color={'whitesmoke'}>
            dashboard page
          </Typography>
        </Grid>
      </Grid>
    </Container>
  );
}
