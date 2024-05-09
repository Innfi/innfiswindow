import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useGetDeploymentDetail } from './api';
import { DeploymentDetail } from './entity';
import { Grid, TextField } from '@mui/material';

export function DeploymentDetailPage() {
  const { name } = useParams();
  if (!name) return (<div>empty deployment name</div>);

  const [detail, setDetail] = useState<DeploymentDetail | null>(null);
  const { data, isFetched } = useGetDeploymentDetail('default', name);

  useEffect(() => {
    if (data) {
      setDetail(data.data);
    }
  }, [data, isFetched]);

  return (
    <Grid container xs={12} direction="column" sx={{ width: 400 }}>
      <TextField label="name" sx={{ marginBottom: "10px" }} />
      <TextField label="replicas" sx={{ marginBottom: "10px" }}  />
      <TextField label="status" sx={{ marginBottom: "10px" }}  />
    </Grid>
  );
}
