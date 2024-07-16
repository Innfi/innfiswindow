// DeploymentList
export interface DeploymentList {
  kind: string;
  apiVersion: string;
  items: DeploymentSummary[];
}

export interface DeploymentSummary {
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    creationTimestamp: string;
  };
  spec: {
    replicas: number;
    selector: {
      matchLabels: { [id: string]: string };
    };
    template: {
      spec: {
        containers: DeploymentContainerDetail[];

        restartPolicy: string;
        dnsPolicy: string;
      };
    };
  };
  status: {
    replicas: number;
    availableReplicas: number;
    conditions: {
      type: string;
      status: string;
      lastUpdateTime: string;
      lastTransitionTime: string;
    }[];
  };
}

export interface DeploymentContainerDetail {
  name: string;
  image: string;
  ports: {
    containerPort: number | undefined;
    nodePort: number | undefined;
    protocol: string;
  }[];
  resources: {
    limits?: {
      cpu?: string;
      memory?: string;
    };
    requests?: {
      cpu?: string;
      memory?: string;
    };
  };
}

// DeploymentDetail
export interface DeploymentDetail {
  kind: string;
  apiVersion: string;
  metadata: DeploymentDetailMetadata;
  spec: DeploymentDetailSpec;
  status: DeploymentDetailStatus;
}

export interface DeploymentDetailMetadata {
  name: string;
  namespace: string;
  uid: string;
  labels: { [key: string]: string };
}

export interface DeploymentDetailSpec {
  replicas: number;
  selector: {
    matchLabels: { [id: string]: string };
  };
  template: {
    spec: {
      containers: DeploymentContainerDetail[];

      restartPolicy: string;
      dnsPolicy: string;
    };
  };
}

export interface DeploymentDetailStatus {
  replicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
}
