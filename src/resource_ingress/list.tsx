import { useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';

import { errMsgSelector, namespaceSelector } from '../common/app.state';
import { ApiError } from '../common/axios.client';
import { useGetIngressesByNamespace } from './api';
import { IngressSummary } from './entity';

const toLoadBalancerName = (ingress: Readonly<IngressSummary>): string => {
  return ingress.status.loaBalancer.ingress.map((v) => v.hostname).join(', ');
};

const toLoadBalancerRules = (ingress: Readonly<IngressSummary>): string => {
  return ingress.spec.rules
    .map((v) => {
      return v.http.paths
        .map((pathElem) => {
          const { path, backend } = pathElem;
          return `${v.host} - ${path} -> ${backend.service.name}: ${backend.service.port.number}`;
        })
        .join(', ');
    })
    .join('\n');
};

export function IngressListPage() {
  const currentNamespace = useRecoilValue(namespaceSelector);
  const [, setErrMsg] = useRecoilState(errMsgSelector);

  const { data, isFetched, refetch } = useGetIngressesByNamespace(currentNamespace);
  const [ingresses, setIngresses] = useState<IngressSummary[]>([]);

  useEffect(() => {
    refetch();
  }, [currentNamespace, refetch]);

  useEffect(() => {
    if (data instanceof ApiError) {
      setErrMsg(`IngressListPage] ${data.errMsg}`);
      return;
    }

    if (data?.data?.items) {
      setIngresses(data?.data?.items ? data?.data?.items : []);
    }
  }, [isFetched, data, setErrMsg]);

  const columns = useMemo<MRT_ColumnDef<IngressSummary>[]>(
    () => [
      { accessorFn: (row) => row.metadata.name, header: 'Name' },
      { accessorFn: (row) => toLoadBalancerName(row), header: 'Loadbalancer' },
      { accessorFn: (row) => toLoadBalancerRules(row), header: 'Rules' },
      { accessorFn: (row) => row.metadata.creationTimestamp, header: 'CreatedAt' },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: ingresses,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        console.log(`onClick: ${row.original.metadata.name}`);
      },
      sx: { cursor: 'pointer' },
    }),
  });

  return <MaterialReactTable table={table} />;
}
