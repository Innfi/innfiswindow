// DeploymentList
export interface DeploymentList {
  kind: string;
  apiVersion: string;
  metadata: Metadata;
  items: DeploymentSummary[];
};

export interface Metadata {
  resourceVersion: string;
};

export interface DeploymentSummary {
  metadata: ItemMetadata;
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
      }
    };
  };
};

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

export interface ItemMetadata {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  generation: number;
  creationTimestamp: string;
  managedFields: any;
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
      }
    };
}

export interface DeploymentDetailStatus {
  replicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
}
