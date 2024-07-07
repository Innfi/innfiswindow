import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

import { toStateNamespace } from '../appstate/atom';
import { DeploymentSummary } from './entity';
import { useGetDeploymentsByNamespace } from './api';

export function DeploymentListPage() {
  const namespace = useRecoilValue(toStateNamespace);

  const { data: response, isFetched, isFetchedAfterMount, refetch} = useGetDeploymentsByNamespace(namespace);
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    console.log(`namespace: ${namespace}`);
    refetch();
  }, [namespace, refetch]);

  useEffect(() => {
    if (response instanceof AxiosError) {
      console.log(`axiosError: ${response.code}`); // grab the error and express
      return;
    }
    console.log(`useEffect2: ${JSON.stringify(response?.data?.items)}`);
    if (response?.data?.items) {
      console.log(`useEffect2] before setDeployments`);
      setDeployments(response?.data?.items ? response?.data.items : []);
    }
  }, [isFetched, isFetchedAfterMount, response]);

  function onClickDeployment(name: string) {
    navigate(`/deployment/${name}`);
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Stack>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Replicas</TableCell>
                  <TableCell>CreatedAt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deployments.map((deployment) => {
                  return (
                    <TableRow
                      key={deployment.metadata.uid}
                      onClick={() => onClickDeployment(deployment.metadata.name)}
                      sx={{ marginBottom: '2px' }}
                    >
                      <TableCell>{deployment.metadata.name}</TableCell>
                      <TableCell>{deployment.spec.replicas}</TableCell>
                      <TableCell>{deployment.metadata.creationTimestamp}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Grid>
    </Grid>
  );
}
