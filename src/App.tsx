import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { RenderRouter } from './pathfinder/route.registry';

const darkTheme = createTheme({
  palette: {
    mode: 'dark'
  },
});

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BrowserRouter>
        <ThemeProvider theme={darkTheme} >
          <CssBaseline />
          <RenderRouter />
        </ThemeProvider>
      </BrowserRouter>
    </Suspense>
  );
}
