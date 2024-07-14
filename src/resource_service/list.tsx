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
import { ServiceItem } from './entity';
import { useGetServicesByNamespace } from './api';

export function ServiceListPage() {
  const [currentNamespace] = useRecoilState(initialNamespace);
  const [, setErrMsg] = useRecoilState(initialErrorMessage);

  const { data, isFetched, refetch } = useGetServicesByNamespace(currentNamespace);
  const [services, setServices] = useState<ServiceItem[]>([]);
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
      setServices(data?.data?.items ? data?.data?.items : []);
    }
  }, [isFetched, data, setErrMsg]);

  function onClickService(name: string) {
    navigate(`/service/${name}`);
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
                  <TableCell>Type</TableCell>
                  <TableCell>clusterIP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {services.map((service) => {
                  return (
                    <TableRow
                      key={service.metadata.uid}
                      onClick={() => onClickService(service.metadata.name)}
                      sx={{ marginBottom: '2px' }}
                    >
                      <TableCell>{service.metadata.name}</TableCell>
                      <TableCell>{service.spec.type}</TableCell>
                      <TableCell>{service.spec.clusterIP}</TableCell>
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
