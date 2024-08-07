import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { AppBar, Toolbar, Typography } from '@mui/material';

// import { initialHeaderState } from '../app.state';
import { headerSelector } from '../app.state';
import { NamespaceSelectorPage } from './namespace.selector';

export function HeaderPage() {
  const header = useRecoilValue(headerSelector);
  const [effectiveHeader, setEffectiveHeader] = useState('');

  useEffect(() => {
    if (header) setEffectiveHeader(`InnfisWindow - ${header}`);
    else setEffectiveHeader('InnfisWindow');
  }, [header]);

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {effectiveHeader}
        </Typography>
        <NamespaceSelectorPage />
      </Toolbar>
    </AppBar>
  );
}
