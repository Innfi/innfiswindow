import { AppBar, Toolbar, Typography } from '@mui/material';

export function HeaderPage() {
  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        alignItems: 'center',
      }}
    >
      <Toolbar>
        <Typography variant="h6">InnfisWindow</Typography>
      </Toolbar>
    </AppBar>
  );
}
