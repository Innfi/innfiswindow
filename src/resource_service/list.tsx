import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
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
import { ServiceItem } from './entity';
import { useGetServicesByNamespace } from './api';

export function ServiceListPage() {
  const namespace = useRecoilValue(toStateNamespace);

  const { data, isFetched } = useGetServicesByNamespace(namespace);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isFetched) {
      setServices(data?.data.items || []);
    }
  }, [isFetched, data?.data.items]);

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
