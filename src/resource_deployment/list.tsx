import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
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

import { initialErrorMessage, initialNamespace } from '../appstate/atom';
import { DeploymentSummary } from './entity';
import { useGetDeploymentsByNamespace } from './api';

export function DeploymentListPage() {
  const [currentNamespace] = useRecoilState(initialNamespace);
  const [, setErrMsg] = useRecoilState(initialErrorMessage);

  const { data, isFetched, refetch } = useGetDeploymentsByNamespace(currentNamespace);
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    refetch();
  }, [currentNamespace, refetch]);

  useEffect(() => {
    if (data instanceof AxiosError) {
      // console.log(`axiosError: ${data.code}`); // grab the error and express
      setErrMsg(`DeploymentListPage] ${data.code}`);
      return;
    }

    if (data?.data?.items) {
      setDeployments(data?.data?.items ? data?.data.items : []);
    }
  }, [isFetched, data]);

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
