import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';

import { ApiError } from '../common/axios.client';
import { errMsgSelector, namespaceSelector } from '../common/app.state';
import { ServicePortDetail, ServiceSummary } from './entity';
import { useGetServicesByNamespace } from './api';

const toPortsOneline = (ports: Readonly<ServicePortDetail>[]): string => {
  if (!ports) return '';

  return ports
    .map((portUnit) => {
      const { protocol, port, targetPort } = portUnit;
      return `${port}:${targetPort}/${protocol}`;
    })
    .join(',');
};

export function ServiceListPage() {
  const currentNamespace = useRecoilValue(namespaceSelector);
  const [, setErrMsg] = useRecoilState(errMsgSelector);

  const { data, isFetched, refetch } = useGetServicesByNamespace(currentNamespace);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    refetch();
  }, [currentNamespace, refetch]);

  useEffect(() => {
    if (data instanceof ApiError) {
      setErrMsg(`ServiceListPage] ${data.errMsg}`);
      return;
    }

    if (data?.data?.items) {
      setServices(data?.data?.items ? data?.data?.items : []);
    }
  }, [isFetched, data, setErrMsg]);

  function onClickService(name: string) {
    navigate(`/service/${name}`);
  }

  const columns = useMemo<MRT_ColumnDef<ServiceSummary>[]>(
    () => [
      { accessorFn: (row) => row.metadata.name, header: 'Name' },
      { accessorFn: (row) => row.spec.type, header: 'Type' },
      { accessorFn: (row) => row.spec.clusterIP, header: 'ClusterIP' },
      { accessorFn: (row) => toPortsOneline(row.spec.ports), header: 'Ports' },
      { accessorFn: (row) => row.metadata.creationTimestamp, header: 'CreatedAt' },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: services,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        onClickService(row.original.metadata.name);
      },
      sx: { cursor: 'pointer' },
    }),
  });

  return <MaterialReactTable table={table} />;
}
