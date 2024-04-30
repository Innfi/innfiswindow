// DeploymentList
export interface DeploymentList {
  kind: string;
  apiVersion: string;
  metadata: Metadata;
  items: DeploymentSummary[];
}

export interface Metadata {
  resourceVersion: string;
}

export interface DeploymentSummary {
  metadata: ItemMetadata;
}

export interface ItemMetadata {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  generation: number;
  creationTimestamp: string;
  managedFields: ManagedField[];
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
  //TODO
}

export interface DeploymentDetailStatus {
  replicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
}