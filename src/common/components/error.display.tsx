import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { Alert, Snackbar } from '@mui/material';

import { errMsgSelector } from '../app.state';

export function ErrorDisplaySnackbar() {
  const [open, setOpen] = useState(false);
  const [errMsg, setErrMsg] = useRecoilState(errMsgSelector);

  const handleClose = () => {
    setOpen(false);
    setErrMsg('');
  };

  useEffect(() => {
    if (errMsg.length <= 0) return;
    setOpen(true);
  }, [errMsg, setOpen]);

  return (
    <div>
      <Snackbar open={open} autoHideDuration={10000} onClose={handleClose}>
        <Alert onClose={handleClose} severity="error" variant="filled" sx={{ width: '100%' }}>
          {errMsg}
        </Alert>
      </Snackbar>
    </div>
  );
}
