import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
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

import { ApiError } from '../common/axios.client';
import { initialErrorMessage, initialNamespace } from '../common/app.state';
import { DeploymentSummary } from './entity';
import { useGetDeploymentsByNamespace } from './api';

function toPodsCount(summary: Readonly<DeploymentSummary>): string {
  if (!summary || !summary.status) return '';

  const { replicas, availableReplicas } = summary.status;
  if (!replicas || !availableReplicas) return '';

  return `${availableReplicas} / ${replicas}`;
}

function toLastStatus(summary: Readonly<DeploymentSummary>): string {
  if (!summary || !summary.status) return '';

  const { conditions } = summary.status;
  if (!conditions || conditions.length <= 0) return 'unknown';

  return conditions[conditions.length - 1].type;
}

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
    if (data instanceof ApiError) {
      setErrMsg(`DeploymentListPage] ${data.errMsg}`);
      return;
    }

    if (data?.data?.items) {
      setDeployments(data?.data?.items ? data?.data.items : []);
    }
  }, [isFetched, data, setErrMsg]);

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
                  <TableCell>Pod Count</TableCell>
                  <TableCell>Replicas</TableCell>
                  <TableCell>CreatedAt</TableCell>
                  <TableCell>Status</TableCell>
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
                      <TableCell>{toPodsCount(deployment)}</TableCell>
                      <TableCell>{deployment.spec.replicas}</TableCell>
                      <TableCell>{deployment.metadata.creationTimestamp}</TableCell>
                      <TableCell>{toLastStatus(deployment)}</TableCell>
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
