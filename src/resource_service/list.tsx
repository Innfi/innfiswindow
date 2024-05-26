import { useEffect, useState } from 'react';
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

import { ServiceItem } from './entity';
import { useGetServicesByNamespace } from './api';

export function ServiceListPage() {
  const { data, isFetched } = useGetServicesByNamespace('default');
  const [services, setServices] = useState<ServiceItem[]>([]);

  useEffect(() => {
    if (isFetched) {
      setServices(data?.data.items || []);
    }
  }, [isFetched, data?.data.items]);

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
                    <TableRow>
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
