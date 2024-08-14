import { useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';

import { ApiError } from '../common/axios.client';
import { errMsgSelector, namespaceSelector } from '../common/app.state';
import { PodSummary } from './entity';
import { useGetPodsByNamespace } from './api';

export function PodListPage() {
  const currentNamespace = useRecoilValue(namespaceSelector);
  const [, setErrMsg] = useRecoilState(errMsgSelector);

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

  const columns = useMemo<MRT_ColumnDef<PodSummary>[]>(
    () => [
      { accessorFn: (row) => row.metadata.name, header: 'Name' },
      {
        accessorFn: (row) => {
          if (!row.metadata.ownerReferences) return '';
          return row.metadata.ownerReferences.map((v) => v.kind).join(', ');
        },
        header: 'Workload',
      },
      { accessorFn: (row) => row.status.startTime, header: 'CreatedAt' },
      { accessorFn: (row) => row.status.phase, header: 'Status' },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: pods,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        console.log(`onClick: ${row.id}, ${row.original.metadata.name}`);
      },
      sx: { cursor: 'pointer' },
    }),
  });

  return <MaterialReactTable table={table} />;
}
