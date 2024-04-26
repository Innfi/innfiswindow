import { useEffect, useState } from "react";
import { Grid } from "@mui/material";

import { DeploymentList, DeploymentSummary } from "./entity";
import { useGetDeploymentsByNamespace } from "./api";

export function DeploymentListPage() {
  const { data, isFetched } = useGetDeploymentsByNamespace<DeploymentList>("default");
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);

  useEffect(() => {
    if (isFetched) {
      setDeployments(data?.data.items || []);
    }
  });

  return (
    <Grid container spacing={3}>
      {deployments.map((deployment) => {
        return (
          <Grid item xs={12} key={deployment.metadata.uid}>
            {deployment.metadata.name}
          </Grid>
        );
      })}
    </Grid>
  );
}