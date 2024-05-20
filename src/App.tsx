import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { RenderRouter } from './pathfinder/route.registry';
import { HeaderPage } from './common/header';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <HeaderPage />
        <BrowserRouter>
          <RenderRouter />
        </BrowserRouter>
      </ThemeProvider>
    </Suspense>
  );
}
