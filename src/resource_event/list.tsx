import { useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';

import { errMsgSelector } from '../common/app.state';
import { ApiError } from '../common/axios.client';
import { useGetAllEvents } from './api';
import { EventSummary } from './entity';

const FETCH_EVENT_COUNT = 10;

export function EventListPage() {
  const [, setErrMsg] = useRecoilState(errMsgSelector);
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

  const columns = useMemo<MRT_ColumnDef<EventSummary>[]>(
    () => [
      { accessorFn: (row) => row.type, header: 'Type' },
      { accessorFn: (row) => row.regarding.kind, header: 'Kind' },
      { accessorFn: (row) => row.note, header: 'Note' },
      { accessorFn: (row) => row.regarding.name, header: 'Name' },
      { accessorFn: (row) => row.regarding.namespace, header: 'Namespace' },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: events,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        console.log(`onClick: ${row.original.regarding.name}`);
      },
      sx: { cursor: 'pointer' },
    }),
  });

  return <MaterialReactTable table={table} />;
}
