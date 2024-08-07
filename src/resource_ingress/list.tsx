import { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

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
  // TODO: ingresses
  const [summary, setSummary] = useState<IngressSummary[]>([]);

  useEffect(() => {
    refetch();
  }, [currentNamespace, refetch]);

  useEffect(() => {
    if (data instanceof ApiError) {
      setErrMsg(`IngressListPage] ${data.errMsg}`);
      return;
    }

    if (data?.data?.items) {
      setSummary(data?.data?.items ? data?.data?.items : []);
    }
  }, [isFetched, data, setErrMsg]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>LoadBalancer</TableCell>
                <TableCell>Rules</TableCell>
                <TableCell>CreatedAt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.map((summary) => {
                return (
                  <TableRow>
                    <TableCell>{summary.metadata.name}</TableCell>
                    <TableCell>{toLoadBalancerName(summary)}</TableCell>
                    <TableCell>{toLoadBalancerRules(summary)}</TableCell>
                    <TableCell>{summary.metadata.creationTimestamp}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
}
