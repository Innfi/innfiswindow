import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';

import { ApiError } from '../common/axios.client';
import { errMsgSelector, namespaceSelector } from '../common/app.state';
import { DeploymentSummary } from './entity';
import { useGetDeploymentsByNamespace } from './api';

function toPodsCount(summary: Readonly<DeploymentSummary>): string {
  if (!summary || !summary.status) return '';

  const { replicas, availableReplicas } = summary.status;
  if (!replicas || !availableReplicas) return '';

  return `${availableReplicas} / ${replicas}`;
}

function toLastStatus(summary: Readonly<DeploymentSummary>): string {
  if (!summary || !summary.status) return '';

  const { conditions } = summary.status;
  if (!conditions || conditions.length <= 0) return 'unknown';

  return conditions[conditions.length - 1].type;
}

export function DeploymentListPage() {
  const currentNamespace = useRecoilValue(namespaceSelector);
  const [, setErrMsg] = useRecoilState(errMsgSelector);

  const { data, isFetched, refetch } = useGetDeploymentsByNamespace(currentNamespace);
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
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
      setDeployments(data?.data?.items ? data?.data.items : []);
    }
  }, [isFetched, data, setErrMsg]);

  function onClickDeployment(name: string) {
    navigate(`/deployment/${name}`);
  }

  const columns = useMemo<MRT_ColumnDef<DeploymentSummary>[]>(
    () => [
      { accessorFn: (row) => row.metadata.name, header: 'Name' },
      { accessorFn: (row) => toPodsCount(row), header: 'Pod Count' },
      { accessorFn: (row) => row.spec.replicas, header: 'Replicas' },
      { accessorFn: (row) => toLastStatus(row), header: 'Status' },
      { accessorFn: (row) => row.metadata.creationTimestamp, header: 'CreatedAt' },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: deployments,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        onClickDeployment(row.original.metadata.name);
      },
      sx: { cursor: 'pointer' },
    }),
  });

  return <MaterialReactTable table={table} />;
}
