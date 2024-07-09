import { useRecoilValue } from 'recoil';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Grid, TextField } from '@mui/material';

// import { toStateNamespace } from '../appstate/atom';
import { initialNamespace } from '../appstate/atom';
import { useGetDeploymentDetail } from './api';
import { DeploymentDetail } from './entity';

export function DeploymentDetailPage() {
  // const namespace = useRecoilValue(toStateNamespace);
  const namespace = useRecoilValue(initialNamespace);
  const [detail, setDetail] = useState<DeploymentDetail | null>(null);

  const { name } = useParams();
  const { data, isFetched } = useGetDeploymentDetail(namespace, name ? name : '');

  useEffect(() => {
    if (data) {
      setDetail(data.data);
    }
  }, [data, isFetched]);

  return (
    <Grid container xs={12} direction="column" sx={{ width: 400 }}>
      <TextField label="name" sx={{ marginBottom: '10px' }} value={detail?.metadata.name} />
      <TextField label="replicas" sx={{ marginBottom: '10px' }} value={detail?.spec.replicas} />
      <TextField label="status" sx={{ marginBottom: '10px' }} rows={4} value={detail?.status} />
      <TextField
        label="image"
        sx={{ marginBottom: '10px' }}
        value={detail?.spec.template.spec.containers[0].image}
      />
    </Grid>
  );
}
