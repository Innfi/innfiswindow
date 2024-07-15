import { useEffect, useState } from 'react';
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
import { PodSummary } from './entity';
import { useGetPodsByNamespace } from './api';

export function PodListPage() {
  const [currentNamespace] = useRecoilState(initialNamespace);
  const [, setErrMsg] = useRecoilState(initialErrorMessage);

  const { data, isFetched, refetch } = useGetPodsByNamespace(currentNamespace);
  const [pods, setPods] = useState<PodSummary[]>([]);

  useEffect(() => {
    refetch();
  }, [currentNamespace, refetch]);

  useEffect(() => {
    if (data instanceof ApiError) {
      setErrMsg(`PodListPage] ${data.errMsg}`);
      return;
    }

    if (data?.data?.items) {
      setPods(data?.data?.items ? data?.data?.items : []);
    }
  }, [isFetched, data, setErrMsg]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Stack>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Invoked Workload</TableCell>
                  <TableCell>CreatedAt</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pods.map((pod) => {
                  return (
                    <TableRow key={pod.metadata.uid} sx={{ marginBottom: '2px' }}>
                      <TableCell>{pod.metadata.name}</TableCell>
                      <TableCell>{pod.metadata.ownerReferences[0].kind}</TableCell>
                      <TableCell>{pod.status.startTime}</TableCell>
                      <TableCell>{pod.status.phase}</TableCell>
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
