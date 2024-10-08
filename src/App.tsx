import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { RenderRouter } from './pathfinder/route.registry';
import { HeaderPage } from './common/components/header';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <HeaderPage />
      <BrowserRouter>
        <RenderRouter />
      </BrowserRouter>
    </ThemeProvider>
  );
}
