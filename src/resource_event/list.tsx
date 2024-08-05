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

import { initialErrorMessage } from '../common/app.state';
import { ApiError } from '../common/axios.client';
import { useGetAllEvents } from './api';
import { EventSummary } from './entity';

const FETCH_EVENT_COUNT = 10;

export function EventListPage() {
  const [, setErrMsg] = useRecoilState(initialErrorMessage);
  const [continueKey, setContinueKey] = useState('');

  const { data, isFetched } = useGetAllEvents(FETCH_EVENT_COUNT, continueKey);
  const [events, setEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    if (data instanceof ApiError) {
      setErrMsg(`EventListPage] ${data.errMsg}`);
    }

    if (data?.data?.metadata.continue) {
      setContinueKey(data?.data?.metadata.continue);
    }

    if (data?.data?.items) {
      setEvents(data?.data?.items ? data?.data?.items : []);
    }
  }, [isFetched, data, setErrMsg, setContinueKey]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Stack>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Namespace</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((eventSummary) => {
                  return (
                    <TableRow key={eventSummary.regarding.uid} sx={{ marginBottom: '2px' }}>
                      <TableCell>{eventSummary.type}</TableCell>
                      <TableCell>{eventSummary.regarding.kind}</TableCell>
                      <TableCell>{eventSummary.note}</TableCell>
                      <TableCell>{eventSummary.regarding.name}</TableCell>
                      <TableCell>{eventSummary.regarding.namespace}</TableCell>
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
