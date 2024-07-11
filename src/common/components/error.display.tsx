import { Fragment, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { IconButton, Snackbar } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { initialErrorMessage } from '../../appstate/atom';

export function ErrorDisplaySnackbar() {
  const [open, setOpen] = useState(false);
  const [errMsg, setErrMsg] = useRecoilState(initialErrorMessage);

  const handleClose = () => {
    setErrMsg('');
    setOpen(false);
  };

  useEffect(() => {
    if (errMsg.length <= 0) return;
    setOpen(true);
  }, [errMsg, setOpen]);

  const action = (
    <Fragment>
      <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Fragment>
  );

  return (
    <div>
      <Snackbar
        open={open}
        autoHideDuration={10000}
        onClose={handleClose}
        message={errMsg}
        action={action}
      />
    </div>
  );
}
