import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useGetDeploymentDetail } from "./api";
import { DeploymentDetail } from "./entity";

export function DeploymentDetailPage() {
  const [ detail, setDetail ] = useState<DeploymentDetail | null>(null);
  const { name } = useParams();

  console.log(`name: ${name}`);
  const { data, refetch } = useGetDeploymentDetail("default", name!);

  useEffect(() => {
    if (data) {
      setDetail(data.data);
    }
  }, [name, data]);

  return (
    <div>
      deployment detail 
    </div>
  );
}