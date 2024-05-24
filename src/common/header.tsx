import { AppBar, Toolbar, Typography } from '@mui/material';

import { NamespaceSelectorPage } from './namespace.selector';

export function HeaderPage() {
  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          InnfisWindow
        </Typography>
        <NamespaceSelectorPage />
      </Toolbar>
    </AppBar>
  );
}
