import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
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

import { DeploymentSummary } from './entity';
import { useGetDeploymentsByNamespace } from './api';

export function DeploymentListPage() {
  // TODO: store namespace in recoil state
  const { data, isFetched } = useGetDeploymentsByNamespace('default');
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isFetched) {
      setDeployments(data?.data.items || []);
    }
  }, [isFetched, data?.data.items]);

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
