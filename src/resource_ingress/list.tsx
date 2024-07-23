import { useEffect, useState } from "react";
import { useRecoilState } from "recoil";
import { Grid, Paper, TableContainer } from "@mui/material";

import { initialErrorMessage, initialNamespace } from "../common/app.state";
import { ApiError } from "../common/axios.client";
import { useGetIngressesByNamespace } from "./api";
import { IngressSummary } from "./entity";

export function IngressListPage() {
  const [currentNamespace] = useRecoilState(initialNamespace);
  const [, setErrMsg] = useRecoilState(initialErrorMessage);

  const { data, isFetched, refetch } = useGetIngressesByNamespace(currentNamespace);
  // TODO: ingresses
  const [,setIngresses] = useState<IngressSummary[]>([]);

  useEffect(() => {
    refetch();
  }, [currentNamespace, refetch]);

  useEffect(() => {
    if (data instanceof ApiError) {
      setErrMsg(`IngressListPage] ${data.errMsg}`);
      return;
    }

    if (data?.data?.items) {
      setIngresses(data?.data?.items ? data?.data?.items: []);
    }
  }, [isFetched, data, setErrMsg]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TableContainer component={Paper}>

        </TableContainer>
      </Grid>
    </Grid>
  );
}